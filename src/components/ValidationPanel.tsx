import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Copy, Check, Search } from 'lucide-react';
import { formatBytes, formatNumber } from '../core/formatters';
import type { FileSession, JsonlRecord } from '../core/types';

interface ValidationPanelProps {
  session: FileSession;
}

export function ValidationPanel({ session }: ValidationPanelProps) {
  const [search, setSearch] = useState('');
  const [selectedLine, setSelectedLine] = useState<number | null>(
    session.invalidRecords[0]?.lineNumber ?? null
  );
  const [copied, setCopied] = useState(false);

  const filteredErrors = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return session.invalidRecords;
    return session.invalidRecords.filter(
      (rec) =>
        String(rec.lineNumber).includes(q) ||
        (rec.parseError ?? '').toLowerCase().includes(q) ||
        rec.rawContent.toLowerCase().includes(q)
    );
  }, [session.invalidRecords, search]);

  const activeError: JsonlRecord | null = useMemo(() => {
    if (filteredErrors.length === 0) return null;
    const found = filteredErrors.find((r) => r.lineNumber === selectedLine);
    return found ?? filteredErrors[0];
  }, [filteredErrors, selectedLine]);

  const nonEmptyLines = session.validRecords.length + session.invalidRecords.length;
  const validityRate =
    nonEmptyLines === 0
      ? 100
      : Number(((session.validRecords.length / nonEmptyLines) * 100).toFixed(2));

  const handleCopyRaw = async () => {
    if (!activeError) return;
    try {
      await navigator.clipboard.writeText(activeError.rawContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Heading & Summary */}
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Validation Report
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Line-by-line JSON syntax audit for <span className="font-mono text-slate-700 dark:text-slate-300">{session.name}</span>. Invalid lines are isolated and do not interrupt valid record processing.
          </p>
        </div>

        {/* Summary Metrics Row */}
        <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-slate-200 bg-white sm:grid-cols-5 dark:border-slate-800 dark:bg-slate-900">
          {[
            { label: 'Total Lines', value: formatNumber(session.totalLines), tone: 'text-slate-900 dark:text-slate-50' },
            { label: 'Valid Records', value: formatNumber(session.validRecords.length), tone: 'text-emerald-700 dark:text-emerald-400' },
            {
              label: 'Invalid Lines',
              value: formatNumber(session.invalidRecords.length),
              tone: session.invalidRecords.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-50',
            },
            { label: 'Blank Lines', value: formatNumber(session.blankLines), tone: 'text-slate-700 dark:text-slate-300' },
            { label: 'Valid Rate', value: `${validityRate}%`, tone: 'text-slate-900 dark:text-slate-50' },
          ].map((m, idx) => (
            <div
              key={m.label}
              className={`p-4 ${
                idx < 4 ? 'sm:border-r sm:border-slate-200 sm:dark:border-slate-800' : ''
              } border-b border-slate-200 sm:border-b-0 dark:border-slate-800`}
            >
              <div className="text-xs text-slate-500 dark:text-slate-400">{m.label}</div>
              <div className={`mt-1.5 font-mono text-xl font-semibold tabular-nums ${m.tone}`}>
                {m.value}
              </div>
            </div>
          ))}
        </div>

        {/* Zero-Error State or Error Inspector */}
        {session.invalidRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white px-6 py-14 text-center dark:border-slate-800 dark:bg-slate-900">
            <CheckCircle2
              className="mb-3 h-8 w-8 text-emerald-600 dark:text-emerald-400"
              aria-hidden="true"
            />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              All non-empty lines are valid JSON
            </h2>
            <p className="mt-1.5 max-w-md text-sm text-slate-500 dark:text-slate-400">
              Parsed {formatNumber(session.validRecords.length)} valid JSON{' '}
              {session.validRecords.length === 1 ? 'record' : 'records'}
              {session.blankLines > 0
                ? ` and skipped ${formatNumber(session.blankLines)} blank ${session.blankLines === 1 ? 'line' : 'lines'}`
                : ''}{' '}
              with zero syntax errors.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-12">
            {/* Left: Invalid Lines Table (FR-011) */}
            <div className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-2.5 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Invalid Lines ({formatNumber(filteredErrors.length)})
                </span>
                <div className="relative w-52">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter by line or error..."
                    aria-label="Filter invalid lines"
                    className="h-7 w-full rounded border border-slate-200 bg-slate-50 pl-7 pr-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="max-h-[460px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredErrors.map((errRec) => {
                  const isActive = activeError?.lineNumber === errRec.lineNumber;
                  return (
                    <button
                      key={errRec.lineNumber}
                      type="button"
                      onClick={() => setSelectedLine(errRec.lineNumber)}
                      className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${
                        isActive
                          ? 'bg-red-50/70 dark:bg-red-950/35'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <AlertCircle
                            className="h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400"
                            aria-hidden="true"
                          />
                          <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                            Line #{errRec.lineNumber}
                          </span>
                          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                          <span className="font-medium text-red-600 dark:text-red-400">
                            Invalid JSON
                          </span>
                        </div>
                        <span className="font-mono text-[11px] tabular-nums text-slate-400">
                          {formatBytes(errRec.byteSize)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300">
                        {errRec.parseError}
                      </p>
                      <code className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {errRec.rawContent}
                      </code>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Selected Error Detail Inspector (Flow 4) */}
            <div className="flex flex-col rounded-lg border border-slate-200 bg-white p-4 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
              {activeError ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                    <div>
                      <h2 className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-50">
                        Line #{activeError.lineNumber}
                      </h2>
                      <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
                        Parsing Status: Invalid · {formatBytes(activeError.byteSize)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopyRaw}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy Raw</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div>
                    <div className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                      Error Message
                    </div>
                    <div className="rounded-md border border-red-200 bg-red-50/70 p-3 font-mono text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                      {activeError.parseError}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                      Raw Line Content
                    </div>
                    <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                      {activeError.rawContent}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center py-12 text-xs text-slate-500 dark:text-slate-400">
                  Select an invalid line to inspect its raw content and parser error.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
