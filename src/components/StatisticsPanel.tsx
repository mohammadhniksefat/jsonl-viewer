import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { formatBytes, formatNumber } from '../core/formatters';
import { computeDatasetStatistics } from '../core/statistics';
import type { FileSession, JsonlRecord, JsonValueType } from '../core/types';

interface StatisticsPanelProps {
  session: FileSession;
  filteredRecords: JsonlRecord[];
  hasActiveFilter: boolean;
}

const TYPE_COLORS: Record<Exclude<JsonValueType, 'missing'>, string> = {
  string: 'bg-emerald-500 dark:bg-emerald-400',
  number: 'bg-amber-500 dark:bg-amber-400',
  boolean: 'bg-purple-500 dark:bg-purple-400',
  object: 'bg-blue-500 dark:bg-blue-400',
  array: 'bg-cyan-500 dark:bg-cyan-400',
  null: 'bg-rose-500 dark:bg-rose-400',
};

export function StatisticsPanel({
  session,
  filteredRecords,
  hasActiveFilter,
}: StatisticsPanelProps) {
  const [scope, setScope] = useState<'all' | 'filtered'>(
    hasActiveFilter ? 'filtered' : 'all'
  );
  const [fieldSearch, setFieldSearch] = useState('');

  const effectiveScope: 'all' | 'filtered' = hasActiveFilter ? scope : 'all';

  const stats = useMemo(() => {
    const targetRecords =
      effectiveScope === 'filtered' ? filteredRecords : session.validRecords;
    return computeDatasetStatistics({
      scope: effectiveScope,
      records: targetRecords,
      totalLines: session.totalLines,
      invalidRecords: session.invalidRecords.length,
      blankLines: session.blankLines,
    });
  }, [
    effectiveScope,
    filteredRecords,
    session.validRecords,
    session.totalLines,
    session.invalidRecords.length,
    session.blankLines,
  ]);

  const visibleFields = useMemo(() => {
    const q = fieldSearch.trim().toLowerCase();
    if (!q) return stats.fields;
    return stats.fields.filter(
      (f) =>
        f.field.toLowerCase().includes(q) ||
        f.dominantType.toLowerCase().includes(q)
    );
  }, [stats.fields, fieldSearch]);

  const generalMetrics = [
    {
      label: effectiveScope === 'all' ? 'Total Lines' : 'Matched Records',
      value: formatNumber(stats.totalLines),
    },
    { label: 'Valid Records', value: formatNumber(stats.validRecords) },
    {
      label: 'Invalid Records',
      value: effectiveScope === 'all' ? formatNumber(stats.invalidRecords) : '—',
    },
    {
      label: 'Blank Lines',
      value: effectiveScope === 'all' ? formatNumber(stats.blankLines) : '—',
    },
    { label: 'Unique Fields', value: formatNumber(stats.uniqueFields) },
    { label: 'Average Record Size', value: formatBytes(stats.avgRecordSize) },
    { label: 'Minimum Record Size', value: formatBytes(stats.minRecordSize) },
    { label: 'Maximum Record Size', value: formatBytes(stats.maxRecordSize) },
  ];

  return (
    <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header & Statistics Scope Switcher (FR-038) */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Dataset Statistics
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400" data-testid="stats-scope-label">
              {effectiveScope === 'filtered'
                ? `Scope: Filtered subset (${formatNumber(filteredRecords.length)} of ${formatNumber(session.validRecords.length)} valid records)`
                : `Scope: Entire file (${formatNumber(session.totalLines)} total lines · ${formatNumber(session.validRecords.length)} valid records)`}
            </p>
          </div>

          <div
            role="group"
            aria-label="Statistics scope"
            className="flex items-center rounded-md border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800"
          >
            <button
              type="button"
              aria-pressed={effectiveScope === 'all'}
              onClick={() => setScope('all')}
              className={`rounded px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                effectiveScope === 'all'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-50'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              All Records ({formatNumber(session.validRecords.length)})
            </button>
            <button
              type="button"
              disabled={!hasActiveFilter}
              aria-pressed={effectiveScope === 'filtered'}
              onClick={() => setScope('filtered')}
              className={`rounded px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                effectiveScope === 'filtered'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-50'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              Filtered ({formatNumber(filteredRecords.length)})
            </button>
          </div>
        </div>

        {/* General Statistics Grid (FR-035) */}
        <section aria-label="General dataset statistics">
          <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-slate-200 bg-white sm:grid-cols-4 dark:border-slate-800 dark:bg-slate-900">
            {generalMetrics.map((metric, idx) => (
              <div
                key={metric.label}
                className={`p-4 ${
                  idx % 4 !== 3 ? 'sm:border-r sm:border-slate-200 sm:dark:border-slate-800' : ''
                } ${idx % 2 === 0 ? 'border-r border-slate-200 dark:border-slate-800 sm:border-r' : ''} ${
                  idx < 4 ? 'border-b border-slate-200 dark:border-slate-800' : ''
                } ${idx >= 4 && idx < 6 ? 'border-b border-slate-200 sm:border-b-0 dark:border-slate-800' : ''}`}
              >
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {metric.label}
                </div>
                <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                  {metric.value}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Field Analysis & Type Distribution (FR-036, FR-037) */}
        <section aria-label="Field analysis">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Field Analysis &amp; Type Distribution
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Presence, nullability, cardinality, and mixed-type breakdown across {formatNumber(stats.uniqueFields)} fields
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search
                className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={fieldSearch}
                onChange={(e) => setFieldSearch(e.target.value)}
                placeholder="Filter fields..."
                aria-label="Filter analyzed fields"
                className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {visibleFields.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              No fields to analyze in this scope.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-400">
                  <tr className="h-9">
                    <th className="px-4 font-medium">Field Name</th>
                    <th className="px-4 font-medium">Dominant Type</th>
                    <th className="min-w-[220px] px-4 font-medium">Type Distribution</th>
                    <th className="px-4 text-right font-medium">Occurrences</th>
                    <th className="px-4 text-right font-medium">Missing</th>
                    <th className="px-4 text-right font-medium">Null</th>
                    <th className="px-4 text-right font-medium">Distinct</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {visibleFields.map((field) => {
                    const distEntries = Object.entries(field.typeDistribution).sort(
                      (a, b) => (b[1] ?? 0) - (a[1] ?? 0)
                    );
                    const total = field.occurrenceCount || 1;
                    const isMixed = distEntries.length > 1;

                    return (
                      <tr
                        key={field.field}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-4 py-2.5 font-mono font-medium text-slate-900 dark:text-slate-100">
                          {field.field}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-slate-600 dark:text-slate-300">
                          <span>{field.dominantType}</span>
                          {isMixed && (
                            <span className="ml-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                              (mixed)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            {distEntries.map(([t, count]) => {
                              const pct = ((count ?? 0) / total) * 100;
                              const colorClass =
                                TYPE_COLORS[t as Exclude<JsonValueType, 'missing'>] ??
                                'bg-slate-400';
                              return (
                                <div
                                  key={t}
                                  className={colorClass}
                                  style={{ width: `${pct}%` }}
                                  title={`${t}: ${count} (${pct.toFixed(1)}%)`}
                                />
                              );
                            })}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {distEntries.map(([t, count]) => {
                              const pct = Math.round(((count ?? 0) / total) * 100);
                              return (
                                <span key={t}>
                                  {t}: {pct}%
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                          {formatNumber(field.occurrenceCount)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                          {formatNumber(field.missingCount)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                          {formatNumber(field.nullCount)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                          {formatNumber(field.distinctCount)}
                          {field.distinctCapped ? '+' : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
