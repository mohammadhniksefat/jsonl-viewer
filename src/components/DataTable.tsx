import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  SearchX,
} from 'lucide-react';
import { formatBytes, formatCellPreview, formatNumber } from '../core/formatters';
import { JsonSyntaxView } from './JsonSyntaxView';
import { JsonTreeView } from './JsonTreeView';
import type {
  ExplorerViewMode,
  JsonlRecord,
  SortConfig,
} from '../core/types';

interface DataTableProps {
  records: JsonlRecord[];
  totalValidRecords: number;
  columns: string[];
  viewMode: ExplorerViewMode;
  sort: SortConfig | null;
  onToggleSort: (field: string) => void;
  page: number;
  pageSize: number;
  onPageChange: (nextPage: number) => void;
  onPageSizeChange: (nextSize: number) => void;
  selectedLineNumber: number | null;
  onSelectRecord: (record: JsonlRecord) => void;
  checkedLineNumbers: Set<number>;
  onToggleCheckRecord: (lineNumber: number) => void;
  onToggleCheckPage: (pageRecords: JsonlRecord[]) => void;
  hasActiveFilter: boolean;
  onResetFilters: () => void;
  onFilterByPath: (path: string, value: unknown) => void;
}

const ROW_HEIGHT = 40;
const OVERSCAN = 8;
const PAGE_SIZES = [25, 50, 100, 250];

export function DataTable({
  records,
  totalValidRecords,
  columns,
  viewMode,
  sort,
  onToggleSort,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  selectedLineNumber,
  onSelectRecord,
  checkedLineNumbers,
  onToggleCheckRecord,
  onToggleCheckPage,
  hasActiveFilter,
  onResetFilters,
  onFilterByPath,
}: DataTableProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const [jumpInput, setJumpInput] = useState('');

  const totalPages = Math.max(1, Math.ceil(records.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const pageRecords = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return records.slice(start, start + pageSize);
  }, [records, safePage, pageSize]);

  // Reset vertical scroll when page or viewMode changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
      setScrollTop(0);
    }
  }, [safePage, pageSize, viewMode]);

  // Measure scroll viewport height for virtualized table rendering
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const updateHeight = () => setViewportHeight(el.clientHeight || 600);
    updateHeight();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(updateHeight);
      ro.observe(el);
      return () => ro.disconnect();
    }
    return undefined;
  }, [viewMode]);

  const allOnPageChecked =
    pageRecords.length > 0 &&
    pageRecords.every((r) => checkedLineNumbers.has(r.lineNumber));

  // Virtual window calculation for Table view
  const totalHeight = pageRecords.length * ROW_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(
    pageRecords.length,
    Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN
  );
  const visibleRows = pageRecords.slice(startIndex, endIndex);
  const paddingTop = startIndex * ROW_HEIGHT;
  const paddingBottom = Math.max(0, (pageRecords.length - endIndex) * ROW_HEIGHT);

  // Direct Jump to Record # (FR-033)
  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(jumpInput.trim());
    if (!Number.isInteger(num) || num < 1 || num > records.length) return;
    const targetIndex = num - 1;
    const targetPage = Math.floor(targetIndex / pageSize) + 1;
    onPageChange(targetPage);
    onSelectRecord(records[targetIndex]);
    setJumpInput('');
  };

  // Empty States (FR-006, 4.5 No search results / No matching records)
  if (records.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500">
          <SearchX className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          {totalValidRecords === 0
            ? 'No valid JSON records found'
            : hasActiveFilter
              ? 'No matching records'
              : 'File is empty'}
        </h2>
        <p className="mt-1.5 max-w-md text-sm text-slate-500 dark:text-slate-400">
          {totalValidRecords === 0
            ? 'This file contains no valid JSON documents. Check the Validation tab for syntax errors or blank line counts.'
            : 'No records match your current search query or filter conditions.'}
        </p>
        {hasActiveFilter && (
          <button
            type="button"
            onClick={onResetFilters}
            className="mt-5 rounded-md bg-blue-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Reset Filters
          </button>
        )}
      </div>
    );
  }

  const renderSortIcon = (field: string) => {
    if (!sort || sort.field !== field) {
      return <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-60" aria-hidden="true" />;
    }
    return sort.direction === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-blue-600 dark:text-blue-400" aria-hidden="true" />
    ) : (
      <ArrowDown className="h-3 w-3 text-blue-600 dark:text-blue-400" aria-hidden="true" />
    );
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white dark:bg-slate-950">
      {/* Main Viewport: Table (Virtualized) | Tree List | Raw List */}
      <div
        ref={scrollContainerRef}
        onScroll={(e) => {
          if (viewMode === 'table') {
            setScrollTop(e.currentTarget.scrollTop);
          }
        }}
        className="min-h-0 flex-1 overflow-auto"
        data-testid="records-viewport"
      >
        {viewMode === 'table' && (
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              <tr className="h-9">
                <th className="sticky left-0 z-20 w-10 border-r border-slate-200/80 bg-slate-50 px-3 text-center dark:border-slate-800 dark:bg-slate-900">
                  <input
                    type="checkbox"
                    checked={allOnPageChecked}
                    onChange={() => onToggleCheckPage(pageRecords)}
                    aria-label="Select all records on current page"
                    className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
                  />
                </th>
                <th className="sticky left-10 z-20 w-20 border-r border-slate-200/80 bg-slate-50 px-3 font-medium dark:border-slate-800 dark:bg-slate-900">
                  <button
                    type="button"
                    onClick={() => onToggleSort('__lineNumber')}
                    className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                  >
                    <span>Line</span>
                    {renderSortIcon('__lineNumber')}
                  </button>
                </th>
                {columns.map((col) => (
                  <th
                    key={col}
                    className="max-w-[260px] min-w-[120px] border-r border-slate-200/60 px-3 font-medium last:border-r-0 dark:border-slate-800/70"
                  >
                    <button
                      type="button"
                      onClick={() => onToggleSort(col)}
                      className="inline-flex max-w-full items-center gap-1.5 font-mono text-[11px] font-semibold text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                    >
                      <span className="truncate">{col}</span>
                      <span className="shrink-0">{renderSortIcon(col)}</span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody
              style={{ height: totalHeight }}
              className="divide-y divide-slate-100 dark:divide-slate-800/70"
            >
              {paddingTop > 0 && (
                <tr aria-hidden="true" style={{ height: paddingTop }}>
                  <td colSpan={columns.length + 2} />
                </tr>
              )}

              {visibleRows.map((record) => {
                const isSelected = record.lineNumber === selectedLineNumber;
                const isChecked = checkedLineNumbers.has(record.lineNumber);
                const val = record.parsedValue;
                const isObj =
                  val !== null && typeof val === 'object' && !Array.isArray(val);
                const obj = isObj ? (val as Record<string, unknown>) : null;

                return (
                  <tr
                    key={record.lineNumber}
                    style={{ height: ROW_HEIGHT }}
                    onClick={() => onSelectRecord(record)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-50/90 dark:bg-blue-950/50'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-900/70'
                    }`}
                  >
                    <td
                      onClick={(e) => e.stopPropagation()}
                      className={`sticky left-0 z-10 w-10 border-r border-slate-200/70 px-3 text-center dark:border-slate-800/80 ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-950'
                          : 'bg-white dark:bg-slate-950'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onToggleCheckRecord(record.lineNumber)}
                        aria-label={`Select line ${record.lineNumber}`}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
                      />
                    </td>
                    <td
                      className={`sticky left-10 z-10 w-20 border-r border-slate-200/70 px-3 font-mono text-[11px] tabular-nums text-slate-500 dark:border-slate-800/80 dark:text-slate-400 ${
                        isSelected
                          ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                          : 'bg-white dark:bg-slate-950'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectRecord(record);
                        }}
                        aria-label={`Inspect record at line ${record.lineNumber}`}
                        className="w-full text-left focus-visible:outline-none focus-visible:underline"
                      >
                        {record.lineNumber}
                      </button>
                    </td>
                    {columns.map((col) => {
                      const rawCell =
                        col === '$value'
                          ? isObj
                            ? undefined
                            : val
                          : obj && Object.prototype.hasOwnProperty.call(obj, col)
                            ? obj[col]
                            : undefined;

                      const preview = formatCellPreview(rawCell);

                      let cellTone = 'text-slate-800 dark:text-slate-200';
                      if (preview.type === 'missing') {
                        cellTone = 'text-slate-300 dark:text-slate-700';
                      } else if (preview.type === 'null') {
                        cellTone = 'font-mono italic text-rose-600 dark:text-rose-400';
                      } else if (preview.type === 'number') {
                        cellTone = 'font-mono tabular-nums text-amber-700 dark:text-amber-300';
                      } else if (preview.type === 'boolean') {
                        cellTone = 'font-mono text-purple-700 dark:text-purple-300';
                      } else if (preview.isSummary) {
                        cellTone =
                          'font-mono text-blue-700 underline decoration-blue-400/50 underline-offset-2 dark:text-blue-300';
                      }

                      return (
                        <td
                          key={col}
                          className="max-w-[260px] truncate border-r border-slate-100 px-3 last:border-r-0 dark:border-slate-800/50"
                          title={preview.type === 'string' ? String(rawCell) : preview.text}
                        >
                          <span className={cellTone}>{preview.text}</span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              {paddingBottom > 0 && (
                <tr aria-hidden="true" style={{ height: paddingBottom }}>
                  <td colSpan={columns.length + 2} />
                </tr>
              )}
            </tbody>
          </table>
        )}

        {viewMode === 'tree' && (
          <div className="divide-y divide-slate-200 p-4 sm:px-6 dark:divide-slate-800">
            {pageRecords.map((record) => {
              const isSelected = record.lineNumber === selectedLineNumber;
              return (
                <div
                  key={record.lineNumber}
                  className={`py-4 first:pt-1 ${
                    isSelected ? 'bg-blue-50/40 -mx-3 px-3 rounded-lg dark:bg-blue-950/20' : ''
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={checkedLineNumbers.has(record.lineNumber)}
                        onChange={() => onToggleCheckRecord(record.lineNumber)}
                        aria-label={`Select line ${record.lineNumber}`}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => onSelectRecord(record)}
                        className="font-mono font-semibold text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400"
                      >
                        Line #{record.lineNumber}
                      </button>
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                      <span className="font-mono text-slate-500 dark:text-slate-400">
                        {record.rootType}
                      </span>
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                      <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {formatBytes(record.byteSize)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectRecord(record)}
                      className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Inspect
                    </button>
                  </div>
                  <JsonTreeView
                    value={record.parsedValue}
                    defaultExpandDepth={1}
                    onFilterByPath={onFilterByPath}
                  />
                </div>
              );
            })}
          </div>
        )}

        {viewMode === 'raw' && (
          <div className="divide-y divide-slate-200 p-4 sm:px-6 dark:divide-slate-800">
            {pageRecords.map((record) => {
              const isSelected = record.lineNumber === selectedLineNumber;
              return (
                <div
                  key={record.lineNumber}
                  className={`py-4 first:pt-1 ${
                    isSelected ? 'bg-blue-50/40 -mx-3 px-3 rounded-lg dark:bg-blue-950/20' : ''
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={checkedLineNumbers.has(record.lineNumber)}
                        onChange={() => onToggleCheckRecord(record.lineNumber)}
                        aria-label={`Select line ${record.lineNumber}`}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => onSelectRecord(record)}
                        className="font-mono font-semibold text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400"
                      >
                        Line #{record.lineNumber}
                      </button>
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                      <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {formatBytes(record.byteSize)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectRecord(record)}
                      className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Inspect
                    </button>
                  </div>
                  <JsonSyntaxView
                    value={record.parsedValue}
                    rawText={record.rawContent}
                    defaultPretty={false}
                    showControls={false}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination & Direct Record Navigation Footer (FR-032, FR-033, FR-034) */}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/90 px-4 py-2 text-xs text-slate-600 sm:px-6 dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-400">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5">
            <span>Rows per page:</span>
            <select
              aria-label="Rows per page"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-7 rounded border border-slate-200 bg-white px-2 font-mono text-xs text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>

          <form onSubmit={handleJumpSubmit} className="flex items-center gap-1.5">
            <label htmlFor="jump-record-input" className="whitespace-nowrap">
              Go to record #:
            </label>
            <input
              id="jump-record-input"
              type="number"
              min={1}
              max={records.length}
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              placeholder={`1–${records.length}`}
              className="h-7 w-20 rounded border border-slate-200 bg-white px-2 font-mono text-xs tabular-nums text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <button
              type="submit"
              className="h-7 rounded border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Go
            </button>
          </form>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono tabular-nums">
            Page {formatNumber(safePage)} of {formatNumber(totalPages)}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => onPageChange(safePage - 1)}
              aria-label="Previous page"
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => onPageChange(safePage + 1)}
              aria-label="Next page"
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
