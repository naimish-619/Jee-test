export type SubjectCategory = 'Physics' | 'Chemistry' | 'Mathematics' | 'Full Mock';

export type QuestionType = 'MCQ' | 'NUMERICAL';

export interface Question {
  id: number | string;
  type: QuestionType;
  question: string;
  options: string[];
  correctAnswer: string;
  tolerance?: number;
  solution?: string;
  image?: string;
}

export interface QuestionSet {
  id: string;
  setTitle: string;
  subject: SubjectCategory;
  chapter: string;
  questions: Question[];
  createdAt: number;
  updatedAt: number;
  isBuiltInDemo?: boolean;
}

export type TimerMode = 'stopwatch' | 'countdown';

export type NTAQuestionStatus =
  | 'not-visited'
  | 'not-answered'
  | 'answered'
  | 'marked-for-review'
  | 'answered-and-marked';

export interface ExamConfig {
  timerMode: TimerMode;
  countdownMinutes: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  subsetIndices?: number[];
  parentSetId?: string;
}

export interface ExamQuestionItem {
  originalIndex: number;
  question: Question;
  /** Maps displayed option index (0..3) -> original option index (0..3) */
  optionOrder: number[];
}

export interface QuestionAttemptRecord {
  questionId: number | string;
  originalIndex: number;
  type: QuestionType;
  question: string;
  options: string[];
  optionOrder: number[];
  correctAnswer: string;
  tolerance: number;
  solution?: string;
  image?: string;
  /** For MCQ: original option index as string ("0".."3") or null. For NUMERICAL: entered numeric string or null. */
  userAnswer: string | null;
  status: NTAQuestionStatus;
  timeSpentSeconds: number;
  isFlagged: boolean;
  isCorrect: boolean;
  isAttempted: boolean;
  marksAwarded: number;
}

export interface SessionAttempt {
  id: string;
  setId: string;
  setTitle: string;
  subject: SubjectCategory;
  chapter: string;
  completedAt: number;
  timerMode: TimerMode;
  countdownMinutes?: number;
  totalTimeSeconds: number;
  netScore: number;
  maxScore: number;
  correctCount: number;
  incorrectCount: number;
  unattemptedCount: number;
  accuracyPercent: number;
  tabSwitchCount: number;
  isSubsetAttempt?: boolean;
  questionResults: QuestionAttemptRecord[];
}

export interface BackupPayload {
  version: number;
  exportedAt: number;
  questionSets: QuestionSet[];
  sessions: SessionAttempt[];
}
