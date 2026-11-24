import type { JsonlRecord, JsonValueType } from './types';

const utf8Encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

export function getUtf8ByteLength(text: string): number {
  if (utf8Encoder) {
    return utf8Encoder.encode(text).byteLength;
  }
  return text.length;
}

export function detectValueType(value: unknown): JsonValueType {
  if (value === undefined) return 'missing';
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  const t = typeof value;
  if (t === 'string') return 'string';
  if (t === 'number') return 'number';
  if (t === 'boolean') return 'boolean';
  if (t === 'object') return 'object';
  return 'string';
}

export function stripBom(text: string): { text: string; hadBom: boolean } {
  if (text.length > 0 && text.charCodeAt(0) === 0xfeff) {
    return { text: text.slice(1), hadBom: true };
  }
  return { text, hadBom: false };
}

/**
 * Parses a single JSONL line independently while preserving original line number.
 * Supports JSON Objects, Arrays, and Primitives (string, number, boolean, null).
 * Blank or whitespace-only lines are classified as 'empty'.
 */
export function parseJsonlLine(rawLine: string, lineNumber: number): JsonlRecord {
  const cleaned = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
  const byteSize = getUtf8ByteLength(cleaned);

  if (cleaned.trim().length === 0) {
    return {
      lineNumber,
      rawContent: cleaned,
      parseStatus: 'empty',
      byteSize,
    };
  }

  try {
    const parsedValue: unknown = JSON.parse(cleaned);
    const rootType = detectValueType(parsedValue) as Exclude<JsonValueType, 'missing'>;
    return {
      lineNumber,
      rawContent: cleaned,
      parsedValue,
      parseStatus: 'valid',
      byteSize,
      rootType,
    };
  } catch (err) {
    const parseError =
      err instanceof Error ? err.message : 'Invalid JSON syntax';
    return {
      lineNumber,
      rawContent: cleaned,
      parseStatus: 'invalid',
      parseError,
      byteSize,
    };
  }
}

/**
 * Incremental line buffer for streaming / chunked File API processing.
 * Safely holds partial lines across chunk boundaries and handles BOM, LF, CRLF,
 * and files without a trailing newline.
 */
export class ChunkLineBuffer {
  private remainder = '';
  private lineNumber = 0;
  private isFirstChunk = true;
  public hadBom = false;

  public pushChunk(chunk: string): JsonlRecord[] {
    let text = chunk;
    if (this.isFirstChunk) {
      this.isFirstChunk = false;
      const stripped = stripBom(text);
      text = stripped.text;
      this.hadBom = stripped.hadBom;
    }

    if (text.length === 0) {
      return [];
    }

    const combined = this.remainder + text;
    const records: JsonlRecord[] = [];
    let start = 0;

    for (let i = 0; i < combined.length; i++) {
      if (combined.charCodeAt(i) === 10) {
        this.lineNumber += 1;
        const line = combined.slice(start, i);
        records.push(parseJsonlLine(line, this.lineNumber));
        start = i + 1;
      }
    }

    this.remainder = combined.slice(start);
    return records;
  }

  public flush(): JsonlRecord[] {
    if (this.remainder.length === 0) {
      return [];
    }
    this.lineNumber += 1;
    const line = this.remainder;
    this.remainder = '';
    return [parseJsonlLine(line, this.lineNumber)];
  }

  public get totalLinesProcessed(): number {
    return this.lineNumber;
  }
}

/**
 * Convenience synchronous parser for smaller strings & unit tests.
 */
export function parseJsonlText(content: string): {
  records: JsonlRecord[];
  validRecords: JsonlRecord[];
  invalidRecords: JsonlRecord[];
  blankLines: number;
  totalLines: number;
  hadBom: boolean;
} {
  const buffer = new ChunkLineBuffer();
  const records = [...buffer.pushChunk(content), ...buffer.flush()];

  const validRecords: JsonlRecord[] = [];
  const invalidRecords: JsonlRecord[] = [];
  let blankLines = 0;

  for (const rec of records) {
    if (rec.parseStatus === 'valid') {
      validRecords.push(rec);
    } else if (rec.parseStatus === 'invalid') {
      invalidRecords.push(rec);
    } else {
      blankLines += 1;
    }
  }

  return {
    records,
    validRecords,
    invalidRecords,
    blankLines,
    totalLines: records.length,
    hadBom: buffer.hadBom,
  };
}
