import { ChunkLineBuffer } from '../core/parser';
import { discoverSchema } from '../core/pathResolver';
import type { FieldSchemaInfo, JsonlRecord, ParseProgress } from '../core/types';

export interface WorkerParseRequest {
  type: 'PARSE_FILE';
  sessionId: string;
  file: Blob;
  chunkSize?: number;
}

export type WorkerResponseMessage =
  | {
      type: 'PROGRESS';
      sessionId: string;
      progress: ParseProgress;
    }
  | {
      type: 'COMPLETE';
      sessionId: string;
      validRecords: JsonlRecord[];
      invalidRecords: JsonlRecord[];
      totalLines: number;
      blankLines: number;
      hasBom: boolean;
      encodingWarning?: string;
      columns: string[];
      fieldPaths: FieldSchemaInfo[];
      progress: ParseProgress;
    }
  | {
      type: 'ERROR';
      sessionId: string;
      errorCode: 'READ_ERROR' | 'ENCODING_ERROR' | 'MEMORY_ERROR' | 'UNKNOWN';
      message: string;
    };

const DEFAULT_CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks keep memory flat for 100MB files

self.onmessage = async (event: MessageEvent<WorkerParseRequest>) => {
  const msg = event.data;
  if (!msg || msg.type !== 'PARSE_FILE') return;

  const { sessionId, file } = msg;
  const chunkSize = msg.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const totalBytes = file.size;

  const validRecords: JsonlRecord[] = [];
  const invalidRecords: JsonlRecord[] = [];
  let emptyCount = 0;
  let bytesRead = 0;
  let encodingWarning: string | undefined;

  const buffer = new ChunkLineBuffer();
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const strictChecker = new TextDecoder('utf-8', { fatal: true });

  const postProgress = (force = false) => {
    const percent =
      totalBytes === 0 ? 100 : Math.min(100, Math.round((bytesRead / totalBytes) * 100));
    if (force || bytesRead <= totalBytes) {
      const progress: ParseProgress = {
        bytesRead,
        totalBytes,
        percent,
        linesProcessed: buffer.totalLinesProcessed,
        validCount: validRecords.length,
        invalidCount: invalidRecords.length,
        emptyCount,
      };
      self.postMessage({
        type: 'PROGRESS',
        sessionId,
        progress,
      } satisfies WorkerResponseMessage);
    }
  };

  try {
    let offset = 0;
    let lastProgressTs = Date.now();

    while (offset < totalBytes) {
      const slice = file.slice(offset, Math.min(offset + chunkSize, totalBytes));
      let arrayBuffer: ArrayBuffer;
      try {
        arrayBuffer = await slice.arrayBuffer();
      } catch (readErr) {
        self.postMessage({
          type: 'ERROR',
          sessionId,
          errorCode: 'READ_ERROR',
          message:
            readErr instanceof Error
              ? `Failed to read file chunk: ${readErr.message}`
              : 'Failed to read file from disk.',
        } satisfies WorkerResponseMessage);
        return;
      }

      const isFinalChunk = offset + chunkSize >= totalBytes;

      // Detect invalid UTF-8 sequences without crashing parsing
      if (!encodingWarning) {
        try {
          strictChecker.decode(arrayBuffer, { stream: !isFinalChunk });
        } catch {
          encodingWarning =
            'Non-UTF-8 byte sequences detected. Some characters were replaced with Unicode replacement markers ().';
        }
      }

      const textChunk = decoder.decode(arrayBuffer, { stream: !isFinalChunk });
      const parsedBatch = buffer.pushChunk(textChunk);

      for (const rec of parsedBatch) {
        if (rec.parseStatus === 'valid') {
          validRecords.push(rec);
        } else if (rec.parseStatus === 'invalid') {
          invalidRecords.push(rec);
        } else {
          emptyCount += 1;
        }
      }

      offset += arrayBuffer.byteLength;
      bytesRead = offset;

      const now = Date.now();
      if (now - lastProgressTs >= 80 || isFinalChunk) {
        lastProgressTs = now;
        postProgress(false);
      }
    }

    // Flush trailing decoder bytes and partial last line (no trailing newline)
    const remainingText = decoder.decode();
    if (remainingText.length > 0) {
      for (const rec of buffer.pushChunk(remainingText)) {
        if (rec.parseStatus === 'valid') validRecords.push(rec);
        else if (rec.parseStatus === 'invalid') invalidRecords.push(rec);
        else emptyCount += 1;
      }
    }

    for (const rec of buffer.flush()) {
      if (rec.parseStatus === 'valid') validRecords.push(rec);
      else if (rec.parseStatus === 'invalid') invalidRecords.push(rec);
      else emptyCount += 1;
    }

    // Discover union of columns & nested field paths inside Worker off the Main Thread
    const { columns, fieldPaths } = discoverSchema(validRecords);

    const finalProgress: ParseProgress = {
      bytesRead: totalBytes,
      totalBytes,
      percent: 100,
      linesProcessed: buffer.totalLinesProcessed,
      validCount: validRecords.length,
      invalidCount: invalidRecords.length,
      emptyCount,
    };

    self.postMessage({
      type: 'COMPLETE',
      sessionId,
      validRecords,
      invalidRecords,
      totalLines: buffer.totalLinesProcessed,
      blankLines: emptyCount,
      hasBom: buffer.hadBom,
      encodingWarning,
      columns,
      fieldPaths,
      progress: finalProgress,
    } satisfies WorkerResponseMessage);
  } catch (err) {
    const isMemory =
      err instanceof RangeError ||
      (err instanceof Error && /memory|allocation/i.test(err.message));
    self.postMessage({
      type: 'ERROR',
      sessionId,
      errorCode: isMemory ? 'MEMORY_ERROR' : 'UNKNOWN',
      message: isMemory
        ? 'Insufficient browser memory to load this file. Try splitting the dataset into smaller files.'
        : err instanceof Error
          ? err.message
          : 'An unexpected parsing error occurred.',
    } satisfies WorkerResponseMessage);
  }
};
