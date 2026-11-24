import { useState } from 'react';
import { ChevronLeft, ChevronRight, FileJson, Filter, X } from 'lucide-react';
import { formatBytes, formatCellPreview } from '../core/formatters';
import { detectValueType } from '../core/parser';
import { JsonSyntaxView } from './JsonSyntaxView';
import { JsonTreeView } from './JsonTreeView';
import type { ExplorerViewMode, JsonlRecord } from '../core/types';

interface RecordDetailPanelProps {
  record: JsonlRecord | null;
  recordIndex: number; // 0-based index in filtered list, -1 if none
  totalRecords: number;
  onNavigateIndex: (nextIndex: number) => void;
  onClose: () => void;
  onFilterByPath: (path: string, value: unknown) => void;
}

export function RecordDetailPanel({
  record,
  recordIndex,
  totalRecords,
  onNavigateIndex,
  onClose,
  onFilterByPath,
}: RecordDetailPanelProps) {
  const [innerMode, setInnerMode] = useState<ExplorerViewMode>('tree');

  if (!record) {
    return (
      <aside
        aria-label="Record details"
        className="hidden w-96 shrink-0 flex-col items-center justify-center border-l border-slate-200 bg-slate-50/70 p-8 text-center xl:flex dark:border-slate-800 dark:bg-slate-900/50"
      >
        <FileJson className="mb-3 h-7 w-7 text-slate-300 dark:text-slate-700" aria-hidden="true" />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          No record selected
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          Select any row in the table to inspect its nested JSON tree, field table, or syntax-highlighted raw JSON.
        </p>
      </aside>
    );
  }

  const isObj =
    record.parsedValue !== null &&
    typeof record.parsedValue === 'object' &&
    !Array.isArray(record.parsedValue);

  const tableEntries: Array<[string, unknown]> = isObj
    ? Object.entries(record.parsedValue as Record<string, unknown>)
    : Array.isArray(record.parsedValue)
      ? record.parsedValue.map((item, idx) => [`[${idx}]`, item])
      : [['$value', record.parsedValue]];

  return (
    <aside
      aria-label="Record detail panel"
      data-testid="record-detail-panel"
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-xl lg:static lg:z-auto lg:w-[440px] lg:max-w-none lg:shrink-0 lg:shadow-none xl:w-[480px] dark:border-slate-800 dark:bg-slate-900"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-50">
              Line #{record.lineNumber}
            </h2>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
            <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
              {record.rootType}
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
            <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {formatBytes(record.byteSize)}
            </span>
          </div>
          {recordIndex >= 0 && (
            <p className="mt-0.5 font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
              Record {recordIndex + 1} of {totalRecords}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            disabled={recordIndex <= 0}
            onClick={() => onNavigateIndex(recordIndex - 1)}
            aria-label="Previous record"
            title="Previous record"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={recordIndex < 0 || recordIndex >= totalRecords - 1}
            onClick={() => onNavigateIndex(recordIndex + 1)}
            aria-label="Next record"
            title="Next record"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close record detail panel"
            className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Inner Mode Switcher: Tree | Raw JSON | Table (FR-020) */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 py-2 dark:border-slate-800 dark:bg-slate-950/40">
        <div
          role="tablist"
          aria-label="Record inspector view"
          className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800"
        >
          {(
            [
              { id: 'tree', label: 'Tree' },
              { id: 'raw', label: 'Raw JSON' },
              { id: 'table', label: 'Table' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={innerMode === tab.id}
              onClick={() => setInnerMode(tab.id)}
              className={`rounded px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                innerMode === tab.id
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-50'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {innerMode === 'tree' && (
          <JsonTreeView
            key={record.lineNumber}
            value={record.parsedValue}
            defaultExpandDepth={2}
            onFilterByPath={onFilterByPath}
          />
        )}

        {innerMode === 'raw' && (
          <JsonSyntaxView
            value={record.parsedValue}
            rawText={record.rawContent}
            defaultPretty={true}
            showControls={true}
          />
        )}

        {innerMode === 'table' && (
          <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Field</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Value</th>
                  <th className="w-8 px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {tableEntries.map(([key, val]) => {
                  const type = detectValueType(val);
                  const preview = formatCellPreview(val, 140);
                  return (
                    <tr
                      key={key}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="align-top px-3 py-2 font-mono font-medium text-sky-700 dark:text-sky-300">
                        {key}
                      </td>
                      <td className="align-top px-3 py-2 font-mono text-[11px] text-slate-400">
                        {type}
                      </td>
                      <td className="align-top break-all px-3 py-2 font-mono text-slate-800 dark:text-slate-200">
                        {preview.isSummary ? JSON.stringify(val) : preview.text}
                      </td>
                      <td className="align-top px-2 py-2">
                        <button
                          type="button"
                          onClick={() => onFilterByPath(key, val)}
                          title={`Filter by ${key}`}
                          aria-label={`Filter by ${key}`}
                          className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-blue-600 dark:hover:bg-slate-700 dark:hover:text-blue-400"
                        >
                          <Filter className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </aside>
  );
}
