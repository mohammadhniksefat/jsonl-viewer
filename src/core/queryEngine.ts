import { detectValueType } from './parser';
import { resolveJsonPath } from './pathResolver';
import type {
  FilterCondition,
  FilterOperator,
  JsonlRecord,
  JsonValueType,
  SearchFilterConfig,
  SortConfig,
} from './types';

export interface OperatorDefinition {
  id: FilterOperator;
  label: string;
  needsValue: boolean;
  supportedTypes: Array<Exclude<JsonValueType, 'missing'> | 'any'>;
}

export const FILTER_OPERATORS: OperatorDefinition[] = [
  {
    id: 'equals',
    label: 'Equals',
    needsValue: true,
    supportedTypes: ['any', 'string', 'number', 'boolean', 'null'],
  },
  {
    id: 'not_equals',
    label: 'Not Equals',
    needsValue: true,
    supportedTypes: ['any', 'string', 'number', 'boolean', 'null'],
  },
  {
    id: 'contains',
    label: 'Contains',
    needsValue: true,
    supportedTypes: ['any', 'string', 'array', 'object'],
  },
  {
    id: 'not_contains',
    label: 'Does Not Contain',
    needsValue: true,
    supportedTypes: ['any', 'string', 'array', 'object'],
  },
  {
    id: 'starts_with',
    label: 'Starts With',
    needsValue: true,
    supportedTypes: ['any', 'string'],
  },
  {
    id: 'ends_with',
    label: 'Ends With',
    needsValue: true,
    supportedTypes: ['any', 'string'],
  },
  {
    id: 'gt',
    label: 'Greater Than',
    needsValue: true,
    supportedTypes: ['any', 'number', 'string'],
  },
  {
    id: 'lt',
    label: 'Less Than',
    needsValue: true,
    supportedTypes: ['any', 'number', 'string'],
  },
  {
    id: 'exists',
    label: 'Exists',
    needsValue: false,
    supportedTypes: ['any', 'string', 'number', 'boolean', 'null', 'array', 'object'],
  },
  {
    id: 'is_null',
    label: 'Is Null',
    needsValue: false,
    supportedTypes: ['any', 'string', 'number', 'boolean', 'null', 'array', 'object'],
  },
  {
    id: 'is_empty',
    label: 'Is Empty',
    needsValue: false,
    supportedTypes: ['any', 'string', 'array', 'object', 'null'],
  },
];

export function isOperatorAllowedForType(
  operator: FilterOperator,
  dataType?: Exclude<JsonValueType, 'missing'> | 'any'
): boolean {
  const effectiveType = dataType ?? 'any';
  const def = FILTER_OPERATORS.find((o) => o.id === operator);
  if (!def) return false;
  if (effectiveType === 'any') return true;
  return def.supportedTypes.includes(effectiveType);
}

export function getAllowedOperatorsForType(
  dataType?: Exclude<JsonValueType, 'missing'> | 'any'
): OperatorDefinition[] {
  const effectiveType = dataType ?? 'any';
  if (effectiveType === 'any') return FILTER_OPERATORS;
  return FILTER_OPERATORS.filter((op) => op.supportedTypes.includes(effectiveType));
}

function stringifyForSearch(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function compareEqual(actual: unknown, rawExpected: string, caseSensitive: boolean): boolean {
  if (actual === null) {
    return rawExpected.trim().toLowerCase() === 'null';
  }
  if (typeof actual === 'number') {
    const num = Number(rawExpected);
    if (!Number.isNaN(num) && rawExpected.trim() !== '') {
      return actual === num;
    }
    return String(actual) === rawExpected;
  }
  if (typeof actual === 'boolean') {
    const lowered = rawExpected.trim().toLowerCase();
    if (lowered === 'true') return actual === true;
    if (lowered === 'false') return actual === false;
    return false;
  }
  const actualStr = stringifyForSearch(actual);
  return caseSensitive
    ? actualStr === rawExpected
    : actualStr.toLowerCase() === rawExpected.toLowerCase();
}

export function evaluateCondition(
  record: JsonlRecord,
  condition: FilterCondition,
  defaultCaseSensitive: boolean
): boolean {
  const path = condition.path.trim();
  if (!path) return true;

  const { exists, value } = resolveJsonPath(record.parsedValue, path);
  const cs = condition.caseSensitive ?? defaultCaseSensitive;

  switch (condition.operator) {
    case 'exists':
      return exists;

    case 'is_null':
      return exists && value === null;

    case 'is_empty': {
      if (!exists || value === null) return true;
      if (typeof value === 'string') return value.trim().length === 0;
      if (Array.isArray(value)) return value.length === 0;
      if (typeof value === 'object') return Object.keys(value as object).length === 0;
      return false;
    }

    case 'equals':
      if (!exists) return false;
      return compareEqual(value, condition.value, cs);

    case 'not_equals':
      if (!exists) return true;
      return !compareEqual(value, condition.value, cs);

    case 'contains': {
      if (!exists || value === null || value === undefined) return false;
      if (Array.isArray(value)) {
        const needle = cs ? condition.value : condition.value.toLowerCase();
        return value.some((item) => {
          const str = stringifyForSearch(item);
          return cs ? str.includes(needle) : str.toLowerCase().includes(needle);
        });
      }
      const haystack = stringifyForSearch(value);
      return cs
        ? haystack.includes(condition.value)
        : haystack.toLowerCase().includes(condition.value.toLowerCase());
    }

    case 'not_contains': {
      if (!exists || value === null || value === undefined) return true;
      if (Array.isArray(value)) {
        const needle = cs ? condition.value : condition.value.toLowerCase();
        return !value.some((item) => {
          const str = stringifyForSearch(item);
          return cs ? str.includes(needle) : str.toLowerCase().includes(needle);
        });
      }
      const haystack = stringifyForSearch(value);
      return cs
        ? !haystack.includes(condition.value)
        : !haystack.toLowerCase().includes(condition.value.toLowerCase());
    }

    case 'starts_with': {
      if (!exists || value === null || value === undefined) return false;
      const str = stringifyForSearch(value);
      return cs
        ? str.startsWith(condition.value)
        : str.toLowerCase().startsWith(condition.value.toLowerCase());
    }

    case 'ends_with': {
      if (!exists || value === null || value === undefined) return false;
      const str = stringifyForSearch(value);
      return cs
        ? str.endsWith(condition.value)
        : str.toLowerCase().endsWith(condition.value.toLowerCase());
    }

    case 'gt': {
      if (!exists || value === null || value === undefined) return false;
      if (typeof value === 'number') {
        const target = Number(condition.value);
        if (Number.isNaN(target) || condition.value.trim() === '') return false;
        return value > target;
      }
      if (typeof value === 'string') {
        const valNum = Number(value);
        const targetNum = Number(condition.value);
        if (
          value.trim() !== '' &&
          condition.value.trim() !== '' &&
          !Number.isNaN(valNum) &&
          !Number.isNaN(targetNum)
        ) {
          return valNum > targetNum;
        }
        return cs
          ? value > condition.value
          : value.toLowerCase() > condition.value.toLowerCase();
      }
      return false;
    }

    case 'lt': {
      if (!exists || value === null || value === undefined) return false;
      if (typeof value === 'number') {
        const target = Number(condition.value);
        if (Number.isNaN(target) || condition.value.trim() === '') return false;
        return value < target;
      }
      if (typeof value === 'string') {
        const valNum = Number(value);
        const targetNum = Number(condition.value);
        if (
          value.trim() !== '' &&
          condition.value.trim() !== '' &&
          !Number.isNaN(valNum) &&
          !Number.isNaN(targetNum)
        ) {
          return valNum < targetNum;
        }
        return cs
          ? value < condition.value
          : value.toLowerCase() < condition.value.toLowerCase();
      }
      return false;
    }

    default:
      return true;
  }
}

export function matchesGlobalSearch(
  record: JsonlRecord,
  query: string,
  searchField: string,
  caseSensitive: boolean
): boolean {
  if (!query) return true;
  const needle = caseSensitive ? query : query.toLowerCase();

  if (searchField.trim()) {
    const { exists, value } = resolveJsonPath(record.parsedValue, searchField);
    if (!exists) return false;
    const text = stringifyForSearch(value);
    return caseSensitive
      ? text.includes(needle)
      : text.toLowerCase().includes(needle);
  }

  const raw = record.rawContent;
  return caseSensitive
    ? raw.includes(needle)
    : raw.toLowerCase().includes(needle);
}

/**
 * Filters valid records by global/field search and multi-condition AND/OR JSON path rules.
 */
export function filterRecords(
  validRecords: JsonlRecord[],
  config: SearchFilterConfig
): JsonlRecord[] {
  const hasSearch = config.globalQuery.length > 0;
  const activeConditions = config.conditions.filter((c) => c.path.trim().length > 0);

  if (!hasSearch && activeConditions.length === 0) {
    return validRecords;
  }

  return validRecords.filter((rec) => {
    if (
      hasSearch &&
      !matchesGlobalSearch(
        rec,
        config.globalQuery,
        config.searchField,
        config.caseSensitive
      )
    ) {
      return false;
    }

    if (activeConditions.length === 0) {
      return true;
    }

    if (config.combinator === 'OR') {
      return activeConditions.some((cond) =>
        evaluateCondition(rec, cond, config.caseSensitive)
      );
    }

    return activeConditions.every((cond) =>
      evaluateCondition(rec, cond, config.caseSensitive)
    );
  });
}

const TYPE_SORT_RANK: Record<JsonValueType, number> = {
  number: 1,
  boolean: 2,
  string: 3,
  array: 4,
  object: 5,
  null: 6,
  missing: 7,
};

/**
 * Data-type-aware comparator (FR-031):
 * - Numbers compare numerically (2 < 10)
 * - Booleans compare false < true
 * - Strings compare case-insensitively
 * - Missing and null values sink to the bottom
 */
export function compareValues(a: unknown, b: unknown, direction: 'asc' | 'desc'): number {
  const aMissing = a === undefined || a === null;
  const bMissing = b === undefined || b === null;

  if (aMissing && bMissing) {
    if (a === b) return 0;
    return a === null ? -1 : 1;
  }
  if (aMissing) return 1;
  if (bMissing) return -1;

  const mult = direction === 'asc' ? 1 : -1;
  const typeA = detectValueType(a);
  const typeB = detectValueType(b);

  if (typeA === 'number' && typeB === 'number') {
    const diff = (a as number) - (b as number);
    return diff === 0 ? 0 : diff > 0 ? mult : -mult;
  }

  if (typeA === 'boolean' && typeB === 'boolean') {
    if (a === b) return 0;
    return (a ? 1 : -1) * mult;
  }

  if (typeA === 'string' && typeB === 'string') {
    const cmp = (a as string).localeCompare(b as string, undefined, {
      sensitivity: 'base',
    });
    return cmp * mult;
  }

  if (typeA !== typeB) {
    return (TYPE_SORT_RANK[typeA] - TYPE_SORT_RANK[typeB]) * mult;
  }

  const strA = stringifyForSearch(a);
  const strB = stringifyForSearch(b);
  return strA.localeCompare(strB) * mult;
}

export function sortRecords(
  records: JsonlRecord[],
  sort: SortConfig | null
): JsonlRecord[] {
  if (!sort) return records;

  const copy = [...records];

  if (sort.field === '__lineNumber') {
    const mult = sort.direction === 'asc' ? 1 : -1;
    copy.sort((a, b) => (a.lineNumber - b.lineNumber) * mult);
    return copy;
  }

  if (sort.field === '__byteSize') {
    const mult = sort.direction === 'asc' ? 1 : -1;
    copy.sort((a, b) => (a.byteSize - b.byteSize) * mult);
    return copy;
  }

  copy.sort((a, b) => {
    const resA = resolveJsonPath(a.parsedValue, sort.field);
    const resB = resolveJsonPath(b.parsedValue, sort.field);
    const cmp = compareValues(
      resA.exists ? resA.value : undefined,
      resB.exists ? resB.value : undefined,
      sort.direction
    );
    if (cmp !== 0) return cmp;
    return a.lineNumber - b.lineNumber;
  });

  return copy;
}
