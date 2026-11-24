import { FolderOpen, Moon, Sun } from 'lucide-react';
import type { MainSection } from '../core/types';

interface AppHeaderProps {
  activeSection: MainSection;
  onSelectSection: (section: MainSection) => void;
  hasActiveFile: boolean;
  invalidCount: number;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenFileClick: () => void;
}

const NAV_ITEMS: Array<{ id: MainSection; label: string }> = [
  { id: 'explorer', label: 'Explorer' },
  { id: 'statistics', label: 'Statistics' },
  { id: 'validation', label: 'Validation' },
];

export function AppHeader({
  activeSection,
  onSelectSection,
  hasActiveFile,
  invalidCount,
  theme,
  onToggleTheme,
  onOpenFileClick,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95">
      <div className="flex h-14 items-center justify-between gap-1.5 px-2.5 sm:gap-8 sm:px-6">
        {/* Zone 1: Single-line Brand Wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onSelectSection('explorer');
          }}
          className="text-[13px] font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 sm:text-base dark:text-slate-50"
        >
          JSONL Explorer
        </a>

        {/* Zone 2: Clean single-line Navigation */}
        <nav aria-label="Main navigation" className="flex items-center gap-0 sm:gap-6">
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            const disabled = !hasActiveFile && item.id !== 'explorer';
            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelectSection(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative h-14 px-1.5 text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 sm:px-2.5 sm:text-sm ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400'
                    : disabled
                      ? 'cursor-not-allowed text-slate-400 dark:text-slate-600'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                <span className="inline-flex items-center gap-0.5 sm:gap-1.5">
                  <span>{item.label}</span>
                  {item.id === 'validation' && hasActiveFile && invalidCount > 0 && (
                    <span className="font-mono text-[10px] tabular-nums text-red-600 sm:text-xs dark:text-red-400">
                      ({invalidCount})
                    </span>
                  )}
                </span>
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-1 bottom-0 h-0.5 bg-blue-600 dark:bg-blue-400"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Theme Switch & Primary Action */}
        <div className="flex items-center gap-1.5 shrink-0 sm:gap-2">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:h-9 sm:w-9 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={onOpenFileClick}
            aria-label="Open File"
            title="Open File"
            className="inline-flex h-8 w-8 items-center justify-center gap-2 rounded-md bg-blue-600 text-xs font-medium text-white whitespace-nowrap shrink-0 transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:h-9 sm:w-auto sm:px-3.5 sm:text-sm dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus-visible:ring-offset-slate-900"
          >
            <FolderOpen className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Open File</span>
          </button>
        </div>
      </div>
    </header>
  );
}
