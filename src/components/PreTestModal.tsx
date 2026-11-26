import React, { useEffect, useState } from 'react';
import { Clock, Play, Shuffle, Timer, X } from 'lucide-react';
import type { ExamConfig, QuestionSet, TimerMode } from '../types/cbt';

interface PreTestModalProps {
  questionSet: QuestionSet | null;
  onClose: () => void;
  onStartExam: (set: QuestionSet, config: ExamConfig) => void;
}

export const PreTestModal: React.FC<PreTestModalProps> = ({ questionSet, onClose, onStartExam }) => {
  const [timerMode, setTimerMode] = useState<TimerMode>('stopwatch');
  const [countdownMinutes, setCountdownMinutes] = useState<number>(20);
  const [shuffleQuestions, setShuffleQuestions] = useState<boolean>(false);
  const [shuffleOptions, setShuffleOptions] = useState<boolean>(false);

  useEffect(() => {
    if (questionSet) {
      setTimerMode('stopwatch');
      setCountdownMinutes(Math.max(1, questionSet.questions.length * 2));
      setShuffleQuestions(false);
      setShuffleOptions(false);
    }
  }, [questionSet]);

  if (!questionSet) return null;

  const mcqCount = questionSet.questions.filter((q) => q.type === 'MCQ').length;
  const numCount = questionSet.questions.filter((q) => q.type === 'NUMERICAL').length;

  const handleBegin = (e: React.FormEvent) => {
    e.preventDefault();
    const safeMinutes = Math.max(1, Math.min(360, Number.isFinite(countdownMinutes) ? Math.round(countdownMinutes) : questionSet.questions.length * 2));
    onStartExam(questionSet, {
      timerMode,
      countdownMinutes: safeMinutes,
      shuffleQuestions,
      shuffleOptions,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pretest-modal-title"
    >
      <form
        onSubmit={handleBegin}
        className="w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-xs font-medium text-slate-500">
              {questionSet.subject} · {questionSet.chapter}
            </p>
            <h2 id="pretest-modal-title" className="mt-0.5 text-lg font-semibold text-slate-900">
              {questionSet.setTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close session configuration"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <span>
              <strong className="font-semibold text-slate-900 font-mono-tabular">{questionSet.questions.length}</strong> Questions
            </span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span>
              <strong className="font-semibold text-slate-900 font-mono-tabular">{mcqCount}</strong> MCQ (+4/-1)
            </span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span>
              <strong className="font-semibold text-slate-900 font-mono-tabular">{numCount}</strong> Numerical (+4/0)
            </span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span>
              Max Marks: <strong className="font-semibold text-slate-900 font-mono-tabular">{questionSet.questions.length * 4}</strong>
            </span>
          </div>

          <fieldset className="space-y-2.5">
            <legend className="text-xs font-semibold text-slate-700">Timer Mode</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTimerMode('stopwatch')}
                className={`flex flex-col items-start gap-1.5 rounded-lg border p-3.5 text-left transition-colors ${
                  timerMode === 'stopwatch'
                    ? 'border-[#0F4C81] bg-[#0F4C81]/5 ring-1 ring-[#0F4C81]'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Timer className={`w-4 h-4 ${timerMode === 'stopwatch' ? 'text-[#0F4C81]' : 'text-slate-500'}`} aria-hidden="true" />
                  <span>Stopwatch Mode (Count-Up)</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Starts at 00:00:00 and counts up to measure exact time taken.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setTimerMode('countdown')}
                className={`flex flex-col items-start gap-1.5 rounded-lg border p-3.5 text-left transition-colors ${
                  timerMode === 'countdown'
                    ? 'border-[#0F4C81] bg-[#0F4C81]/5 ring-1 ring-[#0F4C81]'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Clock className={`w-4 h-4 ${timerMode === 'countdown' ? 'text-[#0F4C81]' : 'text-slate-500'}`} aria-hidden="true" />
                  <span>Countdown Mode (Exam Limit)</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Counts down to zero, highlights under 5m, and auto-submits.
                </p>
              </button>
            </div>

            {timerMode === 'countdown' && (
              <div className="mt-3 flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <label htmlFor="countdown-minutes-input" className="text-sm font-medium text-slate-700">
                  Duration Limit (minutes)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="countdown-minutes-input"
                    type="number"
                    min={1}
                    max={360}
                    value={countdownMinutes}
                    onChange={(e) => setCountdownMinutes(Math.max(1, parseInt(e.target.value || '1', 10)))}
                    className="w-24 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-right font-mono-tabular text-sm font-semibold text-slate-900 focus:border-[#0F4C81] focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/15"
                  />
                  <span className="text-xs text-slate-500">min</span>
                </div>
              </div>
            )}
          </fieldset>

          <fieldset className="space-y-3 border-t border-slate-200 pt-4">
            <legend className="text-xs font-semibold text-slate-700">Randomization Options</legend>

            <label className="flex items-center justify-between gap-4 cursor-pointer rounded-lg border border-slate-200 px-4 py-3 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <Shuffle className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
                <div>
                  <div className="text-sm font-medium text-slate-900">Shuffle Question Order</div>
                  <div className="text-xs text-slate-500">Randomizes question sequence for this attempt</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={shuffleQuestions}
                onChange={(e) => setShuffleQuestions(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#0F4C81] focus:ring-[#0F4C81]"
              />
            </label>

            <label className="flex items-center justify-between gap-4 cursor-pointer rounded-lg border border-slate-200 px-4 py-3 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <Shuffle className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
                <div>
                  <div className="text-sm font-medium text-slate-900">Shuffle MCQ Options</div>
                  <div className="text-xs text-slate-500">Randomizes (A)-(D) options while preserving accurate grading</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={shuffleOptions}
                onChange={(e) => setShuffleOptions(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#0F4C81] focus:ring-[#0F4C81]"
              />
            </label>
          </fieldset>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-[#0F4C81] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0B3A63] transition-colors whitespace-nowrap shrink-0"
          >
            <Play className="w-4 h-4" aria-hidden="true" />
            Launch CBT Session
          </button>
        </div>
      </form>
    </div>
  );
};
