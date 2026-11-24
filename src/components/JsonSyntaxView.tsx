import { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { tokenizeJson, type JsonTokenKind } from '../core/formatters';

interface JsonSyntaxViewProps {
  value?: unknown;
  rawText?: string;
  defaultPretty?: boolean;
  showControls?: boolean;
  maxHeightClass?: string;
}

const TOKEN_CLASSES: Record<JsonTokenKind, string> = {
  key: 'text-sky-700 dark:text-sky-300',
  string: 'text-emerald-700 dark:text-emerald-300',
  number: 'text-amber-700 dark:text-amber-300',
  boolean: 'text-purple-700 dark:text-purple-300',
  null: 'text-rose-600 dark:text-rose-400 italic',
  punctuation: 'text-slate-500 dark:text-slate-400',
  whitespace: '',
};

/**
 * Safe syntax-highlighted JSON viewer (FR-019, NFR 5.3).
 * Renders tokens strictly as React text nodes (zero dangerouslySetInnerHTML).
 */
export function JsonSyntaxView({
  value,
  rawText,
  defaultPretty = true,
  showControls = true,
  maxHeightClass = '',
}: JsonSyntaxViewProps) {
  const [pretty, setPretty] = useState(defaultPretty);
  const [copied, setCopied] = useState(false);

  const formattedText = useMemo(() => {
    if (value !== undefined) {
      try {
        return JSON.stringify(value, null, pretty ? 2 : 0);
      } catch {
        return rawText ?? String(value);
      }
    }
    return rawText ?? '';
  }, [value, rawText, pretty]);

  const tokens = useMemo(() => {
    // Guard against huge single-line records freezing token DOM rendering
    if (formattedText.length > 150_000) {
      return null;
    }
    return tokenizeJson(formattedText);
  }, [formattedText]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard may be unavailable in restricted contexts
    }
  };

  return (
    <div className="flex flex-col">
      {showControls && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100/80 p-0.5 dark:border-slate-700 dark:bg-slate-800/80">
            <button
              type="button"
              onClick={() => setPretty(true)}
              className={`rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                pretty
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-50'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              Formatted
            </button>
            <button
              type="button"
              onClick={() => setPretty(false)}
              className={`rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                !pretty
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-50'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              Compact
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 whitespace-nowrap transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Copy JSON</span>
              </>
            )}
          </button>
        </div>
      )}

      <pre
        className={`overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3.5 font-mono text-xs leading-relaxed text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 ${maxHeightClass}`}
      >
        <code>
          {tokens
            ? tokens.map((tok, idx) =>
                tok.kind === 'whitespace' ? (
                  tok.text
                ) : (
                  <span key={idx} className={TOKEN_CLASSES[tok.kind]}>
                    {tok.text}
                  </span>
                )
              )
            : formattedText}
        </code>
      </pre>
    </div>
  );
}
