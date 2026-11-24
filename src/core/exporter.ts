import type { JsonlRecord } from './types';

/**
 * Serializes records to JSONL (one valid JSON document per line).
 * Excludes invalid records by default (FR-044) unless `includeInvalid` is explicitly true.
 */
export function serializeToJsonl(
  records: JsonlRecord[],
  options?: { includeInvalid?: boolean }
): string {
  const includeInvalid = options?.includeInvalid ?? false;
  const lines: string[] = [];

  for (const rec of records) {
    if (rec.parseStatus === 'valid') {
      lines.push(JSON.stringify(rec.parsedValue));
    } else if (includeInvalid && rec.parseStatus === 'invalid') {
      lines.push(rec.rawContent);
    }
  }

  return lines.join('\n');
}

/**
 * Serializes valid records into a formatted JSON Array (FR-042).
 */
export function serializeToJsonArray(records: JsonlRecord[], pretty = true): string {
  const validValues = records
    .filter((rec) => rec.parseStatus === 'valid')
    .map((rec) => rec.parsedValue);
  return JSON.stringify(validValues, null, pretty ? 2 : 0);
}

function escapeCsvCell(raw: string): string {
  if (
    raw.includes(',') ||
    raw.includes('"') ||
    raw.includes('\n') ||
    raw.includes('\r')
  ) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function formatCellValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

/**
 * Serializes valid records into RFC-4180 CSV format (FR-043).
 */
export function serializeToCsv(
  records: JsonlRecord[],
  columns?: string[]
): string {
  const validRecords = records.filter((rec) => rec.parseStatus === 'valid');

  let cols = columns ? [...columns] : [];
  if (cols.length === 0) {
    const colSet = new Set<string>();
    let hasNonObject = false;
    for (const rec of validRecords) {
      const val = rec.parsedValue;
      if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        for (const key of Object.keys(val as Record<string, unknown>)) {
          colSet.add(key);
        }
      } else {
        hasNonObject = true;
      }
    }
    cols = Array.from(colSet);
    if (hasNonObject && !colSet.has('$value')) {
      cols.unshift('$value');
    }
  }

  if (cols.length === 0) {
    return '';
  }

  const rows: string[] = [];
  rows.push(cols.map(escapeCsvCell).join(','));

  for (const rec of validRecords) {
    const val = rec.parsedValue;
    const isObj = val !== null && typeof val === 'object' && !Array.isArray(val);
    const obj = isObj ? (val as Record<string, unknown>) : null;

    const line = cols.map((col) => {
      if (col === '$value') {
        return escapeCsvCell(isObj ? '' : formatCellValue(val));
      }
      if (!obj || !Object.prototype.hasOwnProperty.call(obj, col)) {
        return '';
      }
      return escapeCsvCell(formatCellValue(obj[col]));
    });

    rows.push(line.join(','));
  }

  return rows.join('\n');
}

export function triggerFileDownload(
  content: string | Blob,
  filename: string,
  mimeType: string
): void {
  const blob =
    content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
