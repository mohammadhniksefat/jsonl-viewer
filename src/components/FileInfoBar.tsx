import { AlertTriangle, FileText, Plus, RefreshCw, X } from 'lucide-react';
import { formatBytes, formatNumber } from '../core/formatters';
import type { FileSession } from '../core/types';

interface FileInfoBarProps {
  sessions: FileSession[];
  activeSession: FileSession;
  onSelectSession: (id: string) => void;
  onCloseSession: (id: string) => void;
  onAddFile: () => void;
  onReplaceFile: () => void;
  onOpenValidation: () => void;
}

export function FileInfoBar({
  sessions,
  activeSession,
  onSelectSession,
  onCloseSession,
  onAddFile,
  onReplaceFile,
  onOpenValidation,
}: FileInfoBarProps) {
  const isLoading = activeSession.status === 'loading';
  const validCount = isLoading
    ? activeSession.progress.validCount
    : activeSession.validRecords.length;
  const invalidCount = isLoading
    ? activeSession.progress.invalidCount
    : activeSession.invalidRecords.length;
  const totalLines = isLoading
    ? activeSession.progress.linesProcessed
    : activeSession.totalLines;
  const blankLines = isLoading
    ? activeSession.progress.emptyCount
    : activeSession.blankLines;

  return (
    <section
      aria-label="Open files and file information"
      className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/60"
    >
      {/* Multi-file session tab bar (FR-004) */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 px-4 sm:px-6 dark:border-slate-800/80">
        <div
          role="tablist"
          aria-label="Open JSONL files"
          className="flex min-w-0 items-center gap-1 overflow-x-auto py-1.5"
        >
          {sessions.map((session) => {
            const isActive = session.id === activeSession.id;
            return (
              <div
                key={session.id}
                className={`group flex items-center rounded-md border text-xs transition-colors ${
                  isActive
                    ? 'border-slate-300 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50'
                    : 'border-transparent text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
                }`}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onSelectSession(session.id)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 font-medium whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-l-md"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                  <span className="max-w-[180px] truncate">{session.name}</span>
                  {session.status === 'loading' && (
                    <span className="font-mono text-[11px] tabular-nums text-blue-600 dark:text-blue-400">
                      {session.progress.percent}%
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onCloseSession(session.id)}
                  aria-label={`Close ${session.name}`}
                  className="mr-1 rounded p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={onAddFile}
            aria-label="Open another file in new tab"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-slate-500 whitespace-nowrap shrink-0 transition-colors hover:bg-slate-200/70 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Add File</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onReplaceFile}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 whitespace-nowrap shrink-0 transition-colors hover:bg-slate-200/70 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Replace File</span>
        </button>
      </div>

      {/* File Information Strip (FR-003) — quiet unboxed tabular metadata */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5 px-4 py-2 text-xs sm:px-6">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-slate-600 dark:text-slate-400">
          <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
            {activeSession.name}
          </span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
          <span className="font-mono tabular-nums">{formatBytes(activeSession.size)}</span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
          <span className="font-mono uppercase">{activeSession.extension}</span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
          <span className="tabular-nums">
            <strong className="font-mono font-medium text-slate-900 dark:text-slate-100">
              {formatNumber(totalLines)}
            </strong>{' '}
            lines
          </span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
          <span className="tabular-nums text-emerald-700 dark:text-emerald-400">
            <strong className="font-mono font-semibold">{formatNumber(validCount)}</strong> valid
          </span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
          {invalidCount > 0 ? (
            <button
              type="button"
              onClick={onOpenValidation}
              className="tabular-nums text-red-600 underline decoration-red-400/60 underline-offset-2 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded dark:text-red-400 dark:hover:text-red-300"
            >
              <strong className="font-mono font-semibold">{formatNumber(invalidCount)}</strong> invalid
            </button>
          ) : (
            <span className="tabular-nums text-slate-500 dark:text-slate-400">
              <strong className="font-mono font-medium">0</strong> invalid
            </span>
          )}
          {blankLines > 0 && (
            <>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
              <span className="tabular-nums text-slate-500 dark:text-slate-400">
                <strong className="font-mono font-medium">{formatNumber(blankLines)}</strong> blank
              </span>
            </>
          )}
          {activeSession.hasBom && (
            <>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
              <span className="text-slate-500 dark:text-slate-400">UTF-8 BOM stripped</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
          {isLoading ? (
            <span className="font-mono tabular-nums text-blue-600 dark:text-blue-400">
              Parsing {activeSession.progress.percent}% ({formatBytes(activeSession.progress.bytesRead)} / {formatBytes(activeSession.progress.totalBytes)})
            </span>
          ) : activeSession.status === 'error' ? (
            <span className="font-medium text-red-600 dark:text-red-400">Load failed</span>
          ) : (
            <span>Ready · Processed locally</span>
          )}
        </div>
      </div>

      {/* Encoding warning banner if invalid UTF-8 sequences encountered */}
      {activeSession.encodingWarning && (
        <div
          role="status"
          className="flex items-center gap-2 border-t border-amber-200 bg-amber-50/80 px-4 py-1.5 text-xs text-amber-800 sm:px-6 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{activeSession.encodingWarning}</span>
        </div>
      )}

      {/* Incremental parsing progress bar */}
      {isLoading && (
        <div
          role="progressbar"
          aria-valuenow={activeSession.progress.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Parsing JSONL file"
          className="h-1 w-full overflow-hidden bg-slate-200 dark:bg-slate-800"
        >
          <div
            className="h-full bg-blue-600 transition-transform duration-150 dark:bg-blue-400"
            style={{
              width: '100%',
              transform: `scaleX(${Math.max(0.02, activeSession.progress.percent / 100)})`,
              transformOrigin: 'left center',
            }}
          />
        </div>
      )}
    </section>
  );
}
