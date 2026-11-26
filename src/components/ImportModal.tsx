import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, FileCode2, X } from 'lucide-react';
import { validateAndParseQuestionSet } from '../utils/jsonSanitizer';
import type { QuestionSet } from '../types/cbt';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (set: QuestionSet, repairedCount: number) => Promise<void>;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImportSuccess }) => {
  const [rawJson, setRawJson] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [repairedNotice, setRepairedNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleValidateAndImport = async () => {
    setErrors([]);
    setRepairedNotice(null);

    const parsed = validateAndParseQuestionSet(rawJson);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const now = Date.now();
      const newSet: QuestionSet = {
        id: `set-${now}-${Math.random().toString(36).slice(2, 8)}`,
        ...parsed.questionSet,
        createdAt: now,
        updatedAt: now,
      };
      await onImportSuccess(newSet, parsed.repairedBackslashes);
      setRawJson('');
      setErrors([]);
      setRepairedNotice(null);
      onClose();
    } catch (err) {
      setErrors([`IndexedDB storage error: ${err instanceof Error ? err.message : 'Unable to save set.'}`]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckOnly = () => {
    setErrors([]);
    setRepairedNotice(null);
    const parsed = validateAndParseQuestionSet(rawJson);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    const repairText =
      parsed.repairedBackslashes > 0
        ? ` (${parsed.repairedBackslashes} unescaped LaTeX backslash${parsed.repairedBackslashes === 1 ? '' : 'es'} auto-repaired)`
        : '';
    setRepairedNotice(
      `Valid schema: "${parsed.questionSet.setTitle}" · ${parsed.questionSet.subject} · ${parsed.questionSet.questions.length} questions${repairText}.`
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paste-json-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <FileCode2 className="w-5 h-5 text-[#0F4C81]" aria-hidden="true" />
            <h2 id="paste-json-title" className="text-base font-semibold text-slate-900">
              Paste Raw Question Set JSON
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close paste JSON modal"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            Paste a question bank JSON object matching the JEE CBT schema. Unescaped single LaTeX backslashes
            (such as <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">\frac</code>,{' '}
            <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">\theta</code>,{' '}
            <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">\rightarrow</code>, or{' '}
            <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">\ce&#123;...&#125;</code>) are automatically repaired before parsing.
          </p>

          <div>
            <label htmlFor="raw-json-textarea" className="block text-xs font-semibold text-slate-700 mb-1.5">
              JSON Payload
            </label>
            <textarea
              id="raw-json-textarea"
              value={rawJson}
              onChange={(e) => {
                setRawJson(e.target.value);
                if (errors.length > 0) setErrors([]);
                if (repairedNotice) setRepairedNotice(null);
              }}
              placeholder='{
  "setTitle": "Rotational Motion - Set 1",
  "subject": "Physics",
  "chapter": "Rotational Motion",
  "questions": [ ... ]
}'
              rows={13}
              spellCheck={false}
              className="w-full rounded-lg border border-slate-300 bg-slate-50/70 p-3.5 font-mono text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#0F4C81] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/15"
            />
          </div>

          {repairedNotice && (
            <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" aria-hidden="true" />
              <span>{repairedNotice}</span>
            </div>
          )}

          {errors.length > 0 && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              <div className="flex items-center gap-2 font-semibold text-red-800 mb-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Validation Failed ({errors.length} {errors.length === 1 ? 'issue' : 'issues'})</span>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-xs text-red-800">
                {errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 rounded-b-xl">
          <button
            type="button"
            onClick={handleCheckOnly}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
          >
            Validate Schema
          </button>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleValidateAndImport}
              disabled={isSubmitting}
              className="rounded-lg bg-[#0F4C81] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0B3A63] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              {isSubmitting ? 'Importing...' : 'Import to Library'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
