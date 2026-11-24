import { detectValueType } from './parser';
import type { DatasetStats, FieldStat, JsonlRecord, JsonValueType } from './types';

const DISTINCT_LIMIT = 5000;

interface MutableFieldAcc {
  occurrenceCount: number;
  nullCount: number;
  typeDistribution: Partial<Record<Exclude<JsonValueType, 'missing'>, number>>;
  distinctSet: Set<string>;
  distinctCapped: boolean;
}

function serializeDistinctKey(value: unknown): string {
  if (value === null) return 'null:null';
  if (typeof value === 'string') return `s:${value}`;
  if (typeof value === 'number') return `n:${value}`;
  if (typeof value === 'boolean') return `b:${value}`;
  try {
    return `j:${JSON.stringify(value)}`;
  } catch {
    return `o:${String(value)}`;
  }
}

/**
 * Computes comprehensive Dataset & Field-level statistics (FR-035 through FR-038).
 */
export function computeDatasetStatistics(params: {
  scope: 'all' | 'filtered';
  records: JsonlRecord[];
  totalLines: number;
  invalidRecords: number;
  blankLines: number;
}): DatasetStats {
  const { scope, records, totalLines, invalidRecords, blankLines } = params;
  const validCount = records.length;

  let totalBytes = 0;
  let minSize = validCount > 0 ? Infinity : 0;
  let maxSize = 0;

  const fieldMap = new Map<string, MutableFieldAcc>();

  const trackField = (fieldName: string, value: unknown) => {
    let acc = fieldMap.get(fieldName);
    if (!acc) {
      acc = {
        occurrenceCount: 0,
        nullCount: 0,
        typeDistribution: {},
        distinctSet: new Set<string>(),
        distinctCapped: false,
      };
      fieldMap.set(fieldName, acc);
    }

    acc.occurrenceCount += 1;
    const type = detectValueType(value) as Exclude<JsonValueType, 'missing'>;
    acc.typeDistribution[type] = (acc.typeDistribution[type] ?? 0) + 1;
    if (value === null) {
      acc.nullCount += 1;
    }

    if (!acc.distinctCapped) {
      acc.distinctSet.add(serializeDistinctKey(value));
      if (acc.distinctSet.size >= DISTINCT_LIMIT) {
        acc.distinctCapped = true;
      }
    }
  };

  for (const rec of records) {
    totalBytes += rec.byteSize;
    if (rec.byteSize < minSize) minSize = rec.byteSize;
    if (rec.byteSize > maxSize) maxSize = rec.byteSize;

    const val = rec.parsedValue;
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      const obj = val as Record<string, unknown>;
      for (const key of Object.keys(obj)) {
        trackField(key, obj[key]);
      }
    } else {
      trackField('$value', val);
    }
  }

  const fields: FieldStat[] = [];
  for (const [field, acc] of fieldMap.entries()) {
    let dominantType: Exclude<JsonValueType, 'missing'> = 'string';
    let bestCount = -1;
    for (const [t, count] of Object.entries(acc.typeDistribution)) {
      if ((count ?? 0) > bestCount) {
        bestCount = count ?? 0;
        dominantType = t as Exclude<JsonValueType, 'missing'>;
      }
    }

    fields.push({
      field,
      dominantType,
      typeDistribution: acc.typeDistribution,
      occurrenceCount: acc.occurrenceCount,
      missingCount: Math.max(0, validCount - acc.occurrenceCount),
      nullCount: acc.nullCount,
      distinctCount: acc.distinctSet.size,
      distinctCapped: acc.distinctCapped,
    });
  }

  fields.sort((a, b) => b.occurrenceCount - a.occurrenceCount || a.field.localeCompare(b.field));

  return {
    scope,
    totalLines: scope === 'all' ? totalLines : validCount,
    validRecords: validCount,
    invalidRecords: scope === 'all' ? invalidRecords : 0,
    blankLines: scope === 'all' ? blankLines : 0,
    uniqueFields: fields.length,
    avgRecordSize: validCount > 0 ? Math.round(totalBytes / validCount) : 0,
    minRecordSize: validCount > 0 ? minSize : 0,
    maxRecordSize: maxSize,
    fields,
  };
}
