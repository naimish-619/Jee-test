import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Flag,
  MinusCircle,
  RotateCcw,
  Target,
  XCircle,
} from 'lucide-react';
import type { QuestionAttemptRecord, QuestionSet, SessionAttempt } from '../types/cbt';
import { computeSessionAnalytics, formatDurationVerbose, formatMS } from '../utils/examEngine';
import { MathText } from './MathText';
import { PerformanceTrendChart } from './PerformanceTrendChart';

interface AnalyticsScreenProps {
  session: SessionAttempt;
  allSessions: SessionAttempt[];
  sourceSet: QuestionSet | undefined;
  onBackToDashboard: () => void;
  onSelectSession: (session: SessionAttempt) => void;
  onReattemptFullSet: (set: QuestionSet) => void;
  onReattemptMistakes: (set: QuestionSet, subsetIndices: number[]) => void;
}

type ReviewFilter = 'all' | 'incorrect' | 'unattempted' | 'slow' | 'flagged';

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

export const AnalyticsScreen: React.FC<AnalyticsScreenProps> = ({
  session,
  allSessions,
  sourceSet,
  onBackToDashboard,
  onSelectSession,
  onReattemptFullSet,
  onReattemptMistakes,
}) => {
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [expandedMap, setExpandedMap] = useState<Record<number, boolean>>(() => {
    const init: Record<number, boolean> = {};
    session.questionResults.forEach((r, idx) => {
      if (r.isAttempted && !r.isCorrect) {
        init[idx] = true;
      }
    });
    return init;
  });

  const analytics = useMemo(() => computeSessionAnalytics(session), [session]);

  const mistakeOriginalIndices = useMemo(() => {
    const indices = session.questionResults
      .filter((r) => !r.isAttempted || !r.isCorrect)
      .map((r) => r.originalIndex);
    return Array.from(new Set(indices));
  }, [session.questionResults]);

  const indexedResults = useMemo(
    () => session.questionResults.map((record, idx) => ({ record, displayNumber: idx + 1, idx })),
    [session.questionResults]
  );

  const filteredResults = useMemo(() => {
    switch (filter) {
      case 'incorrect':
        return indexedResults.filter(({ record }) => record.isAttempted && !record.isCorrect);
      case 'unattempted':
        return indexedResults.filter(({ record }) => !record.isAttempted);
      case 'slow':
        return indexedResults.filter(({ record }) => record.timeSpentSeconds > 150);
      case 'flagged':
        return indexedResults.filter(({ record }) => record.isFlagged);
      default:
        return indexedResults;
    }
  }, [indexedResults, filter]);

  const toggleExpand = (idx: number) => {
    setExpandedMap((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const expandAll = (open: boolean) => {
    const next: Record<number, boolean> = {};
    filteredResults.forEach(({ idx }) => {
      next[idx] = open;
    });
    setExpandedMap(next);
  };

  const formatMcqLabel = (record: QuestionAttemptRecord, origIndexStr: string | null): string => {
    if (origIndexStr === null) return '—';
    const origIdx = Number(origIndexStr);
    const displayPos = record.optionOrder.length > 0 ? record.optionOrder.indexOf(origIdx) : origIdx;
    if (displayPos >= 0 && displayPos < 4) {
      return `(${OPTION_LETTERS[displayPos]})`;
    }
    return `(${OPTION_LETTERS[origIdx] ?? origIndexStr})`;
  };

  const completedLabel = new Date(session.completedAt).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-6 px-6 py-3.5">
          <div className="flex items-center gap-4 min-w-0">
            <button
              type="button"
              onClick={onBackToDashboard}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              Back to Dashboard
            </button>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-slate-900 truncate">
                Session Analysis: {session.setTitle}
              </h1>
              <p className="text-xs text-slate-500 truncate">
                {session.subject} · {session.chapter} · {completedLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {sourceSet && (
              <>
                <button
                  type="button"
                  onClick={() => onReattemptFullSet(sourceSet)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  Re-attempt Full Set
                </button>
                <button
                  type="button"
                  disabled={mistakeOriginalIndices.length === 0}
                  onClick={() => onReattemptMistakes(sourceSet, mistakeOriginalIndices)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F4C81] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B3A63] disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0"
                >
                  <Target className="w-3.5 h-3.5" aria-hidden="true" />
                  Re-attempt Incorrect & Unattempted Only ({mistakeOriginalIndices.length})
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1380px] px-6 py-8 space-y-8">
        {/* Top KPI Summary Cards */}
        <section aria-label="Session Performance Summary" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs font-medium text-slate-500">Total Time Required</div>
            <div className="mt-1.5 text-2xl font-bold text-slate-900 font-mono-tabular">
              {formatDurationVerbose(session.totalTimeSeconds)}
            </div>
            <div className="mt-2 text-xs text-slate-600 font-mono-tabular">
              Avg: {analytics.avgSecondsPerAttempted}s / attempted Q
              {session.tabSwitchCount > 0 && ` · ${session.tabSwitchCount} tab switch${session.tabSwitchCount === 1 ? '' : 'es'}`}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs font-medium text-slate-500">Net Score (+4 / -1)</div>
            <div className="mt-1.5 text-2xl font-bold text-[#0F4C81] font-mono-tabular">
              {session.netScore} <span className="text-base font-medium text-slate-500">/ {session.maxScore}</span>
            </div>
            <div className="mt-2 text-xs text-slate-600">
              Mode: {session.timerMode === 'countdown' ? `Countdown (${session.countdownMinutes ?? 0}m)` : 'Stopwatch'}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs font-medium text-slate-500">Accuracy</div>
            <div className="mt-1.5 text-2xl font-bold text-slate-900 font-mono-tabular">
              {session.accuracyPercent}%
            </div>
            <div className="mt-2 text-xs text-slate-600 font-mono-tabular">
              {session.correctCount} correct out of {session.correctCount + session.incorrectCount} attempted
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs font-medium text-slate-500">Attempt Breakdown</div>
            <div className="mt-2.5 grid grid-cols-3 divide-x divide-slate-200 text-center">
              <div className="py-1">
                <div className="text-lg font-bold text-emerald-700 font-mono-tabular">{session.correctCount}</div>
                <div className="text-[11px] font-medium text-emerald-800">Correct</div>
              </div>
              <div className="py-1">
                <div className="text-lg font-bold text-red-700 font-mono-tabular">{session.incorrectCount}</div>
                <div className="text-[11px] font-medium text-red-800">Incorrect</div>
              </div>
              <div className="py-1">
                <div className="text-lg font-bold text-slate-700 font-mono-tabular">{session.unattemptedCount}</div>
                <div className="text-[11px] font-medium text-slate-600">Skipped</div>
              </div>
            </div>
          </div>
        </section>

        {/* Speed & Time-Sink Diagnostics */}
        <section aria-labelledby="speed-diagnostics-heading" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#0F4C81]" aria-hidden="true" />
              <h2 id="speed-diagnostics-heading" className="text-base font-semibold text-slate-900">
                Speed Diagnostics
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3.5">
                <div className="text-xs font-medium text-emerald-800">Avg Time on Correct Qs</div>
                <div className="mt-1 text-xl font-bold text-emerald-900 font-mono-tabular">
                  {formatMS(analytics.avgTimeCorrect)}
                </div>
                <div className="mt-0.5 text-[11px] text-emerald-700 font-mono-tabular">
                  ({analytics.avgTimeCorrect}s average)
                </div>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50/50 p-3.5">
                <div className="text-xs font-medium text-red-800">Avg Time on Incorrect Qs</div>
                <div className="mt-1 text-xl font-bold text-red-900 font-mono-tabular">
                  {formatMS(analytics.avgTimeIncorrect)}
                </div>
                <div className="mt-0.5 text-[11px] text-red-700 font-mono-tabular">
                  ({analytics.avgTimeIncorrect}s average)
                </div>
              </div>
            </div>

            {session.tabSwitchCount > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
                <strong>Focus Note:</strong> {session.tabSwitchCount} browser tab switch{session.tabSwitchCount === 1 ? '' : 'es'} detected during this attempt.
              </div>
            )}
          </div>

          <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" aria-hidden="true" />
                <h2 className="text-base font-semibold text-slate-900">
                  Time-Sink Alert (&gt; 2.5 minutes per question)
                </h2>
              </div>
              <span className="text-xs font-mono-tabular text-slate-500">
                {analytics.timeSinkQuestions.length} detected
              </span>
            </div>

            {analytics.timeSinkQuestions.length === 0 ? (
              <p className="text-sm text-slate-600 py-2">
                No questions exceeded 150 seconds (02:30). Good pacing discipline across the test.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                {analytics.timeSinkQuestions.map(({ displayNumber, record }) => (
                  <div key={displayNumber} className="flex items-center justify-between gap-4 px-4 py-2.5 text-xs bg-amber-50/30">
                    <div className="flex items-center gap-3">
                      <span className="font-bold font-mono-tabular text-slate-900">Q.{displayNumber}</span>
                      <span className="text-slate-600 font-mono-tabular">
                        Time: <strong className="text-slate-900">{formatMS(record.timeSpentSeconds)}</strong>
                      </span>
                    </div>
                    <span
                      className={`font-semibold ${
                        !record.isAttempted
                          ? 'text-slate-600'
                          : record.isCorrect
                            ? 'text-emerald-700'
                            : 'text-red-700'
                      }`}
                    >
                      {!record.isAttempted ? 'Unattempted' : record.isCorrect ? 'Ended Correct (+4)' : 'Ended Incorrect'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Performance Trend Bar Chart across multiple sessions of the same question set */}
        <PerformanceTrendChart
          allSessions={allSessions}
          currentSession={session}
          onSelectSession={onSelectSession}
        />

        {/* Detailed Question-by-Question Review & Solutions */}
        <section aria-labelledby="question-review-heading" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 id="question-review-heading" className="text-lg font-semibold text-slate-900">
              Question-by-Question Review & Solutions
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => expandAll(true)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Expand All Solutions
              </button>
              <button
                type="button"
                onClick={() => expandAll(false)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Collapse All
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div role="tablist" aria-label="Filter reviewed questions" className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100/80 p-1">
            {(
              [
                { id: 'all', label: `All Questions (${indexedResults.length})` },
                { id: 'incorrect', label: `Incorrect Only (${session.incorrectCount})` },
                { id: 'unattempted', label: `Unattempted Only (${session.unattemptedCount})` },
                { id: 'slow', label: `Slow (>2.5m) (${analytics.timeSinkQuestions.length})` },
                { id: 'flagged', label: `Flagged (${analytics.flaggedQuestions.length})` },
              ] as Array<{ id: ReviewFilter; label: string }>
            ).map((tab) => {
              const active = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(tab.id)}
                  className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    active ? 'bg-white text-[#0F4C81] shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {filteredResults.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
              No questions match this filter category.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredResults.map(({ record, displayNumber, idx }) => {
                const isExpanded = Boolean(expandedMap[idx]);
                const statusLabel = !record.isAttempted
                  ? 'Unattempted'
                  : record.isCorrect
                    ? 'Correct (+4)'
                    : record.type === 'MCQ'
                      ? 'Incorrect (-1)'
                      : 'Incorrect (0)';

                return (
                  <article
                    key={idx}
                    className="rounded-xl border border-slate-200 bg-white overflow-hidden"
                  >
                    {/* Summary Row */}
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/70 px-5 py-3">
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <span className="font-bold text-slate-900 font-mono-tabular">
                          Q.{displayNumber}
                        </span>
                        <span className="text-slate-500">{record.type}</span>
                        <span className="text-slate-300" aria-hidden="true">·</span>

                        {!record.isAttempted ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-600">
                            <MinusCircle className="w-3.5 h-3.5" aria-hidden="true" />
                            {statusLabel}
                          </span>
                        ) : record.isCorrect ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                            {statusLabel}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                            <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                            {statusLabel}
                          </span>
                        )}

                        {record.isFlagged && (
                          <>
                            <span className="text-slate-300" aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                              <Flag className="w-3 h-3 fill-amber-500" aria-hidden="true" />
                              Flagged
                            </span>
                          </>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs">
                        <span className="font-mono-tabular text-slate-600">
                          Your Ans:{' '}
                          <strong className="text-slate-900">
                            {record.type === 'MCQ'
                              ? formatMcqLabel(record, record.userAnswer)
                              : record.userAnswer ?? '—'}
                          </strong>
                        </span>
                        <span className="font-mono-tabular text-slate-600">
                          Correct:{' '}
                          <strong className="text-emerald-700">
                            {record.type === 'MCQ'
                              ? formatMcqLabel(record, record.correctAnswer)
                              : record.correctAnswer}
                          </strong>
                        </span>
                        <span className="font-mono-tabular text-slate-600">
                          Time:{' '}
                          <strong className={record.timeSpentSeconds > 150 ? 'text-amber-700' : 'text-slate-900'}>
                            {formatMS(record.timeSpentSeconds)}
                          </strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleExpand(idx)}
                          aria-expanded={isExpanded}
                          className="inline-flex items-center gap-1 font-semibold text-[#0F4C81] hover:underline"
                        >
                          {isExpanded ? (
                            <>
                              Hide Details
                              <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                            </>
                          ) : (
                            <>
                              View Question & Solution
                              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Question, Options, and KaTeX Solution */}
                    {isExpanded && (
                      <div className="p-5 lg:p-6 space-y-5">
                        <div className="text-[15.5px] leading-relaxed text-slate-900">
                          <MathText text={record.question} />
                        </div>

                        {record.image && (
                          <div className="flex justify-center">
                            <img
                              src={record.image}
                              alt={`Diagram for Question ${displayNumber}`}
                              referrerPolicy="no-referrer"
                              className="max-h-64 rounded-lg border border-slate-200 object-contain p-2 bg-white"
                            />
                          </div>
                        )}

                        {record.type === 'MCQ' && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            {(record.optionOrder.length === 4 ? record.optionOrder : [0, 1, 2, 3]).map(
                              (origOptIdx, displayIdx) => {
                                const isCorrectOpt = String(origOptIdx) === record.correctAnswer;
                                const isUserOpt = record.userAnswer === String(origOptIdx);
                                const letter = OPTION_LETTERS[displayIdx];

                                let cardStyle = 'border-slate-200 bg-slate-50/50 text-slate-800';
                                if (isCorrectOpt) {
                                  cardStyle = 'border-emerald-300 bg-emerald-50 text-emerald-950';
                                } else if (isUserOpt && !isCorrectOpt) {
                                  cardStyle = 'border-red-300 bg-red-50 text-red-950';
                                }

                                return (
                                  <div
                                    key={displayIdx}
                                    className={`flex items-start justify-between gap-3 rounded-lg border p-3 text-sm ${cardStyle}`}
                                  >
                                    <div className="flex items-start gap-2.5">
                                      <span className="font-mono-tabular font-bold shrink-0">({letter})</span>
                                      <MathText text={record.options[origOptIdx] ?? ''} />
                                    </div>
                                    <div className="shrink-0 text-[11px] font-semibold">
                                      {isCorrectOpt && <span className="text-emerald-700">Correct</span>}
                                      {isUserOpt && !isCorrectOpt && <span className="text-red-700">Your Choice</span>}
                                      {isUserOpt && isCorrectOpt && <span className="text-emerald-700 ml-1">(Yours)</span>}
                                    </div>
                                  </div>
                                );
                              }
                            )}
                          </div>
                        )}

                        {record.type === 'NUMERICAL' && (
                          <div className="flex flex-wrap gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-mono-tabular">
                            <span>
                              Your Answer: <strong className="text-slate-900">{record.userAnswer ?? 'Unattempted'}</strong>
                            </span>
                            <span>
                              Correct Answer: <strong className="text-emerald-700">{record.correctAnswer}</strong>
                            </span>
                            <span>
                              Allowed Tolerance: <strong className="text-slate-700">±{record.tolerance}</strong>
                            </span>
                          </div>
                        )}

                        {/* Step-by-Step Solution */}
                        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 space-y-1.5">
                          <div className="text-xs font-bold text-[#0F4C81]">Step-by-Step Solution</div>
                          <div className="text-sm leading-relaxed text-slate-800">
                            {record.solution ? (
                              <MathText text={record.solution} />
                            ) : (
                              <span className="text-slate-500">No detailed solution provided for this question.</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
