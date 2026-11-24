import test from 'node:test';
import assert from 'node:assert/strict';

import { ChunkLineBuffer, parseJsonlLine, parseJsonlText } from './parser';
import { discoverSchema, joinJsonPath, resolveJsonPath } from './pathResolver';
import {
  filterRecords,
  isOperatorAllowedForType,
  sortRecords,
} from './queryEngine';
import { computeDatasetStatistics } from './statistics';
import { serializeToCsv, serializeToJsonArray, serializeToJsonl } from './exporter';
import type { SearchFilterConfig } from './types';

test('parses valid objects, arrays, primitives, invalid lines, and blank lines preserving original line numbers', () => {
  const input = [
    '{"id": 1, "name": "Alice"}',
    '',
    '{"id": 2, broken_json}',
    '   ',
    '[10, 20, 30]',
    '"plain-string"',
    '42',
    'true',
    'null',
  ].join('\n');

  const res = parseJsonlText(input);
  assert.equal(res.totalLines, 9);
  assert.equal(res.validRecords.length, 6);
  assert.equal(res.invalidRecords.length, 1);
  assert.equal(res.blankLines, 2);

  assert.equal(res.invalidRecords[0].lineNumber, 3);
  assert.ok(res.invalidRecords[0].parseError);
  assert.equal(res.validRecords[1].lineNumber, 5);
  assert.deepEqual(res.validRecords[1].parsedValue, [10, 20, 30]);
  assert.equal(res.validRecords[2].parsedValue, 'plain-string');
  assert.equal(res.validRecords[3].parsedValue, 42);
  assert.equal(res.validRecords[4].parsedValue, true);
  assert.equal(res.validRecords[5].parsedValue, null);
});

test('handles UTF-8 BOM, CRLF, Unicode/Persian strings, and chunk splits across partial lines without trailing newline', () => {
  const full = '\uFEFF{"user":"مریم رضایی","score":98}\r\n{"user":"Ali","bio":"line1\\nline2"}';
  const buf = new ChunkLineBuffer();
  const part1 = full.slice(0, 14);
  const part2 = full.slice(14, 42);
  const part3 = full.slice(42);

  const out = [
    ...buf.pushChunk(part1),
    ...buf.pushChunk(part2),
    ...buf.pushChunk(part3),
    ...buf.flush(),
  ];

  assert.equal(buf.hadBom, true);
  assert.equal(out.length, 2);
  assert.equal(out[0].parseStatus, 'valid');
  assert.equal((out[0].parsedValue as { user: string }).user, 'مریم رضایی');
  assert.equal(out[1].parseStatus, 'valid');
  assert.equal((out[1].parsedValue as { bio: string }).bio, 'line1\nline2');
});

test('handles empty file and blank-only file', () => {
  const empty = parseJsonlText('');
  assert.equal(empty.totalLines, 0);
  assert.equal(empty.validRecords.length, 0);

  const blankOnly = parseJsonlText('\n   \n\t\n');
  assert.equal(blankOnly.validRecords.length, 0);
  assert.equal(blankOnly.invalidRecords.length, 0);
  assert.equal(blankOnly.blankLines, 3);
});

test('resolves nested JSON paths including arrays and dotted bracket keys', () => {
  const sample = {
    user: { name: 'Sara', roles: ['admin', 'editor'] },
    metadata: { status: 'ok', 'x.y': 123 },
    messages: [{ role: 'system' }, { role: 'user', text: 'hello' }],
  };

  assert.deepEqual(resolveJsonPath(sample, 'user.name'), { exists: true, value: 'Sara' });
  assert.deepEqual(resolveJsonPath(sample, 'metadata.status'), { exists: true, value: 'ok' });
  assert.deepEqual(resolveJsonPath(sample, 'messages[1].role'), { exists: true, value: 'user' });
  assert.deepEqual(resolveJsonPath(sample, 'metadata["x.y"]'), { exists: true, value: 123 });
  assert.deepEqual(resolveJsonPath(sample, 'messages[9].role'), { exists: false, value: undefined });
  assert.equal(joinJsonPath('messages', 0), 'messages[0]');
  assert.equal(joinJsonPath('metadata', 'x.y'), 'metadata["x.y"]');
});

test('evaluates global search, case sensitivity, field search, all operators, and AND/OR combinators', () => {
  const { validRecords } = parseJsonlText(
    [
      '{"id":1,"user":{"name":"Sara","role":"admin"},"latency":120,"note":null,"tags":["prod"]}',
      '{"id":2,"user":{"name":"sara","role":"analyst"},"latency":450,"note":"","tags":[]}',
      '{"id":3,"user":{"name":"Daniel","role":"engineer"},"latency":80,"tags":["staging","eval"]}',
    ].join('\n')
  );

  const base: SearchFilterConfig = {
    globalQuery: '',
    searchField: '',
    caseSensitive: false,
    combinator: 'AND',
    conditions: [],
  };

  // Case-insensitive vs case-sensitive global search
  assert.equal(filterRecords(validRecords, { ...base, globalQuery: 'Sara' }).length, 2);
  assert.equal(
    filterRecords(validRecords, { ...base, globalQuery: 'Sara', caseSensitive: true }).length,
    1
  );

  // Field-scoped search
  assert.equal(
    filterRecords(validRecords, { ...base, globalQuery: 'admin', searchField: 'user.role' }).length,
    1
  );

  // Numeric gt / lt
  assert.equal(
    filterRecords(validRecords, {
      ...base,
      conditions: [{ id: '1', path: 'latency', operator: 'gt', value: '100' }],
    }).length,
    2
  );

  // Exists, is_null, is_empty
  assert.equal(
    filterRecords(validRecords, {
      ...base,
      conditions: [{ id: '2', path: 'note', operator: 'is_null', value: '' }],
    }).length,
    1
  );
  assert.equal(
    filterRecords(validRecords, {
      ...base,
      conditions: [{ id: '3', path: 'tags', operator: 'is_empty', value: '' }],
    }).length,
    1
  );

  // AND vs OR combinator
  const multiConds = [
    { id: 'a', path: 'user.role', operator: 'equals' as const, value: 'admin' },
    { id: 'b', path: 'latency', operator: 'lt' as const, value: '100' },
  ];
  assert.equal(
    filterRecords(validRecords, { ...base, combinator: 'AND', conditions: multiConds }).length,
    0
  );
  assert.equal(
    filterRecords(validRecords, { ...base, combinator: 'OR', conditions: multiConds }).length,
    2
  );

  // Operator allow-list by type (FR-026)
  assert.equal(isOperatorAllowedForType('gt', 'number'), true);
  assert.equal(isOperatorAllowedForType('starts_with', 'number'), false);
  assert.equal(isOperatorAllowedForType('contains', 'boolean'), false);
});

test('sorts records with data-type awareness (numeric vs string, nulls last)', () => {
  const { validRecords } = parseJsonlText(
    [
      '{"id": 1, "latency": 100}',
      '{"id": 2, "latency": 20}',
      '{"id": 3, "latency": null}',
      '{"id": 4, "latency": 3}',
    ].join('\n')
  );

  const asc = sortRecords(validRecords, { field: 'latency', direction: 'asc' });
  assert.deepEqual(
    asc.map((r) => (r.parsedValue as { id: number }).id),
    [4, 2, 1, 3]
  );

  const desc = sortRecords(validRecords, { field: 'latency', direction: 'desc' });
  assert.deepEqual(
    desc.map((r) => (r.parsedValue as { id: number }).id),
    [1, 2, 4, 3]
  );
});

test('computes dataset general statistics and mixed-type field distributions', () => {
  const parsed = parseJsonlText(
    [
      '{"a": 1, "b": "hello"}',
      '{"a": "one", "b": null}',
      'bad json',
      '',
      '{"a": 2}',
    ].join('\n')
  );

  const stats = computeDatasetStatistics({
    scope: 'all',
    records: parsed.validRecords,
    totalLines: parsed.totalLines,
    invalidRecords: parsed.invalidRecords.length,
    blankLines: parsed.blankLines,
  });

  assert.equal(stats.totalLines, 5);
  assert.equal(stats.validRecords, 3);
  assert.equal(stats.invalidRecords, 1);
  assert.equal(stats.blankLines, 1);
  assert.equal(stats.uniqueFields, 2);

  const fieldA = stats.fields.find((f) => f.field === 'a')!;
  assert.equal(fieldA.occurrenceCount, 3);
  assert.equal(fieldA.missingCount, 0);
  assert.equal(fieldA.typeDistribution.number, 2);
  assert.equal(fieldA.typeDistribution.string, 1);

  const fieldB = stats.fields.find((f) => f.field === 'b')!;
  assert.equal(fieldB.occurrenceCount, 2);
  assert.equal(fieldB.missingCount, 1);
  assert.equal(fieldB.nullCount, 1);

  const schema = discoverSchema(parsed.validRecords);
  assert.deepEqual(schema.columns, ['a', 'b']);
});

test('serializes JSONL, JSON Array, and CSV while respecting FR-044 invalid record exclusion', () => {
  const valid1 = parseJsonlLine('{"name":"Alice","meta":{"score":10},"note":"a, \\"b\\""}', 1);
  const invalid = parseJsonlLine('{not_valid}', 2);
  const valid2 = parseJsonlLine('{"name":"Bob","tags":[1,2]}', 3);

  const mixed = [valid1, invalid, valid2];

  // Default excludes invalid
  const jsonlDefault = serializeToJsonl(mixed);
  assert.equal(jsonlDefault.split('\n').length, 2);
  for (const line of jsonlDefault.split('\n')) {
    assert.doesNotThrow(() => JSON.parse(line));
  }

  // Explicit includeInvalid preserves raw invalid line
  const jsonlWithInvalid = serializeToJsonl(mixed, { includeInvalid: true });
  assert.equal(jsonlWithInvalid.split('\n').length, 3);
  assert.equal(jsonlWithInvalid.split('\n')[1], '{not_valid}');

  // JSON Array export is valid JSON of valid records
  const jsonArray = serializeToJsonArray(mixed);
  const parsedArr = JSON.parse(jsonArray);
  assert.equal(Array.isArray(parsedArr), true);
  assert.equal(parsedArr.length, 2);

  // CSV export serializes nested objects/arrays as JSON strings and escapes quotes/commas
  const csv = serializeToCsv(mixed, ['name', 'meta', 'note', 'tags']);
  const rows = csv.split('\n');
  assert.equal(rows.length, 3);
  assert.equal(rows[0], 'name,meta,note,tags');
  assert.equal(rows[1], 'Alice,"{""score"":10}","a, ""b""",');
  assert.equal(rows[2], 'Bob,,,"[1,2]"');
});
