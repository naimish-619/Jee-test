import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  Delete,
  Eraser,
  Eye,
  FileText,
  Flag,
  Pause,
  Play,
  Send,
  X,
} from 'lucide-react';
import type {
  ExamConfig,
  ExamQuestionItem,
  NTAQuestionStatus,
  QuestionSet,
  SessionAttempt,
} from '../types/cbt';
import {
  appendNumericChar,
  buildExamItems,
  evaluateSession,
  formatHMS,
  formatMS,
  sanitizeNumericString,
} from '../utils/examEngine';
import { MathText } from './MathText';

interface ExamInterfaceProps {
  questionSet: QuestionSet;
  config: ExamConfig;
  onCompleteSession: (attempt: SessionAttempt) => Promise<void>;
  onAbortExam: () => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

export const ExamInterface: React.FC<ExamInterfaceProps> = ({
  questionSet,
  config,
  onCompleteSession,
  onAbortExam,
}) => {
  const examItems: ExamQuestionItem[] = useMemo(
    () => buildExamItems(questionSet, config),
    [questionSet, config]
  );

  const totalCount = examItems.length;
  const initialLimitSeconds = config.countdownMinutes * 60;

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<number, string | null>>({});
  const [statuses, setStatuses] = useState<Record<number, NTAQuestionStatus>>(() => {
    const init: Record<number, NTAQuestionStatus> = {};
    for (let i = 0; i < totalCount; i++) {
      init[i] = i === 0 ? 'not-answered' : 'not-visited';
    }
    return init;
  });
  const [flagged, setFlagged] = useState<Record<number, boolean>>({});
  const [timeSpent, setTimeSpent] = useState<Record<number, number>>({});
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [tabSwitchCount, setTabSwitchCount] = useState<number>(0);
  const [showTabWarning, setShowTabWarning] = useState<boolean>(false);
  const [showPaperModal, setShowPaperModal] = useState<boolean>(false);
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [imageErrorMap, setImageErrorMap] = useState<Record<number, boolean>>({});

  // Refs for latest state inside interval & auto-submit
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const statusesRef = useRef(statuses);
  statusesRef.current = statuses;
  const timeSpentRef = useRef(timeSpent);
  timeSpentRef.current = timeSpent;
  const flaggedRef = useRef(flagged);
  flaggedRef.current = flagged;
  const elapsedRef = useRef(elapsedSeconds);
  elapsedRef.current = elapsedSeconds;
  const tabSwitchRef = useRef(tabSwitchCount);
  tabSwitchRef.current = tabSwitchCount;
  const submittedRef = useRef(false);

  const finalizeAndSubmit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setIsSubmitting(true);

    const sessionId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const attempt = evaluateSession({
      sessionId,
      set: questionSet,
      config,
      examItems,
      answers: answersRef.current,
      statuses: statusesRef.current,
      timeSpent: timeSpentRef.current,
      flagged: flaggedRef.current,
      totalTimeSeconds: elapsedRef.current,
      tabSwitchCount: tabSwitchRef.current,
    });

    await onCompleteSession(attempt);
  }, [questionSet, config, examItems, onCompleteSession]);

  // Master 1-second timer & exact per-question time accounting
  useEffect(() => {
    if (isPaused || submittedRef.current) return;

    const timer = window.setInterval(() => {
      if (submittedRef.current) return;

      setElapsedSeconds((prev) => {
        const next = prev + 1;
        if (config.timerMode === 'countdown' && next >= initialLimitSeconds) {
          // Auto-submit on countdown expiry
          window.setTimeout(() => {
            void finalizeAndSubmit();
          }, 0);
        }
        return next;
      });

      const activeIdx = currentIndexRef.current;
      setTimeSpent((prev) => ({
        ...prev,
        [activeIdx]: (prev[activeIdx] ?? 0) + 1,
      }));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isPaused, config.timerMode, initialLimitSeconds, finalizeAndSubmit]);

  // Tab-switch / window visibility tracker
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && !isPaused && !submittedRef.current) {
        setTabSwitchCount((c) => c + 1);
        setShowTabWarning(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isPaused]);

  const currentItem = examItems[currentIndex];
  const currentQuestion = currentItem.question;
  const currentAnswer = answers[currentIndex] ?? null;
  const currentQuestionTime = timeSpent[currentIndex] ?? 0;

  const hasValidAnswer = (val: string | null | undefined): boolean => {
    if (val === null || val === undefined) return false;
    const trimmed = val.trim();
    return trimmed.length > 0 && trimmed !== '-';
  };

  const navigateTo = useCallback(
    (targetIdx: number) => {
      if (targetIdx < 0 || targetIdx >= totalCount || targetIdx === currentIndex) return;

      setStatuses((prev) => {
        const next = { ...prev };
        // Update target question from not-visited to not-answered
        if (!next[targetIdx] || next[targetIdx] === 'not-visited') {
          next[targetIdx] = 'not-answered';
        }
        return next;
      });
      setCurrentIndex(targetIdx);
    },
    [totalCount, currentIndex]
  );

  const handleSelectMcqOriginalIndex = useCallback(
    (originalOptionIdx: number) => {
      // NTA behavior: clicking an already selected option does NOT deselect it
      const val = String(originalOptionIdx);
      setAnswers((prev) => ({ ...prev, [currentIndex]: val }));
    },
    [currentIndex]
  );

  const handleNumericalChange = useCallback(
    (nextRaw: string) => {
      const sanitized = sanitizeNumericString(nextRaw);
      setAnswers((prev) => ({
        ...prev,
        [currentIndex]: sanitized.length > 0 ? sanitized : null,
      }));
    },
    [currentIndex]
  );

  const handleKeypadChar = useCallback(
    (char: string) => {
      setAnswers((prev) => {
        const curr = prev[currentIndex] ?? '';
        const next = appendNumericChar(curr, char);
        return { ...prev, [currentIndex]: next.length > 0 ? next : null };
      });
    },
    [currentIndex]
  );

  const handleKeypadBackspace = useCallback(() => {
    setAnswers((prev) => {
      const curr = prev[currentIndex] ?? '';
      const next = curr.slice(0, -1);
      return { ...prev, [currentIndex]: next.length > 0 ? next : null };
    });
  }, [currentIndex]);

  const handleSaveAndNext = useCallback(() => {
    const val = answersRef.current[currentIndex];
    const valid = hasValidAnswer(val);

    setStatuses((prev) => {
      const next = { ...prev };
      next[currentIndex] = valid ? 'answered' : 'not-answered';
      if (!valid) {
        // Keep null if empty/lone minus
      }
      const nextIdx = currentIndex + 1;
      if (nextIdx < totalCount && (!next[nextIdx] || next[nextIdx] === 'not-visited')) {
        next[nextIdx] = 'not-answered';
      }
      return next;
    });

    if (!valid) {
      setAnswers((prev) => ({ ...prev, [currentIndex]: null }));
    }

    if (currentIndex + 1 < totalCount) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, totalCount]);

  const handleClearResponse = useCallback(() => {
    setAnswers((prev) => ({ ...prev, [currentIndex]: null }));
    setStatuses((prev) => ({ ...prev, [currentIndex]: 'not-answered' }));
  }, [currentIndex]);

  const handleMarkForReviewAndNext = useCallback(() => {
    const val = answersRef.current[currentIndex];
    const valid = hasValidAnswer(val);

    setStatuses((prev) => {
      const next = { ...prev };
      next[currentIndex] = valid ? 'answered-and-marked' : 'marked-for-review';
      const nextIdx = currentIndex + 1;
      if (nextIdx < totalCount && (!next[nextIdx] || next[nextIdx] === 'not-visited')) {
        next[nextIdx] = 'not-answered';
      }
      return next;
    });

    if (currentIndex + 1 < totalCount) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, totalCount]);

  const handleToggleFlag = useCallback(() => {
    setFlagged((prev) => ({ ...prev, [currentIndex]: !prev[currentIndex] }));
  }, [currentIndex]);

  // Keyboard shortcuts for zero-mouse solving
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isPaused || showPaperModal || showSubmitModal || isSubmitting) return;

      const target = e.target as HTMLElement | null;
      const isTextInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

      if (isTextInput) {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleSaveAndNext();
        }
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateTo(currentIndex - 1);
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateTo(currentIndex + 1);
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveAndNext();
        return;
      }

      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        handleMarkForReviewAndNext();
        return;
      }

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        handleToggleFlag();
        return;
      }

      if (currentQuestion.type === 'MCQ') {
        const lower = e.key.toLowerCase();
        const keyMap: Record<string, number> = {
          '1': 0,
          '2': 1,
          '3': 2,
          '4': 3,
          a: 0,
          b: 1,
          c: 2,
          d: 3,
        };
        if (lower in keyMap) {
          e.preventDefault();
          const displayedIdx = keyMap[lower];
          const originalIdx = currentItem.optionOrder[displayedIdx];
          if (originalIdx !== undefined) {
            handleSelectMcqOriginalIndex(originalIdx);
          }
        }
      } else if (currentQuestion.type === 'NUMERICAL') {
        if (/^[0-9.\-]$/.test(e.key)) {
          e.preventDefault();
          handleKeypadChar(e.key);
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          handleKeypadBackspace();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    isPaused,
    showPaperModal,
    showSubmitModal,
    isSubmitting,
    currentIndex,
    currentQuestion.type,
    currentItem.optionOrder,
    navigateTo,
    handleSaveAndNext,
    handleMarkForReviewAndNext,
    handleToggleFlag,
    handleSelectMcqOriginalIndex,
    handleKeypadChar,
    handleKeypadBackspace,
  ]);

  // Live palette state counts
  const paletteCounts = useMemo(() => {
    const counts: Record<NTAQuestionStatus, number> = {
      'not-visited': 0,
      'not-answered': 0,
      answered: 0,
      'marked-for-review': 0,
      'answered-and-marked': 0,
    };
    for (let i = 0; i < totalCount; i++) {
      const st = statuses[i] ?? 'not-visited';
      counts[st]++;
    }
    return counts;
  }, [statuses, totalCount]);

  const timeLeftSeconds = Math.max(0, initialLimitSeconds - elapsedSeconds);
  const isCriticalCountdown = config.timerMode === 'countdown' && timeLeftSeconds < 300;
  const masterTimerLabel =
    config.timerMode === 'countdown'
      ? `Time Left: ${formatHMS(timeLeftSeconds)}`
      : `Total Time: ${formatHMS(elapsedSeconds)}`;

  const renderPaletteShapeClass = (st: NTAQuestionStatus) => {
    switch (st) {
      case 'not-visited':
        return 'bg-slate-100 border border-slate-300 rounded-md';
      case 'not-answered':
        return 'bg-[#DC2626] nta-not-answered rounded-t-md';
      case 'answered':
        return 'bg-[#16A34A] nta-answered rounded-b-md';
      case 'marked-for-review':
        return 'bg-[#7C3AED] rounded-full';
      case 'answered-and-marked':
        return 'bg-[#7C3AED] rounded-full';
    }
  };

  const renderPaletteTextClass = (st: NTAQuestionStatus) =>
    st === 'not-visited' ? 'text-slate-700' : 'text-white';

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#F1F5F9] text-[#0F172A] flex flex-col select-none">
      {/* Top Header Bar (60px height) */}
      <header className="h-[60px] shrink-0 border-b border-slate-200 bg-white px-4 lg:px-6 flex items-center justify-between gap-4 z-20">
        {/* Left: Set Title & Subject/Chapter */}
        <div className="min-w-0 flex items-center gap-3">
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-slate-900 truncate max-w-[240px] xl:max-w-[360px]">
              {questionSet.setTitle}
            </h1>
            <p className="text-xs text-slate-500 truncate max-w-[240px] xl:max-w-[360px]">
              {questionSet.subject} · {questionSet.chapter}
            </p>
          </div>
        </div>

        {/* Center: Per-Question Timer, Master Timer & Pause */}
        <div className="flex items-center gap-3 sm:gap-5 shrink-0">
          <div className="hidden sm:flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-mono-tabular text-slate-700">
            <span className="text-slate-500">This Q:</span>
            <strong className="font-semibold text-slate-900">{formatMS(currentQuestionTime)}</strong>
          </div>

          <div
            className={`flex items-center gap-2 rounded-lg border px-3.5 py-1.5 text-xs font-mono-tabular font-semibold ${
              isCriticalCountdown
                ? 'border-red-300 bg-red-50 text-red-700 animate-pulse'
                : 'border-[#0F4C81]/25 bg-[#0F4C81]/5 text-[#0F4C81]'
            }`}
          >
            <span>{masterTimerLabel}</span>
          </div>

          <button
            type="button"
            onClick={() => setIsPaused((p) => !p)}
            aria-label={isPaused ? 'Resume exam timer' : 'Pause exam timer'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            {isPaused ? (
              <>
                <Play className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                Resume
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
                Pause
              </>
            )}
          </button>
        </div>

        {/* Right: Question Paper View & Submit Session */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowPaperModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            <FileText className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            Question Paper View
          </button>
          <button
            type="button"
            onClick={() => setShowSubmitModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#DC2626] px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Send className="w-3.5 h-3.5" aria-hidden="true" />
            Submit Session
          </button>
        </div>
      </header>

      {/* Non-intrusive Tab-Switch Warning Banner */}
      {showTabWarning && !isPaused && (
        <div
          role="alert"
          className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center justify-between text-xs text-amber-900 shrink-0"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
            <span>
              Focus departure detected. Tab switches are logged in your final session report ({tabSwitchCount} recorded).
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowTabWarning(false)}
            className="font-semibold underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Split Workspace (72% Left Question Canvas / 28% Right NTA Palette) */}
      <div className={`relative flex-1 flex flex-col lg:flex-row overflow-hidden ${isPaused ? 'blur-md pointer-events-none' : ''}`}>
        {/* Left Column (72% width): Question Canvas */}
        <main className="w-full lg:w-[72%] h-full flex flex-col bg-white border-r border-slate-200 overflow-hidden">
          {/* Sub-header */}
          <div className="shrink-0 flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/70 px-6 py-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-slate-900 font-mono-tabular">
                Question No. {currentIndex + 1}
              </span>
              <span className="text-xs text-slate-500 font-mono-tabular">
                of {totalCount}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleToggleFlag}
                aria-pressed={Boolean(flagged[currentIndex])}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  flagged[currentIndex]
                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Flag className={`w-3.5 h-3.5 ${flagged[currentIndex] ? 'fill-amber-500 text-amber-600' : ''}`} aria-hidden="true" />
                {flagged[currentIndex] ? 'Flagged' : 'Flag Question'}
              </button>

              <div className="text-xs font-medium text-slate-700 font-mono-tabular">
                {currentQuestion.type === 'MCQ' ? 'Single Choice: +4, -1' : 'Numerical: +4, 0'}
              </div>
            </div>
          </div>

          {/* Scrollable Question Stem + Options/Numerical Keypad */}
          <div className="flex-1 overflow-y-auto px-6 py-6 lg:px-8 space-y-6 select-text">
            {/* Question Stem */}
            <div className="text-[17px] leading-[1.7] text-slate-900">
              <MathText text={currentQuestion.question} />
            </div>

            {/* Optional Diagram/Image */}
            {currentQuestion.image && (
              <div className="flex justify-center py-2">
                {imageErrorMap[currentIndex] ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-6 py-4 text-xs text-slate-500">
                    Question diagram could not be loaded ({currentQuestion.image.slice(0, 60)}).
                  </div>
                ) : (
                  <img
                    src={currentQuestion.image}
                    alt={`Diagram for Question ${currentIndex + 1}`}
                    referrerPolicy="no-referrer"
                    onError={() => setImageErrorMap((prev) => ({ ...prev, [currentIndex]: true }))}
                    className="max-h-72 rounded-lg border border-slate-200 object-contain bg-white p-2"
                  />
                )}
              </div>
            )}

            {/* MCQ Options */}
            {currentQuestion.type === 'MCQ' && (
              <div role="radiogroup" aria-label={`Options for Question ${currentIndex + 1}`} className="space-y-3 max-w-3xl">
                {currentItem.optionOrder.map((originalOptIdx, displayIdx) => {
                  const optionText = currentQuestion.options[originalOptIdx] ?? '';
                  const letter = OPTION_LETTERS[displayIdx];
                  const isSelected = currentAnswer === String(originalOptIdx);

                  return (
                    <button
                      key={`${currentIndex}-opt-${displayIdx}`}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => handleSelectMcqOriginalIndex(originalOptIdx)}
                      className={`w-full flex items-start gap-4 rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F4C81] ${
                        isSelected
                          ? 'border-[#0F4C81] bg-[#0F4C81]/5 ring-1 ring-[#0F4C81]'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold font-mono-tabular ${
                          isSelected
                            ? 'border-[#0F4C81] bg-[#0F4C81] text-white'
                            : 'border-slate-300 bg-slate-50 text-slate-700'
                        }`}
                      >
                        {letter}
                      </span>
                      <div className="flex-1 text-[16px] leading-relaxed text-slate-900">
                        <MathText text={optionText} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* NUMERICAL Input & NTA Virtual Numeric Keypad */}
            {currentQuestion.type === 'NUMERICAL' && (
              <div className="max-w-sm space-y-4">
                <div>
                  <label htmlFor="numerical-answer-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Your Numerical Response
                  </label>
                  <input
                    id="numerical-answer-input"
                    type="text"
                    inputMode="decimal"
                    value={currentAnswer ?? ''}
                    onChange={(e) => handleNumericalChange(e.target.value)}
                    placeholder="Enter numerical value..."
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 font-mono-tabular text-lg font-semibold text-slate-900 placeholder:text-slate-400 focus:border-[#0F4C81] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/15"
                  />
                </div>

                {/* NTA On-Screen Virtual Numeric Keypad */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5" aria-label="NTA Virtual Numeric Keypad">
                  <div className="grid grid-cols-3 gap-2">
                    {['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.', '-'].map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleKeypadChar(key)}
                        className="h-11 rounded-lg border border-slate-300 bg-white font-mono-tabular text-base font-semibold text-slate-900 hover:bg-slate-100 active:bg-slate-200 transition-colors"
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleKeypadBackspace}
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      <Delete className="w-3.5 h-3.5" aria-hidden="true" />
                      Backspace
                    </button>
                    <button
                      type="button"
                      onClick={handleClearResponse}
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      <Eraser className="w-3.5 h-3.5" aria-hidden="true" />
                      Clear All
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Keyboard Shortcuts Reference */}
            <p className="pt-2 text-xs text-slate-400">
              Shortcuts: 1–4 or A–D to select · Enter to Save & Next · M to Mark for Review · F to Flag · Left/Right Arrows to navigate
            </p>
          </div>

          {/* Fixed Bottom Action Bar */}
          <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 lg:px-6 py-3 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSaveAndNext}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#16A34A] px-4 py-2 text-xs font-semibold text-white hover:bg-green-700 transition-colors whitespace-nowrap shrink-0"
              >
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                Save & Next
              </button>
              <button
                type="button"
                onClick={handleClearResponse}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
              >
                Clear Response
              </button>
              <button
                type="button"
                onClick={handleMarkForReviewAndNext}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#7C3AED] px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700 transition-colors whitespace-nowrap shrink-0"
              >
                <Bookmark className="w-3.5 h-3.5" aria-hidden="true" />
                Mark for Review & Next
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigateTo(currentIndex - 1)}
                disabled={currentIndex === 0}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                Previous
              </button>
              <button
                type="button"
                onClick={() => navigateTo(currentIndex + 1)}
                disabled={currentIndex === totalCount - 1}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0"
              >
                Next
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </main>

        {/* Right Column (28% width): NTA Question Palette */}
        <aside className="w-full lg:w-[28%] h-64 lg:h-full flex flex-col bg-[#F8FAFC] overflow-hidden">
          {/* 5-State NTA Legend */}
          <div className="shrink-0 border-b border-slate-200 bg-white p-4 space-y-2.5">
            <h2 className="text-xs font-bold text-slate-800 tracking-wide">
              Question Palette Summary
            </h2>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-slate-700">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-slate-100 font-mono-tabular text-[11px] font-semibold text-slate-700">
                  {paletteCounts['not-visited']}
                </span>
                <span className="truncate">Not Visited</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center bg-[#DC2626] nta-not-answered rounded-t-md font-mono-tabular text-[11px] font-semibold text-white">
                  {paletteCounts['not-answered']}
                </span>
                <span className="truncate">Not Answered</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center bg-[#16A34A] nta-answered rounded-b-md font-mono-tabular text-[11px] font-semibold text-white">
                  {paletteCounts.answered}
                </span>
                <span className="truncate">Answered</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#7C3AED] font-mono-tabular text-[11px] font-semibold text-white">
                  {paletteCounts['marked-for-review']}
                </span>
                <span className="truncate">Marked for Review</span>
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <span className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#7C3AED] font-mono-tabular text-[11px] font-semibold text-white">
                  {paletteCounts['answered-and-marked']}
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-white bg-[#16A34A]" />
                </span>
                <span>Answered & Marked for Review (Evaluated)</span>
              </div>
            </div>
          </div>

          {/* Scrollable Numbered Question Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-5 gap-2.5">
              {examItems.map((_, idx) => {
                const st = statuses[idx] ?? 'not-visited';
                const isCurrent = idx === currentIndex;
                const isFlagged = Boolean(flagged[idx]);

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => navigateTo(idx)}
                    aria-label={`Jump to Question ${idx + 1} (${st})`}
                    aria-current={isCurrent ? 'step' : undefined}
                    className={`relative mx-auto flex h-10 items-center justify-center font-mono-tabular text-xs font-bold transition-transform hover:scale-[1.04] rounded-lg ${
                      st === 'marked-for-review' || st === 'answered-and-marked' ? 'w-10' : 'w-11'
                    } ${isCurrent ? 'ring-2 ring-offset-2 ring-[#0F4C81]' : ''}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute inset-0 ${renderPaletteShapeClass(st)}`}
                    />
                    <span className={`relative z-10 ${renderPaletteTextClass(st)}`}>{idx + 1}</span>
                    {st === 'answered-and-marked' && (
                      <span className="absolute bottom-0 right-0 z-20 h-2.5 w-2.5 rounded-full border border-white bg-[#16A34A]" />
                    )}
                    {isFlagged && (
                      <span
                        title="Flagged"
                        className="absolute -top-1 -right-1 z-20 h-2.5 w-2.5 rounded-full border border-white bg-amber-500"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Exit Link */}
          <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 flex items-center justify-between text-xs">
            <span className="text-slate-500">Need to exit early?</span>
            <button
              type="button"
              onClick={onAbortExam}
              className="font-semibold text-slate-600 hover:text-slate-900 underline"
            >
              Exit to Dashboard
            </button>
          </div>
        </aside>
      </div>

      {/* Pause Overlay */}
      {isPaused && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pause-overlay-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-2xl space-y-4">
            <h2 id="pause-overlay-title" className="text-lg font-bold text-slate-900">
              Session Paused
            </h2>
            <p className="text-sm text-slate-600">
              Both the master session timer and per-question timer are frozen. The question canvas is hidden until you resume.
            </p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-mono-tabular text-slate-700">
              Elapsed Time: <strong className="font-semibold text-slate-900">{formatHMS(elapsedSeconds)}</strong> · Question {currentIndex + 1} of {totalCount}
            </div>
            <button
              type="button"
              onClick={() => setIsPaused(false)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0F4C81] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0B3A63] transition-colors"
            >
              <Play className="w-4 h-4" aria-hidden="true" />
              Resume Practice Session
            </button>
          </div>
        </div>
      )}

      {/* Question Paper View Modal */}
      {showPaperModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="question-paper-title"
        >
          <div className="flex max-h-[88vh] w-full max-w-4xl flex-col rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#0F4C81]" aria-hidden="true" />
                <h2 id="question-paper-title" className="text-base font-semibold text-slate-900">
                  Question Paper View ({totalCount} Questions)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowPaperModal(false)}
                aria-label="Close Question Paper View"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-200 px-6 py-2">
              {examItems.map((item, idx) => (
                <div key={idx} className="py-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900 font-mono-tabular">
                      Q.{idx + 1} ({item.question.type})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPaperModal(false);
                        navigateTo(idx);
                      }}
                      className="font-semibold text-[#0F4C81] hover:underline"
                    >
                      Go to Q.{idx + 1}
                    </button>
                  </div>
                  <div className="text-sm text-slate-800 leading-relaxed">
                    <MathText text={item.question.question} />
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 flex justify-end rounded-b-xl">
              <button
                type="button"
                onClick={() => setShowPaperModal(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-confirm-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 id="submit-confirm-title" className="text-base font-bold text-slate-900">
                Confirm Session Submission
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Review your response summary before submitting. Both <strong>Answered</strong> and{' '}
                <strong>Answered & Marked for Review</strong> responses are evaluated.
              </p>

              <div className="rounded-lg border border-slate-200 divide-y divide-slate-200 text-xs">
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-slate-600">Total Questions</span>
                  <strong className="font-mono-tabular text-slate-900">{totalCount}</strong>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-emerald-700">Answered (Evaluated)</span>
                  <strong className="font-mono-tabular text-emerald-700">
                    {paletteCounts.answered + paletteCounts['answered-and-marked']}
                  </strong>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-violet-700">Marked for Review (Unanswered)</span>
                  <strong className="font-mono-tabular text-violet-700">{paletteCounts['marked-for-review']}</strong>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-red-700">Not Answered (Visited)</span>
                  <strong className="font-mono-tabular text-red-700">{paletteCounts['not-answered']}</strong>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-slate-600">Not Visited</span>
                  <strong className="font-mono-tabular text-slate-900">{paletteCounts['not-visited']}</strong>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Return to Test
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void finalizeAndSubmit()}
                className="rounded-lg bg-[#DC2626] px-5 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Yes, Submit Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
