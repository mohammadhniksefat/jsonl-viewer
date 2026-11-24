import { useMemo, useState } from 'react';
import { Download, X } from 'lucide-react';
import {
  serializeToCsv,
  serializeToJsonArray,
  serializeToJsonl,
  triggerFileDownload,
} from '../core/exporter';
import { formatNumber } from '../core/formatters';
import type {
  ExportFormat,
  ExportScope,
  FileSession,
  JsonlRecord,
} from '../core/types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: FileSession;
  filteredRecords: JsonlRecord[];
  selectedRecords: JsonlRecord[];
  columns: string[];
}

export function ExportModal({
  isOpen,
  onClose,
  session,
  filteredRecords,
  selectedRecords,
  columns,
}: ExportModalProps) {
  const [scope, setScope] = useState<ExportScope>(
    selectedRecords.length > 0 ? 'selected' : 'filtered'
  );
  const [format, setFormat] = useState<ExportFormat>('jsonl');
  const [includeInvalid, setIncludeInvalid] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportedBanner, setExportedBanner] = useState<string | null>(null);

  const targetRecords = useMemo(() => {
    if (scope === 'selected') return selectedRecords;
    if (scope === 'filtered') return filteredRecords;
    if (scope === 'all_valid') {
      if (includeInvalid && format === 'jsonl') {
        return [...session.validRecords, ...session.invalidRecords].sort(
          (a, b) => a.lineNumber - b.lineNumber
        );
      }
      return session.validRecords;
    }
    return session.validRecords;
  }, [
    scope,
    selectedRecords,
    filteredRecords,
    session.validRecords,
    session.invalidRecords,
    includeInvalid,
    format,
  ]);

  const previewText = useMemo(() => {
    if (!isOpen) return '';
    if (scope === 'original') {
      const sample = [
        ...session.validRecords,
        ...session.invalidRecords,
      ]
        .sort((a, b) => a.lineNumber - b.lineNumber)
        .slice(0, 4)
        .map((r) => r.rawContent)
        .join('\n');
      return sample || '(Empty original file)';
    }

    const sampleRecords = targetRecords.slice(0, 4);
    if (sampleRecords.length === 0) return '(No records in selected export scope)';

    if (format === 'jsonl') {
      return serializeToJsonl(sampleRecords, { includeInvalid });
    }
    if (format === 'json') {
      return serializeToJsonArray(sampleRecords, true).slice(0, 600);
    }
    return serializeToCsv(sampleRecords, columns);
  }, [isOpen, scope, format, targetRecords, includeInvalid, columns, session]);

  if (!isOpen) return null;

  const baseName = session.name.replace(/\.[^.]+$/, '') || 'dataset';

  const handleExport = () => {
    setExportError(null);
    setExportedBanner(null);

    try {
      if (scope === 'original') {
        if (session.sourceFile) {
          triggerFileDownload(
            session.sourceFile,
            session.name,
            'application/x-ndjson;charset=utf-8'
          );
          setExportedBanner(`Downloaded unmodified original file (${session.name}).`);
          return;
        }
        const rawAll = [...session.validRecords, ...session.invalidRecords]
          .sort((a, b) => a.lineNumber - b.lineNumber)
          .map((r) => r.rawContent)
          .join('\n');
        triggerFileDownload(rawAll, session.name, 'application/x-ndjson;charset=utf-8');
        setExportedBanner(`Downloaded ${session.name}.`);
        return;
      }

      if (targetRecords.length === 0) {
        setExportError('No records are available in the selected scope.');
        return;
      }

      const suffix =
        scope === 'selected'
          ? 'selected'
          : scope === 'filtered'
            ? 'filtered'
            : 'valid';

      if (format === 'jsonl') {
        const content = serializeToJsonl(targetRecords, { includeInvalid });
        const filename = `${baseName}_${suffix}.jsonl`;
        triggerFileDownload(content, filename, 'application/x-ndjson;charset=utf-8');
        setExportedBanner(`Exported ${formatNumber(targetRecords.length)} records to ${filename}.`);
      } else if (format === 'json') {
        const content = serializeToJsonArray(targetRecords, true);
        const filename = `${baseName}_${suffix}.json`;
        triggerFileDownload(content, filename, 'application/json;charset=utf-8');
        setExportedBanner(`Exported JSON array (${formatNumber(targetRecords.length)} records) to ${filename}.`);
      } else {
        const content = serializeToCsv(targetRecords, columns);
        const filename = `${baseName}_${suffix}.csv`;
        triggerFileDownload(content, filename, 'text/csv;charset=utf-8');
        setExportedBanner(`Exported CSV (${formatNumber(targetRecords.length)} rows) to ${filename}.`);
      }
    } catch (err) {
      setExportError(
        err instanceof Error
          ? `Export failed: ${err.message}`
          : 'Export failed due to an unexpected browser error.'
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
    >
      <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2
              id="export-modal-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-50"
            >
              Export Dataset
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              All exports are generated locally in your browser without modifying the original file.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close export dialog"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 p-5">
          {/* Scope Selection (FR-039, FR-040, FR-041) */}
          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              1. Records to Export
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  {
                    id: 'filtered' as const,
                    label: 'Filtered Records',
                    meta: `${formatNumber(filteredRecords.length)} records`,
                    disabled: filteredRecords.length === 0,
                  },
                  {
                    id: 'selected' as const,
                    label: 'Selected Records',
                    meta: `${formatNumber(selectedRecords.length)} checked`,
                    disabled: selectedRecords.length === 0,
                  },
                  {
                    id: 'all_valid' as const,
                    label: 'All Valid Records',
                    meta: `${formatNumber(session.validRecords.length)} records`,
                    disabled: session.validRecords.length === 0,
                  },
                  {
                    id: 'original' as const,
                    label: 'Original File (Unmodified)',
                    meta: `${formatNumber(session.totalLines)} lines`,
                    disabled: false,
                  },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.id}
                  className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5 text-xs transition-colors ${
                    opt.disabled
                      ? 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-50 dark:border-slate-800/60 dark:bg-slate-950/40'
                      : scope === opt.id
                        ? 'border-blue-500 bg-blue-50/60 text-slate-900 dark:border-blue-400 dark:bg-blue-950/40 dark:text-slate-100'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <input
                      type="radio"
                      name="export-scope"
                      value={opt.id}
                      disabled={opt.disabled}
                      checked={scope === opt.id}
                      onChange={() => setScope(opt.id)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>{opt.label}</span>
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                    {opt.meta}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Format Selection (FR-040, FR-042, FR-043) */}
          {scope !== 'original' && (
            <fieldset>
              <legend className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                2. Output Format
              </legend>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'jsonl' as const, label: 'JSONL', sub: '1 JSON / line' },
                    { id: 'json' as const, label: 'JSON Array', sub: 'Formatted [...]' },
                    { id: 'csv' as const, label: 'CSV', sub: 'Nested as JSON' },
                  ] as const
                ).map((fmt) => (
                  <button
                    key={fmt.id}
                    type="button"
                    aria-pressed={format === fmt.id}
                    onClick={() => setFormat(fmt.id)}
                    className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors ${
                      format === fmt.id
                        ? 'border-blue-500 bg-blue-50/60 text-slate-900 dark:border-blue-400 dark:bg-blue-950/40 dark:text-slate-50'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <span className="font-mono text-xs font-semibold">{fmt.label}</span>
                    <span className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {fmt.sub}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {/* Export Integrity Option (FR-044) */}
          {scope === 'all_valid' && format === 'jsonl' && session.invalidRecords.length > 0 && (
            <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-xs dark:border-slate-800 dark:bg-slate-950/50">
              <input
                type="checkbox"
                checked={includeInvalid}
                onChange={(e) => setIncludeInvalid(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                <strong className="font-medium text-slate-800 dark:text-slate-200">
                  Include Invalid Records ({formatNumber(session.invalidRecords.length)})
                </strong>
                <span className="mt-0.5 block text-slate-500 dark:text-slate-400">
                  Off by default to guarantee every exported JSONL line is a valid JSON document.
                </span>
              </span>
            </label>
          )}

          {/* Output Preview */}
          <div>
            <div className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              Output Preview (first lines)
            </div>
            <pre className="max-h-32 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              {previewText}
            </pre>
          </div>

          {exportError && (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              {exportError}
            </div>
          )}

          {exportedBanner && (
            <div
              role="status"
              className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
            >
              {exportedBanner}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Download File</span>
          </button>
        </div>
      </div>
    </div>
  );
}
