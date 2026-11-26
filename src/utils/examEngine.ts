import type {
  ExamConfig,
  ExamQuestionItem,
  NTAQuestionStatus,
  Question,
  QuestionAttemptRecord,
  QuestionSet,
  SessionAttempt,
} from '../types/cbt';

export function shuffleArray<T>(items: T[], rng: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Prepares the ordered list of exam questions with optional question-order
 * and option-order shuffling, accurately preserving original indices for grading.
 */
export function buildExamItems(
  set: QuestionSet,
  config: ExamConfig,
  rng: () => number = Math.random
): ExamQuestionItem[] {
  const baseIndices =
    config.subsetIndices && config.subsetIndices.length > 0
      ? config.subsetIndices.filter((idx) => idx >= 0 && idx < set.questions.length)
      : set.questions.map((_, idx) => idx);

  const orderedIndices = config.shuffleQuestions ? shuffleArray(baseIndices, rng) : baseIndices;

  return orderedIndices.map((originalIndex) => {
    const q = set.questions[originalIndex];
    const baseOptionOrder = q.type === 'MCQ' ? [0, 1, 2, 3] : [];
    const optionOrder =
      q.type === 'MCQ' && config.shuffleOptions ? shuffleArray(baseOptionOrder, rng) : baseOptionOrder;
    return {
      originalIndex,
      question: q,
      optionOrder,
    };
  });
}

/**
 * Formats seconds into HH:MM:SS (e.g., 00:18:42).
 */
export function formatHMS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Formats seconds into MM:SS (e.g., 01:14 or 02:35).
 */
export function formatMS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Formats seconds into Xh Ym Zs for post-session summary KPI cards.
 */
export function formatDurationVerbose(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

/**
 * Validates and appends a character to a numerical answer string,
 * preventing multiple decimal points or misplaced minus signs.
 */
export function appendNumericChar(current: string, char: string): string {
  if (char === '-') {
    if (current.length === 0) return '-';
    if (current.startsWith('-')) return current.slice(1);
    return '-' + current;
  }
  if (char === '.') {
    if (current.includes('.')) return current;
    if (current === '' || current === '-') return current + '0.';
    return current + '.';
  }
  if (/^[0-9]$/.test(char)) {
    if (current.length >= 16) return current;
    return current + char;
  }
  return current;
}

export function sanitizeNumericString(raw: string): string {
  let result = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '-' && result.length === 0) {
      result += '-';
    } else if (ch === '.' && !result.includes('.')) {
      result += result === '' || result === '-' ? '0.' : '.';
    } else if (/^[0-9]$/.test(ch)) {
      result += ch;
    }
  }
  return result.slice(0, 16);
}

/**
 * Checks whether a question is counted as attempted under official NTA rules:
 * Both 'answered' and 'answered-and-marked' with a non-empty answer are evaluated.
 */
export function isResponseEvaluated(status: NTAQuestionStatus, userAnswer: string | null): boolean {
  if (userAnswer === null) return false;
  const trimmed = userAnswer.trim();
  if (trimmed.length === 0 || trimmed === '-') return false;
  return status === 'answered' || status === 'answered-and-marked';
}

export function gradeQuestion(
  question: Question,
  userAnswer: string | null,
  status: NTAQuestionStatus
): { isAttempted: boolean; isCorrect: boolean; marksAwarded: number } {
  const attempted = isResponseEvaluated(status, userAnswer);
  if (!attempted || userAnswer === null) {
    return { isAttempted: false, isCorrect: false, marksAwarded: 0 };
  }

  if (question.type === 'MCQ') {
    const isCorrect = userAnswer.trim() === question.correctAnswer.trim();
    return {
      isAttempted: true,
      isCorrect,
      marksAwarded: isCorrect ? 4 : -1,
    };
  }

  // NUMERICAL: +4 correct within tolerance, 0 incorrect
  const userNum = Number(userAnswer.trim());
  const expectedNum = Number(question.correctAnswer.trim());
  const tol = question.tolerance ?? 0.01;
  const isCorrect = Number.isFinite(userNum) && Number.isFinite(expectedNum) && Math.abs(userNum - expectedNum) <= tol + 1e-9;

  return {
    isAttempted: true,
    isCorrect,
    marksAwarded: isCorrect ? 4 : 0,
  };
}

export function evaluateSession(params: {
  sessionId: string;
  set: QuestionSet;
  config: ExamConfig;
  examItems: ExamQuestionItem[];
  answers: Record<number, string | null>;
  statuses: Record<number, NTAQuestionStatus>;
  timeSpent: Record<number, number>;
  flagged: Record<number, boolean>;
  totalTimeSeconds: number;
  tabSwitchCount: number;
  completedAt?: number;
}): SessionAttempt {
  const {
    sessionId,
    set,
    config,
    examItems,
    answers,
    statuses,
    timeSpent,
    flagged,
    totalTimeSeconds,
    tabSwitchCount,
    completedAt = Date.now(),
  } = params;

  let netScore = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let unattemptedCount = 0;

  const questionResults: QuestionAttemptRecord[] = examItems.map((item, idx) => {
    const rawAns = answers[idx] ?? null;
    const status = statuses[idx] ?? 'not-visited';
    const graded = gradeQuestion(item.question, rawAns, status);

    netScore += graded.marksAwarded;
    if (!graded.isAttempted) {
      unattemptedCount++;
    } else if (graded.isCorrect) {
      correctCount++;
    } else {
      incorrectCount++;
    }

    return {
      questionId: item.question.id,
      originalIndex: item.originalIndex,
      type: item.question.type,
      question: item.question.question,
      options: item.question.options,
      optionOrder: item.optionOrder,
      correctAnswer: item.question.correctAnswer,
      tolerance: item.question.tolerance ?? 0.01,
      solution: item.question.solution,
      image: item.question.image,
      userAnswer: graded.isAttempted ? rawAns : null,
      status,
      timeSpentSeconds: timeSpent[idx] ?? 0,
      isFlagged: Boolean(flagged[idx]),
      isCorrect: graded.isCorrect,
      isAttempted: graded.isAttempted,
      marksAwarded: graded.marksAwarded,
    };
  });

  const attemptedCount = correctCount + incorrectCount;
  const accuracyPercent = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 1000) / 10 : 0;

  return {
    id: sessionId,
    setId: set.id,
    setTitle: set.setTitle,
    subject: set.subject,
    chapter: set.chapter,
    completedAt,
    timerMode: config.timerMode,
    countdownMinutes: config.timerMode === 'countdown' ? config.countdownMinutes : undefined,
    totalTimeSeconds,
    netScore,
    maxScore: examItems.length * 4,
    correctCount,
    incorrectCount,
    unattemptedCount,
    accuracyPercent,
    tabSwitchCount,
    isSubsetAttempt: Boolean(config.subsetIndices && config.subsetIndices.length > 0),
    questionResults,
  };
}

export interface SessionAnalyticsSummary {
  avgSecondsPerAttempted: number;
  avgTimeCorrect: number;
  avgTimeIncorrect: number;
  timeSinkQuestions: Array<{
    displayNumber: number;
    record: QuestionAttemptRecord;
  }>;
  flaggedQuestions: Array<{
    displayNumber: number;
    record: QuestionAttemptRecord;
  }>;
  paletteCounts: Record<NTAQuestionStatus, number>;
}

export function computeSessionAnalytics(session: SessionAttempt): SessionAnalyticsSummary {
  const attempted = session.questionResults.filter((r) => r.isAttempted);
  const correct = session.questionResults.filter((r) => r.isAttempted && r.isCorrect);
  const incorrect = session.questionResults.filter((r) => r.isAttempted && !r.isCorrect);

  const avg = (arr: QuestionAttemptRecord[]) =>
    arr.length === 0 ? 0 : Math.round(arr.reduce((sum, r) => sum + r.timeSpentSeconds, 0) / arr.length);

  const timeSinkQuestions = session.questionResults
    .map((record, i) => ({ displayNumber: i + 1, record }))
    .filter(({ record }) => record.timeSpentSeconds > 150);

  const flaggedQuestions = session.questionResults
    .map((record, i) => ({ displayNumber: i + 1, record }))
    .filter(({ record }) => record.isFlagged);

  const paletteCounts: Record<NTAQuestionStatus, number> = {
    'not-visited': 0,
    'not-answered': 0,
    answered: 0,
    'marked-for-review': 0,
    'answered-and-marked': 0,
  };

  for (const r of session.questionResults) {
    paletteCounts[r.status] = (paletteCounts[r.status] || 0) + 1;
  }

  return {
    avgSecondsPerAttempted: avg(attempted),
    avgTimeCorrect: avg(correct),
    avgTimeIncorrect: avg(incorrect),
    timeSinkQuestions,
    flaggedQuestions,
    paletteCounts,
  };
}

export function computeSetBestStats(sessions: SessionAttempt[], setId: string): {
  bestAccuracy: number | null;
  fastestSeconds: number | null;
  attemptCount: number;
} {
  const fullAttempts = sessions.filter((s) => s.setId === setId && !s.isSubsetAttempt);
  const relevant = fullAttempts.length > 0 ? fullAttempts : sessions.filter((s) => s.setId === setId);
  if (relevant.length === 0) {
    return { bestAccuracy: null, fastestSeconds: null, attemptCount: 0 };
  }
  let bestAccuracy = relevant[0].accuracyPercent;
  let fastestSeconds = relevant[0].totalTimeSeconds;
  for (const s of relevant) {
    if (s.accuracyPercent > bestAccuracy) bestAccuracy = s.accuracyPercent;
    if (s.totalTimeSeconds < fastestSeconds) fastestSeconds = s.totalTimeSeconds;
  }
  return { bestAccuracy, fastestSeconds, attemptCount: relevant.length };
}

export interface PerformanceTrendPoint {
  sessionId: string;
  attemptLabel: string;
  dateShort: string;
  netScore: number;
  maxScore: number;
  scorePercent: number;
  accuracyPercent: number;
  totalTimeSeconds: number;
  isCurrent: boolean;
  isSubsetAttempt: boolean;
}

/**
 * Builds chronologically ordered performance trend points for all attempts of the same question set.
 */
export function buildPerformanceTrendData(
  sessions: SessionAttempt[],
  setId: string,
  currentSessionId: string
): PerformanceTrendPoint[] {
  const matching = sessions
    .filter((s) => s.setId === setId)
    .sort((a, b) => a.completedAt - b.completedAt);

  return matching.map((s, idx) => {
    const scorePercent =
      s.maxScore > 0 ? Math.round((s.netScore / s.maxScore) * 1000) / 10 : 0;
    const dateShort = new Date(s.completedAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });

    return {
      sessionId: s.id,
      attemptLabel: `#${idx + 1}`,
      dateShort,
      netScore: s.netScore,
      maxScore: s.maxScore,
      scorePercent,
      accuracyPercent: s.accuracyPercent,
      totalTimeSeconds: s.totalTimeSeconds,
      isCurrent: s.id === currentSessionId,
      isSubsetAttempt: Boolean(s.isSubsetAttempt),
    };
  });
}

