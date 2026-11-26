import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ClipboardPaste,
  Download,
  FileDown,
  FileUp,
  History,
  Play,
  RotateCcw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import type { QuestionSet, SessionAttempt, SubjectCategory } from '../types/cbt';
import { getSampleJsonTemplate } from '../data/demoSets';
import { computeSetBestStats, formatDurationVerbose } from '../utils/examEngine';
import { validateAndParseQuestionSet, validateBackupPayload } from '../utils/jsonSanitizer';
import { PWAInstallButton } from './PWAInstallButton';

interface DashboardProps {
  questionSets: QuestionSet[];
  sessions: SessionAttempt[];
  isLoading: boolean;
  onOpenPasteModal: () => void;
  onImportSet: (set: QuestionSet, repairedCount: number) => Promise<void>;
  onDeleteSet: (id: string) => Promise<void>;
  onStartConfigure: (set: QuestionSet) => void;
  onLoadBuiltInDemo: () => Promise<void>;
  onOpenSessionReport: (session: SessionAttempt) => void;
  onDeleteSession: (id: string) => Promise<void>;
  onExportAllBackup: () => Promise<void>;
  onRestoreAllBackup: (fileText: string) => Promise<{ ok: true; setsRestored: number; sessionsRestored: number } | { ok: false; error: string }>;
}

const SUBJECT_FILTERS: Array<'All' | SubjectCategory> = [
  'All',
  'Physics',
  'Chemistry',
  'Mathematics',
  'Full Mock',
];

function triggerDownload(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const Dashboard: React.FC<DashboardProps> = ({
  questionSets,
  sessions,
  isLoading,
  onOpenPasteModal,
  onImportSet,
  onDeleteSet,
  onStartConfigure,
  onLoadBuiltInDemo,
  onOpenSessionReport,
  onDeleteSession,
  onExportAllBackup,
  onRestoreAllBackup,
}) => {
  const [subjectFilter, setSubjectFilter] = useState<'All' | SubjectCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; title: string; details?: string[] } | null>(null);
  const [confirmDeleteSetId, setConfirmDeleteSetId] = useState<string | null>(null);
  const [confirmDeleteSessionId, setConfirmDeleteSessionId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const filteredSets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return questionSets.filter((set) => {
      if (subjectFilter !== 'All' && set.subject !== subjectFilter) return false;
      if (!q) return true;
      return (
        set.setTitle.toLowerCase().includes(q) ||
        set.chapter.toLowerCase().includes(q) ||
        set.subject.toLowerCase().includes(q)
      );
    });
  }, [questionSets, subjectFilter, searchQuery]);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setBanner(null);

    const importedNames: string[] = [];
    const errorMessages: string[] = [];
    let totalRepaired = 0;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      try {
        const text = await file.text();
        const result = validateAndParseQuestionSet(text);
        if (!result.ok) {
          errorMessages.push(`${file.name}: ${result.errors.join(' | ')}`);
          continue;
        }
        const now = Date.now() + i;
        const newSet: QuestionSet = {
          id: `set-${now}-${Math.random().toString(36).slice(2, 8)}`,
          ...result.questionSet,
          createdAt: now,
          updatedAt: now,
        };
        await onImportSet(newSet, result.repairedBackslashes);
        importedNames.push(`${newSet.setTitle} (${newSet.questions.length} Qs)`);
        totalRepaired += result.repairedBackslashes;
      } catch (err) {
        errorMessages.push(`${file.name}: ${err instanceof Error ? err.message : 'Could not read file.'}`);
      }
    }

    if (errorMessages.length > 0 && importedNames.length === 0) {
      setBanner({
        type: 'error',
        title: 'Import failed — please verify JSON schema',
        details: errorMessages,
      });
    } else if (errorMessages.length > 0) {
      setBanner({
        type: 'error',
        title: `Imported ${importedNames.length} file(s), but ${errorMessages.length} failed`,
        details: errorMessages,
      });
    } else if (importedNames.length > 0) {
      const repairNote =
        totalRepaired > 0
          ? `Auto-repaired ${totalRepaired} unescaped LaTeX backslash${totalRepaired === 1 ? '' : 'es'}.`
          : undefined;
      setBanner({
        type: 'success',
        title: `Imported ${importedNames.join(', ')}`,
        details: repairNote ? [repairNote] : undefined,
      });
    }
  };

  const handleDownloadSampleTemplate = () => {
    triggerDownload('jee_cbt_sample_template.json', getSampleJsonTemplate());
  };

  const handleExportSingleSet = (set: QuestionSet) => {
    const cleanPayload = {
      setTitle: set.setTitle,
      subject: set.subject,
      chapter: set.chapter,
      questions: set.questions,
    };
    const slug = set.setTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    triggerDownload(`${slug || 'question_set'}.json`, JSON.stringify(cleanPayload, null, 2));
  };

  const handleRestoreFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBanner(null);

    try {
      const text = await file.text();
      const check = validateBackupPayload(text);
      if (check.ok === false) {
        setBanner({ type: 'error', title: 'Backup restore failed', details: [check.error] });
        return;
      }
      const res = await onRestoreAllBackup(text);
      if (res.ok === false) {
        setBanner({ type: 'error', title: 'Backup restore failed', details: [res.error] });
      } else {
        setBanner({
          type: 'success',
          title: `Restored ${res.setsRestored} question set(s) and ${res.sessionsRestored} session record(s).`,
        });
      }
    } catch (err) {
      setBanner({
        type: 'error',
        title: 'Backup restore failed',
        details: [err instanceof Error ? err.message : 'Unable to read backup file.'],
      });
    }
  };

  const handleLoadDemoClick = async () => {
    await onLoadBuiltInDemo();
    setBanner({
      type: 'success',
      title: 'Built-in 10-question JEE Main Diagnostic Set loaded into IndexedDB.',
    });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col">
      {/* 3-Zone Top Header Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-8 px-6 py-3.5">
          {/* Zone 1: Wordmark */}
          <a
            href="#library"
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            JEE Main CBT Studio
          </a>

          {/* Zone 2: Clean single-line navigation links */}
          <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#library" className="hover:text-[#0F4C81] transition-colors whitespace-nowrap shrink-0">
              Chapter Library
            </a>
            <a href="#history" className="hover:text-[#0F4C81] transition-colors whitespace-nowrap shrink-0">
              Session History
            </a>
          </nav>

          {/* Zone 3: Backup & Install Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            <input
              ref={restoreInputRef}
              type="file"
              accept=".json"
              onChange={handleRestoreFileChange}
              className="hidden"
              aria-label="Restore Backup JSON File"
            />
            <button
              type="button"
              onClick={() => restoreInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              Restore Backup (.json)
            </button>
            <button
              type="button"
              onClick={onExportAllBackup}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F4C81] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0B3A63] transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              Export All Data Backup (.json)
            </button>
            <PWAInstallButton />
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="mx-auto w-full max-w-[1380px] flex-1 px-6 py-8">
        {/* Page Heading */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 text-balance">
              Computer-Based Test Workbench
            </h1>
            <p className="mt-1 text-sm text-slate-600 max-w-2xl">
              Offline-ready JEE Main practice environment with KaTeX math and chemistry rendering, per-question time accounting, and mistake review diagnostics.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownloadSampleTemplate}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <FileDown className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              Download Sample JSON Template
            </button>
            <button
              type="button"
              onClick={handleLoadDemoClick}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              Load Built-in Demo Set
            </button>
            <button
              type="button"
              onClick={onOpenPasteModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <ClipboardPaste className="w-3.5 h-3.5" aria-hidden="true" />
              Paste Raw JSON
            </button>
          </div>
        </div>

        {/* Status / Validation Feedback Banner */}
        {banner && (
          <div
            role={banner.type === 'error' ? 'alert' : 'status'}
            className={`mb-6 flex items-start justify-between gap-4 rounded-xl border px-4 py-3.5 text-sm ${
              banner.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-900'
                : 'border-emerald-200 bg-emerald-50 text-emerald-900'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {banner.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" aria-hidden="true" />
              )}
              <div>
                <div className="font-semibold">{banner.title}</div>
                {banner.details && banner.details.length > 0 && (
                  <ul className="mt-1 list-disc pl-4 text-xs space-y-0.5">
                    {banner.details.map((d, idx) => (
                      <li key={idx}>{d}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setBanner(null)}
              className="text-xs font-medium underline opacity-75 hover:opacity-100 shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left / Main Area: Chapter Library */}
          <section id="library" aria-labelledby="chapter-library-heading" className="lg:col-span-8 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#0F4C81]" aria-hidden="true" />
                <h2 id="chapter-library-heading" className="text-lg font-semibold text-slate-900">
                  Chapter Library
                </h2>
                <span className="text-xs font-mono-tabular text-slate-500 ml-1">
                  ({filteredSets.length})
                </span>
              </div>

              {/* Search Input */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by chapter or title..."
                  aria-label="Search question sets by chapter or title"
                  className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0F4C81] focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/15"
                />
              </div>
            </div>

            {/* Subject Filter Tabs */}
            <div role="tablist" aria-label="Filter library by subject" className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100/80 p-1">
              {SUBJECT_FILTERS.map((subj) => {
                const isActive = subjectFilter === subj;
                return (
                  <button
                    key={subj}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setSubjectFilter(subj)}
                    className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-white text-[#0F4C81] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {subj}
                  </button>
                );
              })}
            </div>

            {/* Drag-and-Drop JSON Import Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                void handleFiles(e.dataTransfer.files);
              }}
              className={`rounded-xl border border-dashed p-5 transition-colors ${
                isDragging
                  ? 'border-[#0F4C81] bg-[#0F4C81]/5'
                  : 'border-slate-300 bg-white hover:border-slate-400'
              }`}
            >
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-[#0F4C81] shrink-0">
                    <FileUp className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      Import Question Sets (.json)
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Drag and drop one or more .json files here, or browse from disk. Stored offline in IndexedDB.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    multiple
                    onChange={(e) => {
                      void handleFiles(e.target.files);
                      e.target.value = '';
                    }}
                    className="hidden"
                    aria-label="Upload JSON question set files"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    Browse .json Files
                  </button>
                </div>
              </div>
            </div>

            {/* Question Set Cards */}
            {isLoading ? (
              <div className="space-y-3" aria-busy="true">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-32 rounded-xl border border-slate-200 bg-white animate-pulse" />
                ))}
              </div>
            ) : filteredSets.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
                <p className="text-sm font-semibold text-slate-800">No question sets match your filter</p>
                <p className="mt-1 text-xs text-slate-500">
                  Import a .json chapter file, paste raw JSON, or restore the built-in 10-question JEE Main demo set.
                </p>
                <div className="mt-4 flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSubjectFilter('All');
                      setSearchQuery('');
                    }}
                    className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Clear Filters
                  </button>
                  <button
                    type="button"
                    onClick={handleLoadDemoClick}
                    className="rounded-lg bg-[#0F4C81] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B3A63]"
                  >
                    Load Built-in Demo Set
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5">
                {filteredSets.map((set) => {
                  const mcqCount = set.questions.filter((q) => q.type === 'MCQ').length;
                  const numCount = set.questions.filter((q) => q.type === 'NUMERICAL').length;
                  const stats = computeSetBestStats(sessions, set.id);
                  const isConfirmingDelete = confirmDeleteSetId === set.id;

                  return (
                    <article
                      key={set.id}
                      className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300 space-y-4"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="font-semibold text-[#0F4C81]">{set.subject}</span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate max-w-[460px]">{set.chapter}</span>
                          {set.isBuiltInDemo && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-slate-600 font-medium whitespace-nowrap">Built-in Diagnostic</span>
                            </>
                          )}
                        </div>

                        <h3 className="mt-1 text-base font-semibold text-slate-900">
                          {set.setTitle}
                        </h3>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                          <span className="font-mono-tabular whitespace-nowrap">
                            <strong className="font-semibold text-slate-900">{set.questions.length}</strong> Qs ({mcqCount} MCQ, {numCount} Num)
                          </span>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span className="font-mono-tabular whitespace-nowrap">
                            Best:{' '}
                            <strong className="font-semibold text-slate-900">
                              {stats.bestAccuracy !== null ? `${stats.bestAccuracy}%` : '—'}
                            </strong>
                          </span>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span className="font-mono-tabular whitespace-nowrap">
                            Fastest:{' '}
                            <strong className="font-semibold text-slate-900">
                              {stats.fastestSeconds !== null ? formatDurationVerbose(stats.fastestSeconds) : '—'}
                            </strong>
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleExportSingleSet(set)}
                            aria-label={`Export ${set.setTitle}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                          >
                            <Download className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                            Export Set
                          </button>

                          {isConfirmingDelete ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={async () => {
                                  await onDeleteSet(set.id);
                                  setConfirmDeleteSetId(null);
                                }}
                                aria-label={`Confirm delete ${set.setTitle}`}
                                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors whitespace-nowrap shrink-0"
                              >
                                Confirm Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteSetId(null)}
                                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap shrink-0"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteSetId(set.id)}
                              aria-label={`Delete ${set.setTitle}`}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 hover:border-red-200 transition-colors whitespace-nowrap shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              Delete Set
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onStartConfigure(set)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F4C81] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#0B3A63] transition-colors whitespace-nowrap shrink-0"
                          >
                            <Play className="w-3.5 h-3.5" aria-hidden="true" />
                            Start Practice
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* Right / Bottom Area: Past Session History */}
          <aside id="history" aria-labelledby="session-history-heading" className="lg:col-span-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-[#0F4C81]" aria-hidden="true" />
                <h2 id="session-history-heading" className="text-lg font-semibold text-slate-900">
                  Past Session History
                </h2>
              </div>
              <span className="text-xs font-mono-tabular text-slate-500">
                {sessions.length} {sessions.length === 1 ? 'attempt' : 'attempts'}
              </span>
            </div>

            {sessions.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
                <p className="text-sm font-semibold text-slate-800">No completed sessions yet</p>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Launch any chapter set to record your net score (+4/-1), accuracy, and per-question timing diagnostics.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((sess) => {
                  const dateLabel = new Date(sess.completedAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const modeLabel =
                    sess.timerMode === 'countdown'
                      ? `Countdown (${sess.countdownMinutes ?? 0}m)`
                      : 'Stopwatch';

                  return (
                    <article
                      key={sess.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                          <span className="font-mono-tabular">{dateLabel}</span>
                          <span>{modeLabel}</span>
                        </div>
                        <h3 className="mt-1 text-sm font-semibold text-slate-900 leading-snug">
                          {sess.setTitle}
                          {sess.isSubsetAttempt ? ' (Mistake Re-attempt)' : ''}
                        </h3>
                      </div>

                      <div className="grid grid-cols-3 gap-2 border-y border-slate-100 py-2.5 text-center">
                        <div>
                          <div className="text-[11px] text-slate-500">Score</div>
                          <div className="text-sm font-semibold text-slate-900 font-mono-tabular">
                            {sess.netScore}/{sess.maxScore}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-500">Accuracy</div>
                          <div className="text-sm font-semibold text-slate-900 font-mono-tabular">
                            {sess.accuracyPercent}%
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-500">Time</div>
                          <div className="text-sm font-semibold text-slate-900 font-mono-tabular">
                            {formatDurationVerbose(sess.totalTimeSeconds)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        {confirmDeleteSessionId === sess.id ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                await onDeleteSession(sess.id);
                                setConfirmDeleteSessionId(null);
                              }}
                              className="rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteSessionId(null)}
                              className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteSessionId(sess.id)}
                            aria-label={`Delete attempt for ${sess.setTitle} on ${dateLabel}`}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onOpenSessionReport(sess)}
                          className="rounded-lg border border-[#0F4C81]/30 bg-[#0F4C81]/5 px-3.5 py-1.5 text-xs font-semibold text-[#0F4C81] hover:bg-[#0F4C81]/10 transition-colors whitespace-nowrap shrink-0"
                        >
                          Analytics & Solutions
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
};
