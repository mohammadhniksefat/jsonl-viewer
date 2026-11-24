export type ParseStatus = 'valid' | 'invalid' | 'empty';

export type JsonValueType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'array'
  | 'object'
  | 'missing';

export interface JsonlRecord {
  /** 1-based line number in the original source file */
  lineNumber: number;
  /** Raw unmodified line content (without trailing CR/LF) */
  rawContent: string;
  /** Parsed JS value for valid lines, undefined otherwise */
  parsedValue?: unknown;
  /** Parsing outcome */
  parseStatus: ParseStatus;
  /** Parser error message for invalid lines */
  parseError?: string;
  /** UTF-8 byte length of the raw line */
  byteSize: number;
  /** Detected root JSON type for valid records */
  rootType?: Exclude<JsonValueType, 'missing'>;
  /** Extensible metadata bag for future editing/annotation features */
  annotations?: Record<string, unknown>;
}

export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'gt'
  | 'lt'
  | 'exists'
  | 'is_null'
  | 'is_empty';

export type FilterCombinator = 'AND' | 'OR';

export interface FilterCondition {
  id: string;
  path: string;
  operator: FilterOperator;
  value: string;
  caseSensitive?: boolean;
}

export interface SearchFilterConfig {
  globalQuery: string;
  searchField: string; // '' means all fields / full record
  caseSensitive: boolean;
  combinator: FilterCombinator;
  conditions: FilterCondition[];
}

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: string; // '__lineNumber' | '__byteSize' | JSON path
  direction: SortDirection;
}

export interface FieldSchemaInfo {
  path: string;
  dominantType: Exclude<JsonValueType, 'missing'>;
  types: Partial<Record<Exclude<JsonValueType, 'missing'>, number>>;
  count: number;
}

export interface FieldStat {
  field: string;
  dominantType: Exclude<JsonValueType, 'missing'>;
  typeDistribution: Partial<Record<Exclude<JsonValueType, 'missing'>, number>>;
  occurrenceCount: number;
  missingCount: number;
  nullCount: number;
  distinctCount: number;
  distinctCapped: boolean;
}

export interface DatasetStats {
  scope: 'all' | 'filtered';
  totalLines: number;
  validRecords: number;
  invalidRecords: number;
  blankLines: number;
  uniqueFields: number;
  avgRecordSize: number;
  minRecordSize: number;
  maxRecordSize: number;
  fields: FieldStat[];
}

export type LoadingStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ParseProgress {
  bytesRead: number;
  totalBytes: number;
  percent: number;
  linesProcessed: number;
  validCount: number;
  invalidCount: number;
  emptyCount: number;
}

export interface FileSession {
  id: string;
  name: string;
  extension: string;
  size: number;
  lastModified: number;
  /** Original File/Blob kept locally for unmodified Original export */
  sourceFile?: File | Blob;
  status: LoadingStatus;
  errorMessage?: string;
  hasBom?: boolean;
  encodingWarning?: string;
  progress: ParseProgress;
  /** All valid records */
  validRecords: JsonlRecord[];
  /** All invalid lines */
  invalidRecords: JsonlRecord[];
  /** Total lines in file (valid + invalid + blank) */
  totalLines: number;
  /** Count of blank/whitespace-only lines */
  blankLines: number;
  /** Top-level table column keys (union across records) */
  columns: string[];
  /** Discovered field paths (top-level + nested) with inferred types */
  fieldPaths: FieldSchemaInfo[];
}

export type MainSection = 'explorer' | 'statistics' | 'validation';
export type ExplorerViewMode = 'table' | 'tree' | 'raw';
export type ExportFormat = 'jsonl' | 'json' | 'csv';
export type ExportScope = 'original' | 'filtered' | 'selected' | 'all_valid';
