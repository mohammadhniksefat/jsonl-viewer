import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { AlertTriangle, Upload } from 'lucide-react';
import { AppHeader } from './components/AppHeader';
import { DataTable } from './components/DataTable';
import { EmptyDropzone } from './components/EmptyDropzone';
import { ExportModal } from './components/ExportModal';
import { FileInfoBar } from './components/FileInfoBar';
import { RecordDetailPanel } from './components/RecordDetailPanel';
import { SearchFilterBar } from './components/SearchFilterBar';
import { StatisticsPanel } from './components/StatisticsPanel';
import { ValidationPanel } from './components/ValidationPanel';
import { getFileExtension } from './core/formatters';
import { filterRecords, sortRecords } from './core/queryEngine';
import { SAMPLE_DATASETS, type SampleDataset } from './core/samples';
import type {
  ExplorerViewMode,
  FileSession,
  JsonlRecord,
  MainSection,
  SearchFilterConfig,
  SortConfig,
} from './core/types';
import { parseFileInWorker } from './workers/workerClient';

const BLOCKED_BINARY_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'bmp',
  'ico',
  'pdf',
  'zip',
  'tar',
  'gz',
  'rar',
  '7z',
  'exe',
  'dmg',
  'mp3',
  'mp4',
  'mov',
  'avi',
  'woff',
  'woff2',
  'ttf',
]);

interface SessionUIState {
  filterConfig: SearchFilterConfig;
  sort: SortConfig | null;
  page: number;
  pageSize: number;
  viewMode: ExplorerViewMode;
  selectedLineNumber: number | null;
  checkedLineNumbers: Set<number>;
  visibleColumns: string[] | null; // null means show all columns
  isFilterPanelOpen: boolean;
}

function createInitialUIState(): SessionUIState {
  return {
    filterConfig: {
      globalQuery: '',
      searchField: '',
      caseSensitive: false,
      combinator: 'AND',
      conditions: [],
    },
    sort: null,
    page: 1,
    pageSize: 50,
    viewMode: 'table',
    selectedLineNumber: null,
    checkedLineNumbers: new Set<number>(),
    visibleColumns: null,
    isFilterPanelOpen: false,
  };
}

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('jsonl-explorer-theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      // Ignore storage failures
    }
    return 'light';
  });

  const [activeSection, setActiveSection] = useState<MainSection>('explorer');
  const [sessions, setSessions] = useState<FileSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [uiStateBySession, setUiStateBySession] = useState<Record<string, SessionUIState>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isWindowDragOver, setIsWindowDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceModeRef = useRef<boolean>(false);
  const workerCancelsRef = useRef<Map<string, () => void>>(new Map());
  const dragDepthRef = useRef(0);

  // Sync Tailwind dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('jsonl-explorer-theme', theme);
    } catch {
      // Ignore storage failure
    }
  }, [theme]);

  // Terminate any active workers on unmount
  useEffect(() => {
    const cancels = workerCancelsRef.current;
    return () => {
      for (const cancel of cancels.values()) {
        cancel();
      }
      cancels.clear();
    };
  }, []);

  const ingestFile = useCallback(
    (file: File | Blob, displayName: string, replaceSessionId?: string | null) => {
      const ext = getFileExtension(displayName);
      if (BLOCKED_BINARY_EXTENSIONS.has(ext)) {
        setGlobalError(
          `Unsupported file "${displayName}" (.${ext}). Please select a UTF-8 text-based JSONL, NDJSON, or JSON file.`
        );
        return;
      }

      setGlobalError(null);
      const sessionId = `file_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      const initialSession: FileSession = {
        id: sessionId,
        name: displayName,
        extension: ext,
        size: file.size,
        lastModified: file instanceof File ? file.lastModified : Date.now(),
        sourceFile: file,
        status: 'loading',
        progress: {
          bytesRead: 0,
          totalBytes: file.size,
          percent: file.size === 0 ? 100 : 0,
          linesProcessed: 0,
          validCount: 0,
          invalidCount: 0,
          emptyCount: 0,
        },
        validRecords: [],
        invalidRecords: [],
        totalLines: 0,
        blankLines: 0,
        columns: [],
        fieldPaths: [],
      };

      if (replaceSessionId) {
        const existingCancel = workerCancelsRef.current.get(replaceSessionId);
        if (existingCancel) {
          existingCancel();
          workerCancelsRef.current.delete(replaceSessionId);
        }
        setSessions((prev) =>
          prev.map((s) => (s.id === replaceSessionId ? initialSession : s))
        );
      } else {
        setSessions((prev) => [...prev, initialSession]);
      }

      setUiStateBySession((prev) => ({
        ...prev,
        [sessionId]: createInitialUIState(),
      }));
      setActiveSessionId(sessionId);

      const cancel = parseFileInWorker(sessionId, file, {
        onProgress: (progress) => {
          setSessions((prev) =>
            prev.map((s) => (s.id === sessionId ? { ...s, progress } : s))
          );
        },
        onComplete: (result) => {
          workerCancelsRef.current.delete(sessionId);
          setSessions((prev) =>
            prev.map((s) =>
              s.id === sessionId
                ? {
                    ...s,
                    status: 'ready',
                    validRecords: result.validRecords,
                    invalidRecords: result.invalidRecords,
                    totalLines: result.totalLines,
                    blankLines: result.blankLines,
                    hasBom: result.hasBom,
                    encodingWarning: result.encodingWarning,
                    columns: result.columns,
                    fieldPaths: result.fieldPaths,
                    progress: result.progress,
                  }
                : s
            )
          );
        },
        onError: (err) => {
          workerCancelsRef.current.delete(sessionId);
          setSessions((prev) =>
            prev.map((s) =>
              s.id === sessionId
                ? {
                    ...s,
                    status: 'error',
                    errorMessage: err.message,
                  }
                : s
            )
          );
        },
      });

      workerCancelsRef.current.set(sessionId, cancel);
    },
    []
  );

  const handleLoadSample = useCallback(
    (sample: SampleDataset) => {
      const content = sample.buildContent();
      const blob = new Blob([content], { type: 'application/x-ndjson;charset=utf-8' });
      ingestFile(blob, sample.filename, null);
    },
    [ingestFile]
  );

  // Support ?autostart=1 to immediately load the primary sample dataset
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1' && sessions.length === 0) {
      handleLoadSample(SAMPLE_DATASETS[0]);
    }
    // Run only once on initial mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilesSelected = useCallback(
    (fileList: FileList | File[], replaceActive = false) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      files.forEach((file, idx) => {
        const replaceId =
          replaceActive && idx === 0 ? activeSessionId : null;
        ingestFile(file, file.name, replaceId);
      });
    },
    [activeSessionId, ingestFile]
  );

  const openFilePicker = useCallback((replace = false) => {
    replaceModeRef.current = replace;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.multiple = !replace;
      fileInputRef.current.click();
    }
  }, []);

  const handleCloseSession = useCallback(
    (id: string) => {
      const cancel = workerCancelsRef.current.get(id);
      if (cancel) {
        cancel();
        workerCancelsRef.current.delete(id);
      }

      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        if (activeSessionId === id) {
          const fallback = next[next.length - 1]?.id ?? null;
          setActiveSessionId(fallback);
          if (!fallback) {
            setActiveSection('explorer');
          }
        }
        return next;
      });
      setUiStateBySession((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    },
    [activeSessionId]
  );

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId]
  );

  const activeUIState: SessionUIState = useMemo(() => {
    if (!activeSessionId) return createInitialUIState();
    return uiStateBySession[activeSessionId] ?? createInitialUIState();
  }, [activeSessionId, uiStateBySession]);

  const updateActiveUI = useCallback(
    (updater: (prev: SessionUIState) => SessionUIState) => {
      if (!activeSessionId) return;
      setUiStateBySession((prev) => {
        const current = prev[activeSessionId] ?? createInitialUIState();
        return {
          ...prev,
          [activeSessionId]: updater(current),
        };
      });
    },
    [activeSessionId]
  );

  const hasActiveFilter = useMemo(() => {
    const fc = activeUIState.filterConfig;
    return (
      fc.globalQuery.length > 0 ||
      fc.conditions.some((c) => c.path.trim().length > 0)
    );
  }, [activeUIState.filterConfig]);

  // Filtered + Sorted records computed cleanly via pure engine
  const filteredRecords = useMemo(() => {
    if (!activeSession) return [];
    return filterRecords(activeSession.validRecords, activeUIState.filterConfig);
  }, [activeSession, activeUIState.filterConfig]);

  const sortedRecords = useMemo(() => {
    return sortRecords(filteredRecords, activeUIState.sort);
  }, [filteredRecords, activeUIState.sort]);

  const visibleColumns = useMemo(() => {
    if (!activeSession) return [];
    if (activeUIState.visibleColumns === null) return activeSession.columns;
    return activeSession.columns.filter((c) =>
      activeUIState.visibleColumns!.includes(c)
    );
  }, [activeSession, activeUIState.visibleColumns]);

  const selectedRecordIndex = useMemo(() => {
    if (activeUIState.selectedLineNumber === null) return -1;
    return sortedRecords.findIndex(
      (r) => r.lineNumber === activeUIState.selectedLineNumber
    );
  }, [sortedRecords, activeUIState.selectedLineNumber]);

  const selectedRecord: JsonlRecord | null =
    selectedRecordIndex >= 0 ? sortedRecords[selectedRecordIndex] : null;

  const checkedRecordsList = useMemo(() => {
    if (!activeSession || activeUIState.checkedLineNumbers.size === 0) return [];
    return activeSession.validRecords.filter((r) =>
      activeUIState.checkedLineNumbers.has(r.lineNumber)
    );
  }, [activeSession, activeUIState.checkedLineNumbers]);

  // Quick-filter from JSON Tree or Record Detail Table
  const handleFilterByPath = useCallback(
    (path: string, value: unknown) => {
      const cleanPath = path.trim();
      if (!cleanPath) return;

      const isNull = value === null;
      const isPrimitive =
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean';

      updateActiveUI((prev) => ({
        ...prev,
        page: 1,
        isFilterPanelOpen: true,
        filterConfig: {
          ...prev.filterConfig,
          conditions: [
            ...prev.filterConfig.conditions,
            {
              id: `cond_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              path: cleanPath,
              operator: isNull ? 'is_null' : isPrimitive ? 'equals' : 'exists',
              value: isPrimitive ? String(value) : '',
            },
          ],
        },
      }));
    },
    [updateActiveUI]
  );

  // Global drag-and-drop overlay when a file is already open
  const handleWindowDragEnter = (e: DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    if (sessions.length > 0) {
      setIsWindowDragOver(true);
    }
  };

  const handleWindowDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
  };

  const handleWindowDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsWindowDragOver(false);
    }
  };

  const handleWindowDrop = (e: DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsWindowDragOver(false);
    if (e.dataTransfer.files.length > 0 && sessions.length > 0) {
      handleFilesSelected(e.dataTransfer.files, false);
    }
  };

  return (
    <div
      onDragEnter={handleWindowDragEnter}
      onDragOver={handleWindowDragOver}
      onDragLeave={handleWindowDragLeave}
      onDrop={handleWindowDrop}
      className="flex h-screen flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100"
    >
      {/* Hidden native File Picker input (FR-001, FR-004, FR-005) */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".jsonl,.ndjson,.json,.txt,.log,application/x-ndjson,application/json,text/plain"
        className="sr-only"
        aria-label="Choose JSONL file"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFilesSelected(e.target.files, replaceModeRef.current);
          }
        }}
      />

      {/* Global Drag Overlay */}
      {isWindowDragOver && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-blue-600/10 backdrop-blur-xs dark:bg-blue-500/15">
          <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-blue-500 bg-white px-10 py-8 shadow-xl dark:border-blue-400 dark:bg-slate-900">
            <Upload className="mb-3 h-7 w-7 text-blue-600 dark:text-blue-400" />
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              Drop JSONL file to open in a new tab
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Processed 100% locally in your browser
            </p>
          </div>
        </div>
      )}

      {/* 1. Application Header */}
      <AppHeader
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        hasActiveFile={Boolean(activeSession)}
        invalidCount={activeSession?.invalidRecords.length ?? 0}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        onOpenFileClick={() => openFilePicker(false)}
      />

      {/* Active Global Error Toast if user drops unsupported file while browsing */}
      {globalError && activeSession && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800 sm:px-6 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>{globalError}</span>
          </span>
          <button
            type="button"
            onClick={() => setGlobalError(null)}
            className="font-medium underline underline-offset-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* No File Loaded -> Empty Dropzone */}
      {!activeSession ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <EmptyDropzone
            onFilesSelected={(files) => handleFilesSelected(files, false)}
            onOpenFilePicker={() => openFilePicker(false)}
            onLoadSample={handleLoadSample}
            errorBanner={globalError}
            onDismissError={() => setGlobalError(null)}
          />
        </div>
      ) : (
        <>
          {/* 2. File Session Bar & File Information Bar */}
          <FileInfoBar
            sessions={sessions}
            activeSession={activeSession}
            onSelectSession={(id) => setActiveSessionId(id)}
            onCloseSession={handleCloseSession}
            onAddFile={() => openFilePicker(false)}
            onReplaceFile={() => openFilePicker(true)}
            onOpenValidation={() => setActiveSection('validation')}
          />

          {/* File Read / Memory Error State */}
          {activeSession.status === 'error' ? (
            <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <AlertTriangle className="mb-3 h-8 w-8 text-red-600 dark:text-red-400" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Could not parse {activeSession.name}
              </h2>
              <p className="mt-1.5 max-w-md text-sm text-slate-600 dark:text-slate-400">
                {activeSession.errorMessage || 'An error occurred while reading this file.'}
              </p>
              <button
                type="button"
                onClick={() => openFilePicker(true)}
                className="mt-5 rounded-md bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
              >
                Choose Another File
              </button>
            </main>
          ) : activeSession.status === 'loading' ? (
            /* Loading Skeleton State while Web Worker parses file */
            <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <div className="w-full max-w-md space-y-3">
                <div className="font-mono text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                  Parsing {activeSession.name} — {activeSession.progress.percent}%
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className="h-full bg-blue-600 transition-transform duration-150 dark:bg-blue-400"
                    style={{
                      width: '100%',
                      transform: `scaleX(${Math.max(0.03, activeSession.progress.percent / 100)})`,
                      transformOrigin: 'left center',
                    }}
                  />
                </div>
                <p className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {activeSession.progress.linesProcessed.toLocaleString()} lines processed ·{' '}
                  {activeSession.progress.validCount.toLocaleString()} valid ·{' '}
                  {activeSession.progress.invalidCount.toLocaleString()} invalid
                </p>
              </div>
            </main>
          ) : activeSession.totalLines === 0 ? (
            /* FR-006 Empty File State */
            <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Empty File
              </h2>
              <p className="mt-1.5 max-w-md text-sm text-slate-500 dark:text-slate-400">
                <span className="font-mono">{activeSession.name}</span> contains 0 bytes and no JSONL records.
              </p>
              <button
                type="button"
                onClick={() => openFilePicker(true)}
                className="mt-5 rounded-md bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
              >
                Replace File
              </button>
            </main>
          ) : (
            /* Populated Main Sections */
            <>
              {activeSection === 'explorer' && (
                <div className="flex min-h-0 flex-1 flex-col">
                  {/* 3. Main Toolbar & Filter Panel */}
                  <SearchFilterBar
                    config={activeUIState.filterConfig}
                    onChangeConfig={(next) =>
                      updateActiveUI((prev) => ({
                        ...prev,
                        page: 1,
                        filterConfig: next,
                      }))
                    }
                    onResetFilters={() =>
                      updateActiveUI((prev) => ({
                        ...prev,
                        page: 1,
                        filterConfig: {
                          globalQuery: '',
                          searchField: '',
                          caseSensitive: false,
                          combinator: 'AND',
                          conditions: [],
                        },
                      }))
                    }
                    fieldPaths={activeSession.fieldPaths}
                    allColumns={activeSession.columns}
                    visibleColumns={visibleColumns}
                    onToggleColumn={(col) =>
                      updateActiveUI((prev) => {
                        const base = prev.visibleColumns ?? activeSession.columns;
                        const exists = base.includes(col);
                        const next = exists
                          ? base.filter((c) => c !== col)
                          : [...base, col];
                        return {
                          ...prev,
                          visibleColumns: next.length > 0 ? next : base,
                        };
                      })
                    }
                    onResetColumns={() =>
                      updateActiveUI((prev) => ({ ...prev, visibleColumns: null }))
                    }
                    viewMode={activeUIState.viewMode}
                    onChangeViewMode={(mode) =>
                      updateActiveUI((prev) => ({ ...prev, viewMode: mode }))
                    }
                    filteredCount={sortedRecords.length}
                    totalValidCount={activeSession.validRecords.length}
                    selectedCount={activeUIState.checkedLineNumbers.size}
                    onClearSelection={() =>
                      updateActiveUI((prev) => ({
                        ...prev,
                        checkedLineNumbers: new Set<number>(),
                      }))
                    }
                    onOpenExport={() => setIsExportOpen(true)}
                    isFilterPanelOpen={activeUIState.isFilterPanelOpen}
                    onToggleFilterPanel={() =>
                      updateActiveUI((prev) => ({
                        ...prev,
                        isFilterPanelOpen: !prev.isFilterPanelOpen,
                      }))
                    }
                  />

                  {/* 4 & 5. Data Table + Record Detail Panel */}
                  <div className="flex min-h-0 flex-1 overflow-hidden">
                    <DataTable
                      records={sortedRecords}
                      totalValidRecords={activeSession.validRecords.length}
                      columns={visibleColumns}
                      viewMode={activeUIState.viewMode}
                      sort={activeUIState.sort}
                      onToggleSort={(field) =>
                        updateActiveUI((prev) => {
                          if (!prev.sort || prev.sort.field !== field) {
                            return { ...prev, page: 1, sort: { field, direction: 'asc' } };
                          }
                          if (prev.sort.direction === 'asc') {
                            return { ...prev, page: 1, sort: { field, direction: 'desc' } };
                          }
                          return { ...prev, page: 1, sort: null };
                        })
                      }
                      page={activeUIState.page}
                      pageSize={activeUIState.pageSize}
                      onPageChange={(nextPage) =>
                        updateActiveUI((prev) => ({ ...prev, page: nextPage }))
                      }
                      onPageSizeChange={(nextSize) =>
                        updateActiveUI((prev) => ({
                          ...prev,
                          page: 1,
                          pageSize: nextSize,
                        }))
                      }
                      selectedLineNumber={activeUIState.selectedLineNumber}
                      onSelectRecord={(rec) =>
                        updateActiveUI((prev) => ({
                          ...prev,
                          selectedLineNumber: rec.lineNumber,
                        }))
                      }
                      checkedLineNumbers={activeUIState.checkedLineNumbers}
                      onToggleCheckRecord={(lineNumber) =>
                        updateActiveUI((prev) => {
                          const next = new Set(prev.checkedLineNumbers);
                          if (next.has(lineNumber)) next.delete(lineNumber);
                          else next.add(lineNumber);
                          return { ...prev, checkedLineNumbers: next };
                        })
                      }
                      onToggleCheckPage={(pageRecords) =>
                        updateActiveUI((prev) => {
                          const next = new Set(prev.checkedLineNumbers);
                          const allChecked = pageRecords.every((r) =>
                            next.has(r.lineNumber)
                          );
                          for (const r of pageRecords) {
                            if (allChecked) next.delete(r.lineNumber);
                            else next.add(r.lineNumber);
                          }
                          return { ...prev, checkedLineNumbers: next };
                        })
                      }
                      hasActiveFilter={hasActiveFilter}
                      onResetFilters={() =>
                        updateActiveUI((prev) => ({
                          ...prev,
                          page: 1,
                          filterConfig: {
                            globalQuery: '',
                            searchField: '',
                            caseSensitive: false,
                            combinator: 'AND',
                            conditions: [],
                          },
                        }))
                      }
                      onFilterByPath={handleFilterByPath}
                    />

                    <RecordDetailPanel
                      record={selectedRecord}
                      recordIndex={selectedRecordIndex}
                      totalRecords={sortedRecords.length}
                      onNavigateIndex={(nextIdx) => {
                        const target = sortedRecords[nextIdx];
                        if (!target) return;
                        const targetPage =
                          Math.floor(nextIdx / activeUIState.pageSize) + 1;
                        updateActiveUI((prev) => ({
                          ...prev,
                          page: targetPage,
                          selectedLineNumber: target.lineNumber,
                        }));
                      }}
                      onClose={() =>
                        updateActiveUI((prev) => ({
                          ...prev,
                          selectedLineNumber: null,
                        }))
                      }
                      onFilterByPath={handleFilterByPath}
                    />
                  </div>
                </div>
              )}

              {activeSection === 'statistics' && (
                <StatisticsPanel
                  session={activeSession}
                  filteredRecords={sortedRecords}
                  hasActiveFilter={hasActiveFilter}
                />
              )}

              {activeSection === 'validation' && (
                <ValidationPanel session={activeSession} />
              )}

              <ExportModal
                isOpen={isExportOpen}
                onClose={() => setIsExportOpen(false)}
                session={activeSession}
                filteredRecords={sortedRecords}
                selectedRecords={checkedRecordsList}
                columns={visibleColumns.length > 0 ? visibleColumns : activeSession.columns}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
