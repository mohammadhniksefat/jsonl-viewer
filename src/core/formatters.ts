import { detectValueType } from './parser';
import type { JsonValueType } from './types';

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unitIdx = 0;
  while (value >= 1024 && unitIdx < units.length - 1) {
    value /= 1024;
    unitIdx += 1;
  }
  return `${value >= 100 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${units[unitIdx]}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export function getFileExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  if (idx <= 0 || idx === filename.length - 1) return 'none';
  return filename.slice(idx + 1).toLowerCase();
}

export interface CellPreview {
  text: string;
  type: JsonValueType;
  isSummary: boolean;
}

/**
 * Formats any JSON value into a concise, single-line table cell representation (FR-015, FR-017).
 */
export function formatCellPreview(value: unknown, maxLen = 72): CellPreview {
  const type = detectValueType(value);
  switch (type) {
    case 'missing':
      return { text: '—', type, isSummary: false };
    case 'null':
      return { text: 'null', type, isSummary: false };
    case 'boolean':
      return { text: value ? 'true' : 'false', type, isSummary: false };
    case 'number':
      return { text: String(value), type, isSummary: false };
    case 'string': {
      const s = value as string;
      const singleLine = s.replace(/\r?\n/g, '↵ ');
      const clipped =
        singleLine.length > maxLen
          ? `${singleLine.slice(0, maxLen - 1)}…`
          : singleLine;
      return { text: clipped, type, isSummary: false };
    }
    case 'array': {
      const arr = value as unknown[];
      return {
        text: `[${arr.length} ${arr.length === 1 ? 'item' : 'items'}]`,
        type,
        isSummary: true,
      };
    }
    case 'object': {
      const keys = Object.keys(value as Record<string, unknown>);
      return {
        text: `{${keys.length} ${keys.length === 1 ? 'key' : 'keys'}}`,
        type,
        isSummary: true,
      };
    }
  }
}

export type JsonTokenKind =
  | 'key'
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'punctuation'
  | 'whitespace';

export interface JsonToken {
  kind: JsonTokenKind;
  text: string;
}

/**
 * Tokenizes a formatted JSON string into typed tokens for safe React rendering
 * without ever using dangerouslySetInnerHTML (NFR 5.3 XSS protection).
 */
export function tokenizeJson(jsonText: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  const regex =
    /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|[{}\[\],:]|\s+)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(jsonText)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        kind: 'punctuation',
        text: jsonText.slice(lastIndex, match.index),
      });
    }

    const raw = match[0];
    if (/^\s+$/.test(raw)) {
      tokens.push({ kind: 'whitespace', text: raw });
    } else if (raw.startsWith('"')) {
      if (match[2]) {
        const colonIdx = raw.lastIndexOf(':');
        const keyPart = raw.slice(0, colonIdx);
        tokens.push({ kind: 'key', text: keyPart });
        tokens.push({ kind: 'punctuation', text: ':' });
      } else {
        tokens.push({ kind: 'string', text: raw });
      }
    } else if (raw === 'true' || raw === 'false') {
      tokens.push({ kind: 'boolean', text: raw });
    } else if (raw === 'null') {
      tokens.push({ kind: 'null', text: raw });
    } else if (/^[{}\[\],:]$/.test(raw)) {
      tokens.push({ kind: 'punctuation', text: raw });
    } else {
      tokens.push({ kind: 'number', text: raw });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < jsonText.length) {
    tokens.push({
      kind: 'punctuation',
      text: jsonText.slice(lastIndex),
    });
  }

  return tokens;
}
