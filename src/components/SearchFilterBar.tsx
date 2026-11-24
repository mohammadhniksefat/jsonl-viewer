import { useState } from 'react';
import {
  Columns3,
  Download,
  Filter,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import {
  FILTER_OPERATORS,
  isOperatorAllowedForType,
} from '../core/queryEngine';
import { formatNumber } from '../core/formatters';
import type {
  ExplorerViewMode,
  FieldSchemaInfo,
  FilterCombinator,
  FilterCondition,
  FilterOperator,
  SearchFilterConfig,
} from '../core/types';

interface SearchFilterBarProps {
  config: SearchFilterConfig;
  onChangeConfig: (next: SearchFilterConfig) => void;
  onResetFilters: () => void;
  fieldPaths: FieldSchemaInfo[];
  allColumns: string[];
  visibleColumns: string[];
  onToggleColumn: (col: string) => void;
  onResetColumns: () => void;
  viewMode: ExplorerViewMode;
  onChangeViewMode: (mode: ExplorerViewMode) => void;
  filteredCount: number;
  totalValidCount: number;
  selectedCount: number;
  onClearSelection: () => void;
  onOpenExport: () => void;
  isFilterPanelOpen: boolean;
  onToggleFilterPanel: () => void;
}

export function SearchFilterBar({
  config,
  onChangeConfig,
  onResetFilters,
  fieldPaths,
  allColumns,
  visibleColumns,
  onToggleColumn,
  onResetColumns,
  viewMode,
  onChangeViewMode,
  filteredCount,
  totalValidCount,
  selectedCount,
  onClearSelection,
  onOpenExport,
  isFilterPanelOpen,
  onToggleFilterPanel,
}: SearchFilterBarProps) {
  const [columnsOpen, setColumnsOpen] = useState(false);

  const activeConditionCount = config.conditions.filter((c) => c.path.trim().length > 0).length;
  const hasAnyFilter =
    config.globalQuery.length > 0 || activeConditionCount > 0;

  const getFieldType = (path: string) => {
    const found = fieldPaths.find((f) => f.path === path.trim());
    return found?.dominantType;
  };

  const handleAddCondition = () => {
    const defaultPath = fieldPaths[0]?.path ?? '';
    const defaultType = fieldPaths[0]?.dominantType;
    const defaultOp: FilterOperator =
      defaultType === 'number'
        ? 'gt'
        : defaultType === 'object' || defaultType === 'array'
          ? 'contains'
          : 'equals';
    const nextCond: FilterCondition = {
      id: `cond_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      path: defaultPath,
      operator: defaultOp,
      value: '',
    };
    onChangeConfig({
      ...config,
      conditions: [...config.conditions, nextCond],
    });
  };

  const handleUpdateCondition = (id: string, patch: Partial<FilterCondition>) => {
    const nextConditions = config.conditions.map((cond) => {
      if (cond.id !== id) return cond;
      const updated = { ...cond, ...patch };
      // Ensure operator remains valid for inferred field data type (FR-026)
      if (patch.path !== undefined) {
        const inferredType = getFieldType(patch.path);
        if (inferredType && !isOperatorAllowedForType(updated.operator, inferredType)) {
          const fallback = FILTER_OPERATORS.find((op) =>
            isOperatorAllowedForType(op.id, inferredType)
          );
          if (fallback) updated.operator = fallback.id;
        }
      }
      return updated;
    });
    onChangeConfig({ ...config, conditions: nextConditions });
  };

  const handleRemoveCondition = (id: string) => {
    onChangeConfig({
      ...config,
      conditions: config.conditions.filter((c) => c.id !== id),
    });
  };

  const handleCombinatorChange = (combinator: FilterCombinator) => {
    onChangeConfig({ ...config, combinator });
  };

  return (
    <div className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {/* Main Toolbar Row */}
      <div className="flex flex-col gap-2.5 px-4 py-2.5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Global Search + Field Scope + Case Sensitivity + Filter Toggle */}
        <div className="flex flex-wrap items-center gap-2 lg:min-w-0 lg:flex-1">
          <div className="relative flex w-full items-center sm:w-auto sm:min-w-[220px] sm:flex-1 sm:max-w-md">
            <Search
              className="pointer-events-none absolute left-2.5 h-4 w-4 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={config.globalQuery}
              onChange={(e) =>
                onChangeConfig({ ...config, globalQuery: e.target.value })
              }
              placeholder={
                config.searchField
                  ? `Search in ${config.searchField}...`
                  : 'Search across all valid records...'
              }
              aria-label="Search records"
              className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-20 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:bg-slate-900"
            />
            <div className="absolute right-1.5 flex items-center gap-1">
              {config.globalQuery && (
                <button
                  type="button"
                  onClick={() => onChangeConfig({ ...config, globalQuery: '' })}
                  aria-label="Clear search query"
                  className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                aria-pressed={config.caseSensitive}
                onClick={() =>
                  onChangeConfig({
                    ...config,
                    caseSensitive: !config.caseSensitive,
                  })
                }
                title="Toggle case-sensitive search"
                aria-label="Case sensitive search"
                className={`rounded px-1.5 py-0.5 font-mono text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  config.caseSensitive
                    ? 'bg-blue-600 text-white dark:bg-blue-500'
                    : 'text-slate-500 hover:bg-slate-200 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Aa
              </button>
            </div>
          </div>

          {/* Field-scoped search selector (FR-024) */}
          <select
            aria-label="Search scope field"
            value={config.searchField}
            onChange={(e) =>
              onChangeConfig({ ...config, searchField: e.target.value })
            }
            className="h-9 max-w-[165px] rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value="">All Fields</option>
            {fieldPaths.slice(0, 80).map((f) => (
              <option key={f.path} value={f.path}>
                {f.path}
              </option>
            ))}
          </select>

          {/* Filter Builder Toggle */}
          <button
            type="button"
            aria-expanded={isFilterPanelOpen}
            onClick={onToggleFilterPanel}
            className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              isFilterPanelOpen || activeConditionCount > 0
                ? 'border-blue-500/60 bg-blue-50 text-blue-700 dark:border-blue-400/50 dark:bg-blue-950/50 dark:text-blue-300'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <Filter className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Filters</span>
            {activeConditionCount > 0 && (
              <span className="font-mono tabular-nums">({activeConditionCount})</span>
            )}
          </button>

          {hasAnyFilter && (
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex h-9 items-center gap-1 rounded-md px-2.5 text-xs font-medium text-slate-600 whitespace-nowrap transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Right: View Switcher + Columns + Export */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Explorer View Switcher (FR-021) */}
          <div
            role="group"
            aria-label="Explorer view mode"
            className="flex items-center rounded-md border border-slate-200 bg-slate-100/80 p-0.5 dark:border-slate-700 dark:bg-slate-800/80"
          >
            {(
              [
                { id: 'table', label: 'Table' },
                { id: 'tree', label: 'Tree' },
                { id: 'raw', label: 'Raw' },
              ] as const
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                aria-pressed={viewMode === mode.id}
                onClick={() => onChangeViewMode(mode.id)}
                className={`rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  viewMode === mode.id
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-50'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {/* Column Visibility Picker (Table view only) */}
          {viewMode === 'table' && allColumns.length > 0 && (
            <div className="relative">
              <button
                type="button"
                aria-expanded={columnsOpen}
                onClick={() => setColumnsOpen((o) => !o)}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 whitespace-nowrap transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Columns3 className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Columns</span>
                <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {visibleColumns.length}/{allColumns.length}
                </span>
              </button>

              {columnsOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setColumnsOpen(false)}
                    aria-hidden="true"
                  />
                  <div className="absolute right-0 z-30 mt-1.5 w-60 rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                    <div className="mb-1.5 flex items-center justify-between border-b border-slate-100 px-2 pb-1.5 dark:border-slate-800">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Visible Columns
                      </span>
                      <button
                        type="button"
                        onClick={onResetColumns}
                        className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Show all
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto py-1">
                      {allColumns.map((col) => {
                        const checked = visibleColumns.includes(col);
                        return (
                          <label
                            key={col}
                            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => onToggleColumn(col)}
                              className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
                            />
                            <span className="truncate font-mono">{col}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Export CTA */}
          <button
            type="button"
            onClick={onOpenExport}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 whitespace-nowrap transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Filter Result Summary Bar (FR-029) */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-1.5 text-xs text-slate-600 sm:px-6 dark:border-slate-800/80 dark:bg-slate-950/40 dark:text-slate-400">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="tabular-nums" data-testid="filter-result-count">
            Showing{' '}
            <strong className="font-mono font-semibold text-slate-900 dark:text-slate-100">
              {formatNumber(filteredCount)}
            </strong>{' '}
            of{' '}
            <strong className="font-mono font-semibold text-slate-900 dark:text-slate-100">
              {formatNumber(totalValidCount)}
            </strong>{' '}
            valid records
          </span>
          {hasAnyFilter && (
            <>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
              <span className="text-blue-700 dark:text-blue-400">Filtered view active</span>
            </>
          )}
        </div>

        {selectedCount > 0 && (
          <div className="flex items-center gap-2.5">
            <span className="font-mono tabular-nums font-medium text-slate-800 dark:text-slate-200">
              {formatNumber(selectedCount)} selected
            </span>
            <button
              type="button"
              onClick={onClearSelection}
              className="text-xs text-slate-500 underline underline-offset-2 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Clear selection
            </button>
          </div>
        )}
      </div>

      {/* Collapsible Multi-Condition JSON Path Filter Builder (FR-025, FR-026, FR-027, FR-028) */}
      {isFilterPanelOpen && (
        <section
          aria-label="Filter conditions"
          className="border-t border-slate-200 bg-slate-50/90 px-4 py-3 sm:px-6 dark:border-slate-800 dark:bg-slate-950/70"
        >
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                <span>JSON Path Filter Conditions</span>
              </span>

              {config.conditions.length > 1 && (
                <div
                  role="group"
                  aria-label="Condition combinator"
                  className="flex items-center rounded border border-slate-200 bg-white p-0.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                >
                  {(['AND', 'OR'] as const).map((comb) => (
                    <button
                      key={comb}
                      type="button"
                      aria-pressed={config.combinator === comb}
                      onClick={() => handleCombinatorChange(comb)}
                      className={`rounded px-2 py-0.5 font-mono text-[11px] font-semibold transition-colors ${
                        config.combinator === comb
                          ? 'bg-blue-600 text-white dark:bg-blue-500'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      {comb}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddCondition}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 whitespace-nowrap transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Add Condition</span>
              </button>
              {config.conditions.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChangeConfig({ ...config, conditions: [] })}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          <datalist id="jsonl-field-paths">
            {fieldPaths.map((f) => (
              <option key={f.path} value={f.path} />
            ))}
          </datalist>

          {config.conditions.length === 0 ? (
            <p className="py-2 text-xs text-slate-500 dark:text-slate-400">
              No filter rules yet. Click <strong className="font-medium text-slate-700 dark:text-slate-300">Add Condition</strong> to filter by nested paths like{' '}
              <code className="text-slate-700 dark:text-slate-300">user.name</code>,{' '}
              <code className="text-slate-700 dark:text-slate-300">metadata.status</code>, or{' '}
              <code className="text-slate-700 dark:text-slate-300">messages[0].role</code>.
            </p>
          ) : (
            <div className="space-y-2">
              {config.conditions.map((cond, index) => {
                const inferredType = getFieldType(cond.path);
                const opDef = FILTER_OPERATORS.find((o) => o.id === cond.operator);
                const needsValue = opDef?.needsValue ?? true;

                return (
                  <div
                    key={cond.id}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <span className="w-10 shrink-0 font-mono text-[11px] font-medium text-slate-400">
                      {index === 0 ? 'WHERE' : config.combinator}
                    </span>

                    <div className="relative flex min-w-[200px] flex-1 max-w-xs items-center">
                      <input
                        type="text"
                        list="jsonl-field-paths"
                        value={cond.path}
                        onChange={(e) =>
                          handleUpdateCondition(cond.id, { path: e.target.value })
                        }
                        placeholder="Field path (e.g. user.role, messages[0].role)"
                        aria-label={`Filter condition ${index + 1} field path`}
                        className="h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 pr-16 font-mono text-xs text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                      {inferredType && (
                        <span className="pointer-events-none absolute right-2 font-mono text-[10px] text-slate-400">
                          {inferredType}
                        </span>
                      )}
                    </div>

                    <select
                      aria-label={`Filter condition ${index + 1} operator`}
                      value={cond.operator}
                      onChange={(e) =>
                        handleUpdateCondition(cond.id, {
                          operator: e.target.value as FilterOperator,
                        })
                      }
                      className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      {FILTER_OPERATORS.map((op) => {
                        const allowed = isOperatorAllowedForType(op.id, inferredType);
                        return (
                          <option key={op.id} value={op.id} disabled={!allowed}>
                            {op.label}
                            {!allowed ? ' (N/A)' : ''}
                          </option>
                        );
                      })}
                    </select>

                    {needsValue && (
                      <input
                        type="text"
                        value={cond.value}
                        onChange={(e) =>
                          handleUpdateCondition(cond.id, { value: e.target.value })
                        }
                        placeholder="Value..."
                        aria-label={`Filter condition ${index + 1} value`}
                        className="h-8 min-w-[160px] flex-1 max-w-xs rounded-md border border-slate-200 bg-white px-2.5 font-mono text-xs text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    )}

                    <button
                      type="button"
                      onClick={() => handleRemoveCondition(cond.id)}
                      aria-label={`Remove filter condition ${index + 1}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:bg-slate-800 dark:hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
