import { detectValueType } from './parser';
import type { FieldSchemaInfo, JsonlRecord, JsonValueType } from './types';

export type PathToken = string | number;

/**
 * Parses a JSON field path like:
 *   user.name
 *   metadata.status
 *   messages[0].role
 *   items[2]["key.with.dots"]
 *   [0].value
 *   $ (root value)
 */
export function parsePathTokens(rawPath: string): PathToken[] {
  const path = rawPath.trim();
  if (!path || path === '$') return [];

  const tokens: PathToken[] = [];
  let i = 0;
  const len = path.length;

  if (path[0] === '$') {
    i = 1;
    if (path[i] === '.') i += 1;
  }

  while (i < len) {
    const ch = path[i];

    if (ch === '.') {
      i += 1;
      continue;
    }

    if (ch === '[') {
      i += 1;
      if (i < len && (path[i] === '"' || path[i] === "'")) {
        const quote = path[i];
        i += 1;
        let key = '';
        while (i < len && path[i] !== quote) {
          if (path[i] === '\\' && i + 1 < len) {
            i += 1;
          }
          key += path[i];
          i += 1;
        }
        if (path[i] === quote) i += 1;
        if (path[i] === ']') i += 1;
        tokens.push(key);
      } else {
        let idxStr = '';
        while (i < len && path[i] !== ']') {
          idxStr += path[i];
          i += 1;
        }
        if (path[i] === ']') i += 1;
        const trimmed = idxStr.trim();
        const asNum = Number(trimmed);
        if (trimmed !== '' && Number.isInteger(asNum) && asNum >= 0) {
          tokens.push(asNum);
        } else if (trimmed !== '') {
          tokens.push(trimmed);
        }
      }
      continue;
    }

    let segment = '';
    while (i < len && path[i] !== '.' && path[i] !== '[') {
      segment += path[i];
      i += 1;
    }
    if (segment.length > 0) {
      tokens.push(segment);
    }
  }

  return tokens;
}

export interface PathResolution {
  exists: boolean;
  value: unknown;
}

/**
 * Safely resolves a nested JSON path against any parsed JSON value.
 * Never throws; returns `{ exists: false, value: undefined }` when any step is missing.
 */
export function resolveJsonPath(root: unknown, rawPath: string): PathResolution {
  const trimmed = rawPath.trim();
  if (!trimmed || trimmed === '$' || trimmed === '$value') {
    return { exists: root !== undefined, value: root };
  }

  const tokens = parsePathTokens(trimmed);
  if (tokens.length === 0) {
    return { exists: root !== undefined, value: root };
  }

  let current: unknown = root;

  for (const token of tokens) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return { exists: false, value: undefined };
    }

    if (Array.isArray(current)) {
      if (typeof token === 'number') {
        if (token < 0 || token >= current.length) {
          return { exists: false, value: undefined };
        }
        current = current[token];
      } else {
        const idx = Number(token);
        if (!Number.isInteger(idx) || idx < 0 || idx >= current.length) {
          return { exists: false, value: undefined };
        }
        current = current[idx];
      }
    } else {
      const recordObj = current as Record<string, unknown>;
      const key = String(token);
      if (!Object.prototype.hasOwnProperty.call(recordObj, key)) {
        return { exists: false, value: undefined };
      }
      current = recordObj[key];
    }
  }

  return { exists: true, value: current };
}

/**
 * Formats a child path segment from parent path and key/index.
 */
export function joinJsonPath(parentPath: string, key: string | number): string {
  if (typeof key === 'number') {
    return parentPath ? `${parentPath}[${key}]` : `[${key}]`;
  }
  const needsBracket = /[.[\]\s"']/.test(key) || key.length === 0;
  if (needsBracket) {
    const escaped = key.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return parentPath ? `${parentPath}["${escaped}"]` : `["${escaped}"]`;
  }
  return parentPath ? `${parentPath}.${key}` : key;
}

/**
 * Discovers union of top-level table columns and nested field paths across valid records.
 */
export function discoverSchema(
  validRecords: JsonlRecord[],
  options?: { maxDepth?: number; maxArrayElements?: number; maxPaths?: number }
): { columns: string[]; fieldPaths: FieldSchemaInfo[] } {
  const maxDepth = options?.maxDepth ?? 4;
  const maxArrayElements = options?.maxArrayElements ?? 3;
  const maxPaths = options?.maxPaths ?? 500;

  const columnSet = new Set<string>();
  const pathStats = new Map<
    string,
    {
      count: number;
      types: Partial<Record<Exclude<JsonValueType, 'missing'>, number>>;
    }
  >();

  let hasNonObjectRoot = false;

  const recordPath = (path: string, val: unknown) => {
    if (pathStats.size >= maxPaths && !pathStats.has(path)) return;
    const type = detectValueType(val) as Exclude<JsonValueType, 'missing'>;
    let entry = pathStats.get(path);
    if (!entry) {
      entry = { count: 0, types: {} };
      pathStats.set(path, entry);
    }
    entry.count += 1;
    entry.types[type] = (entry.types[type] ?? 0) + 1;
  };

  const walk = (value: unknown, prefix: string, depth: number) => {
    if (depth > maxDepth || value === null || typeof value !== 'object') return;

    if (Array.isArray(value)) {
      const limit = Math.min(value.length, maxArrayElements);
      for (let i = 0; i < limit; i++) {
        const childPath = joinJsonPath(prefix, i);
        const item = value[i];
        recordPath(childPath, item);
        if (item !== null && typeof item === 'object') {
          walk(item, childPath, depth + 1);
        }
      }
      return;
    }

    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    for (const key of keys) {
      const childPath = joinJsonPath(prefix, key);
      const val = obj[key];
      recordPath(childPath, val);
      if (val !== null && typeof val === 'object') {
        walk(val, childPath, depth + 1);
      }
    }
  };

  for (const rec of validRecords) {
    const val = rec.parsedValue;
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      const obj = val as Record<string, unknown>;
      for (const key of Object.keys(obj)) {
        columnSet.add(key);
      }
      walk(obj, '', 1);
    } else {
      hasNonObjectRoot = true;
      recordPath('$value', val);
      if (Array.isArray(val)) {
        walk(val, '', 1);
      }
    }
  }

  const columns = Array.from(columnSet);
  if (hasNonObjectRoot && !columnSet.has('$value')) {
    columns.push('$value');
  }

  const fieldPaths: FieldSchemaInfo[] = [];
  for (const [path, stat] of pathStats.entries()) {
    let dominantType: Exclude<JsonValueType, 'missing'> = 'string';
    let maxCount = -1;
    for (const [t, c] of Object.entries(stat.types)) {
      if ((c ?? 0) > maxCount) {
        maxCount = c ?? 0;
        dominantType = t as Exclude<JsonValueType, 'missing'>;
      }
    }
    fieldPaths.push({
      path,
      dominantType,
      types: stat.types,
      count: stat.count,
    });
  }

  fieldPaths.sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));

  return { columns, fieldPaths };
}
