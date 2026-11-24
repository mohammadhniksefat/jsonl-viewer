import type { FieldSchemaInfo, JsonlRecord, ParseProgress } from '../core/types';
import type { WorkerParseRequest, WorkerResponseMessage } from './jsonlWorker';

export interface ParseFileCallbacks {
  onProgress: (progress: ParseProgress) => void;
  onComplete: (result: {
    validRecords: JsonlRecord[];
    invalidRecords: JsonlRecord[];
    totalLines: number;
    blankLines: number;
    hasBom: boolean;
    encodingWarning?: string;
    columns: string[];
    fieldPaths: FieldSchemaInfo[];
    progress: ParseProgress;
  }) => void;
  onError: (error: {
    errorCode: 'READ_ERROR' | 'ENCODING_ERROR' | 'MEMORY_ERROR' | 'UNKNOWN';
    message: string;
  }) => void;
}

/**
 * Parses a File or Blob in a dedicated module Web Worker so the main UI thread never freezes.
 * Returns a cancel function to terminate the worker cleanly if the user closes or replaces the file.
 */
export function parseFileInWorker(
  sessionId: string,
  file: Blob,
  callbacks: ParseFileCallbacks
): () => void {
  const worker = new Worker(new URL('./jsonlWorker.ts', import.meta.url), {
    type: 'module',
  });

  let terminated = false;

  const cleanup = () => {
    if (!terminated) {
      terminated = true;
      worker.terminate();
    }
  };

  worker.onmessage = (event: MessageEvent<WorkerResponseMessage>) => {
    const data = event.data;
    if (!data || data.sessionId !== sessionId) return;

    if (data.type === 'PROGRESS') {
      callbacks.onProgress(data.progress);
    } else if (data.type === 'COMPLETE') {
      cleanup();
      callbacks.onComplete({
        validRecords: data.validRecords,
        invalidRecords: data.invalidRecords,
        totalLines: data.totalLines,
        blankLines: data.blankLines,
        hasBom: data.hasBom,
        encodingWarning: data.encodingWarning,
        columns: data.columns,
        fieldPaths: data.fieldPaths,
        progress: data.progress,
      });
    } else if (data.type === 'ERROR') {
      cleanup();
      callbacks.onError({
        errorCode: data.errorCode,
        message: data.message,
      });
    }
  };

  worker.onerror = (err) => {
    cleanup();
    callbacks.onError({
      errorCode: 'UNKNOWN',
      message: err.message || 'Worker execution error while parsing file.',
    });
  };

  const request: WorkerParseRequest = {
    type: 'PARSE_FILE',
    sessionId,
    file,
  };
  worker.postMessage(request);

  return cleanup;
}
