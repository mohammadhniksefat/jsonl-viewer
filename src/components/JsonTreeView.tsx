import { useState } from 'react';
import { Check, ChevronDown, ChevronRight, Copy, Filter } from 'lucide-react';
import { detectValueType } from '../core/parser';
import { joinJsonPath } from '../core/pathResolver';

interface JsonTreeViewProps {
  value: unknown;
  onFilterByPath?: (path: string, value: unknown) => void;
  defaultExpandDepth?: number;
}

interface TreeNodeProps {
  label: string | number | null;
  value: unknown;
  path: string;
  depth: number;
  expandSignal: { version: number; expanded: boolean } | null;
  defaultExpandDepth: number;
  selectedPath: string | null;
  onSelectPath: (path: string) => void;
  onFilterByPath?: (path: string, value: unknown) => void;
}

function TypeLabel({ type }: { type: string }) {
  return (
    <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
      {type}
    </span>
  );
}

function TreeNode({
  label,
  value,
  path,
  depth,
  expandSignal,
  defaultExpandDepth,
  selectedPath,
  onSelectPath,
  onFilterByPath,
}: TreeNodeProps) {
  const [localExpanded, setLocalExpanded] = useState<boolean>(depth < defaultExpandDepth);
  const [lastSignalVersion, setLastSignalVersion] = useState<number>(expandSignal?.version ?? 0);

  if (expandSignal && expandSignal.version !== lastSignalVersion) {
    setLastSignalVersion(expandSignal.version);
    setLocalExpanded(expandSignal.expanded);
  }

  const type = detectValueType(value);
  const isExpandable = type === 'object' || type === 'array';
  const entries = isExpandable
    ? type === 'array'
      ? (value as unknown[]).map((item, idx) => [idx, item] as const)
      : Object.entries(value as Record<string, unknown>)
    : [];

  const isSelected = selectedPath === path;

  const renderPrimitive = () => {
    if (type === 'string') {
      return (
        <span className="break-all font-mono text-xs text-emerald-700 dark:text-emerald-300">
          &quot;{String(value)}&quot;
        </span>
      );
    }
    if (type === 'number') {
      return (
        <span className="font-mono text-xs tabular-nums text-amber-700 dark:text-amber-300">
          {String(value)}
        </span>
      );
    }
    if (type === 'boolean') {
      return (
        <span className="font-mono text-xs text-purple-700 dark:text-purple-300">
          {value ? 'true' : 'false'}
        </span>
      );
    }
    if (type === 'null') {
      return (
        <span className="font-mono text-xs italic text-rose-600 dark:text-rose-400">
          null
        </span>
      );
    }
    return null;
  };

  return (
    <div className="select-text">
      <div
        onClick={() => onSelectPath(path)}
        className={`group flex items-start gap-1.5 rounded px-1.5 py-1 transition-colors ${
          isSelected
            ? 'bg-blue-50 dark:bg-blue-950/50'
            : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
        }`}
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
      >
        {isExpandable ? (
          <button
            type="button"
            aria-expanded={localExpanded}
            aria-label={localExpanded ? `Collapse ${path || 'root'}` : `Expand ${path || 'root'}`}
            onClick={(e) => {
              e.stopPropagation();
              setLocalExpanded((prev) => !prev);
            }}
            className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            {localExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="mt-0.5 inline-block h-4 w-4 shrink-0" aria-hidden="true" />
        )}

        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {label !== null && (
            <span className="font-mono text-xs font-medium text-sky-700 dark:text-sky-300">
              {typeof label === 'number' ? `[${label}]` : label}
              <span className="text-slate-400 dark:text-slate-500">:</span>
            </span>
          )}

          {isExpandable ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLocalExpanded((prev) => !prev);
                onSelectPath(path);
              }}
              className="font-mono text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            >
              {type === 'array'
                ? `[${entries.length} ${entries.length === 1 ? 'item' : 'items'}]`
                : `{${entries.length} ${entries.length === 1 ? 'key' : 'keys'}}`}
            </button>
          ) : (
            renderPrimitive()
          )}

          <TypeLabel type={type} />
        </div>

        {path && onFilterByPath && (
          <button
            type="button"
            title={`Filter by ${path}`}
            aria-label={`Filter records by ${path}`}
            onClick={(e) => {
              e.stopPropagation();
              onFilterByPath(path, value);
            }}
            className="ml-auto shrink-0 rounded p-1 text-slate-400 opacity-0 transition-opacity hover:bg-slate-200 hover:text-blue-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 group-hover:opacity-100 dark:hover:bg-slate-700 dark:hover:text-blue-400"
          >
            <Filter className="h-3 w-3" />
          </button>
        )}
      </div>

      {isExpandable && localExpanded && (
        <div>
          {entries.length === 0 ? (
            <div
              className="py-1 font-mono text-xs italic text-slate-400 dark:text-slate-500"
              style={{ paddingLeft: `${(depth + 1) * 14 + 24}px` }}
            >
              (empty {type})
            </div>
          ) : (
            entries.map(([key, childVal]) => {
              const childPath = joinJsonPath(path, key);
              return (
                <TreeNode
                  key={String(key)}
                  label={key}
                  value={childVal}
                  path={childPath}
                  depth={depth + 1}
                  expandSignal={expandSignal}
                  defaultExpandDepth={defaultExpandDepth}
                  selectedPath={selectedPath}
                  onSelectPath={onSelectPath}
                  onFilterByPath={onFilterByPath}
                />
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export function JsonTreeView({
  value,
  onFilterByPath,
  defaultExpandDepth = 2,
}: JsonTreeViewProps) {
  const [expandSignal, setExpandSignal] = useState<{ version: number; expanded: boolean } | null>(
    null
  );
  const [selectedPath, setSelectedPath] = useState<string>('$');
  const [copiedPath, setCopiedPath] = useState(false);

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(selectedPath || '$');
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 1500);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div className="flex flex-col">
      {/* Tree Toolbar & Active Path Indicator (FR-018) */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() =>
              setExpandSignal((prev) => ({ version: (prev?.version ?? 0) + 1, expanded: true }))
            }
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 whitespace-nowrap transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Expand All
          </button>
          <button
            type="button"
            onClick={() =>
              setExpandSignal((prev) => ({ version: (prev?.version ?? 0) + 1, expanded: false }))
            }
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 whitespace-nowrap transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Collapse All
          </button>
        </div>

        <div className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <span>Path:</span>
          <code className="max-w-[220px] truncate rounded bg-slate-100 px-1.5 py-0.5 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
            {selectedPath || '$'}
          </code>
          <button
            type="button"
            onClick={handleCopyPath}
            aria-label="Copy selected field path"
            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            {copiedPath ? (
              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      <div className="overflow-auto rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-950/60">
        <TreeNode
          label={null}
          value={value}
          path=""
          depth={0}
          expandSignal={expandSignal}
          defaultExpandDepth={defaultExpandDepth}
          selectedPath={selectedPath}
          onSelectPath={(p) => setSelectedPath(p || '$')}
          onFilterByPath={onFilterByPath}
        />
      </div>
    </div>
  );
}
