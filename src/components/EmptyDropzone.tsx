import { useState, type DragEvent } from 'react';
import { FileCode2, ShieldCheck, Upload } from 'lucide-react';
import { SAMPLE_DATASETS, type SampleDataset } from '../core/samples';

interface EmptyDropzoneProps {
  onFilesSelected: (files: FileList | File[]) => void;
  onOpenFilePicker: () => void;
  onLoadSample: (sample: SampleDataset) => void;
  errorBanner?: string | null;
  onDismissError?: () => void;
}

export function EmptyDropzone({
  onFilesSelected,
  onOpenFilePicker,
  onLoadSample,
  errorBanner,
  onDismissError,
}: EmptyDropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragActive) setIsDragActive(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(e.dataTransfer.files);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:py-16">
      {errorBanner && (
        <div
          role="alert"
          className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          <span>{errorBanner}</span>
          {onDismissError && (
            <button
              type="button"
              onClick={onDismissError}
              className="text-xs font-medium underline underline-offset-2 hover:text-red-900 dark:hover:text-red-100"
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      <div className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-slate-50 [text-wrap:balance]">
          Inspect, filter, and validate JSONL datasets locally.
        </h1>
        <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-400 [text-wrap:pretty]">
          Drop newline-delimited JSON files to explore mixed schemas, run multi-condition JSON path queries, audit parsing errors, and export clean subsets without uploading a single byte.
        </p>
      </div>

      {/* Primary Drag & Drop Zone (FR-001, FR-002) */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-testid="file-dropzone"
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
          isDragActive
            ? 'border-blue-500 bg-blue-50/70 dark:border-blue-400 dark:bg-blue-950/30'
            : 'border-slate-300 bg-white hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900/80 dark:hover:border-slate-600'
        }`}
      >
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <Upload className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Drop your .jsonl or .ndjson file here
        </h2>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          Chunked Web Worker parsing for large files up to 100 MB · UTF-8 with BOM support
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onOpenFilePicker}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-5 text-sm font-medium text-white whitespace-nowrap transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus-visible:ring-offset-slate-900"
          >
            Select JSONL File
          </button>
        </div>

        <div className="mt-6 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <span>100% client-side execution · Files never leave your browser</span>
        </div>
      </div>

      {/* Deterministic Sample Datasets */}
      <section aria-label="Sample datasets" className="mt-10">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Or explore a sample dataset
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Generated locally in-browser
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {SAMPLE_DATASETS.map((sample) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => onLoadSample(sample)}
              className="group flex flex-col items-start rounded-lg border border-slate-200 bg-white p-4 text-left transition-colors hover:border-blue-400 hover:bg-slate-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/70 dark:hover:bg-slate-800/70"
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400">
                  <FileCode2 className="h-4 w-4 text-slate-400 group-hover:text-blue-500" aria-hidden="true" />
                  <span>{sample.name}</span>
                </span>
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  {sample.filename}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {sample.description}
              </p>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
