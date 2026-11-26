import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendNumericChar,
  buildExamItems,
  buildPerformanceTrendData,
  computeSessionAnalytics,
  evaluateSession,
  formatDurationVerbose,
  formatHMS,
  gradeQuestion,
} from './examEngine';
import type { Question, QuestionSet, SessionAttempt } from '../types/cbt';

test('gradeQuestion enforces NTA +4/-1 for MCQ and +4/0 with tolerance for NUMERICAL', () => {
  const mcq: Question = {
    id: 1,
    type: 'MCQ',
    question: 'Q1',
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: '2',
  };

  assert.deepEqual(gradeQuestion(mcq, '2', 'answered'), { isAttempted: true, isCorrect: true, marksAwarded: 4 });
  assert.deepEqual(gradeQuestion(mcq, '2', 'answered-and-marked'), { isAttempted: true, isCorrect: true, marksAwarded: 4 });
  assert.deepEqual(gradeQuestion(mcq, '1', 'answered'), { isAttempted: true, isCorrect: false, marksAwarded: -1 });
  assert.deepEqual(gradeQuestion(mcq, null, 'marked-for-review'), { isAttempted: false, isCorrect: false, marksAwarded: 0 });

  const num: Question = {
    id: 2,
    type: 'NUMERICAL',
    question: 'Q2',
    options: [],
    correctAnswer: '12.5',
    tolerance: 0.02,
  };

  assert.deepEqual(gradeQuestion(num, '12.51', 'answered'), { isAttempted: true, isCorrect: true, marksAwarded: 4 });
  assert.deepEqual(gradeQuestion(num, '12.6', 'answered'), { isAttempted: true, isCorrect: false, marksAwarded: 0 });
});

test('appendNumericChar prevents multiple decimals and misplaced minus signs', () => {
  let val = '';
  val = appendNumericChar(val, '1');
  val = appendNumericChar(val, '.');
  val = appendNumericChar(val, '.'); // ignored
  val = appendNumericChar(val, '5');
  assert.equal(val, '1.5');
  val = appendNumericChar(val, '-'); // toggles sign at start
  assert.equal(val, '-1.5');
  val = appendNumericChar(val, '-'); // toggles back
  assert.equal(val, '1.5');
  assert.equal(appendNumericChar('', '.'), '0.');
});

test('buildExamItems and evaluateSession preserve original option index when options are shuffled', () => {
  const set: QuestionSet = {
    id: 's1',
    setTitle: 'Test Set',
    subject: 'Physics',
    chapter: 'Mechanics',
    createdAt: 1,
    updatedAt: 1,
    questions: [
      {
        id: 1,
        type: 'MCQ',
        question: 'Q1',
        options: ['opt0', 'opt1', 'opt2', 'opt3'],
        correctAnswer: '1',
      },
    ],
  };

  // Deterministic rng returning 0 so Fisher-Yates rotates [0,1,2,3] -> [1,2,3,0]
  const items = buildExamItems(set, {
    timerMode: 'stopwatch',
    countdownMinutes: 2,
    shuffleQuestions: false,
    shuffleOptions: true,
  }, () => 0);

  // Check displayed index 0 maps to original index 1 (or whichever mapped to 1)
  const displayedPosForCorrect = items[0].optionOrder.indexOf(1);
  assert.ok(displayedPosForCorrect >= 0);

  const session = evaluateSession({
    sessionId: 'sess-1',
    set,
    config: { timerMode: 'stopwatch', countdownMinutes: 2, shuffleQuestions: false, shuffleOptions: true },
    examItems: items,
    answers: { 0: String(items[0].optionOrder[displayedPosForCorrect]) },
    statuses: { 0: 'answered' },
    timeSpent: { 0: 160 },
    flagged: { 0: true },
    totalTimeSeconds: 160,
    tabSwitchCount: 1,
  });

  assert.equal(session.netScore, 4);
  assert.equal(session.accuracyPercent, 100);
  const analytics = computeSessionAnalytics(session);
  assert.equal(analytics.timeSinkQuestions.length, 1);
  assert.equal(analytics.flaggedQuestions.length, 1);
  assert.equal(formatHMS(3661), '01:01:01');
  assert.equal(formatDurationVerbose(160), '2m 40s');
});

test('buildPerformanceTrendData filters by setId, sorts chronologically, and flags current session', () => {
  const makeSession = (
    id: string,
    setId: string,
    completedAt: number,
    netScore: number,
    accuracyPercent: number
  ): SessionAttempt => ({
    id,
    setId,
    setTitle: 'Mechanics Set',
    subject: 'Physics',
    chapter: 'Mechanics',
    completedAt,
    timerMode: 'stopwatch',
    totalTimeSeconds: 120,
    netScore,
    maxScore: 40,
    correctCount: Math.max(0, Math.floor(netScore / 4)),
    incorrectCount: 0,
    unattemptedCount: 0,
    accuracyPercent,
    tabSwitchCount: 0,
    questionResults: [],
  });

  const sessions: SessionAttempt[] = [
    makeSession('s-new', 'set-a', 3000, 28, 87.5),
    makeSession('s-other', 'set-b', 2000, 40, 100),
    makeSession('s-old', 'set-a', 1000, 12, 50),
    makeSession('s-mid', 'set-a', 2000, -2, 0),
  ];

  const trend = buildPerformanceTrendData(sessions, 'set-a', 's-new');
  assert.equal(trend.length, 3);
  assert.deepEqual(
    trend.map((p) => p.sessionId),
    ['s-old', 's-mid', 's-new']
  );
  assert.deepEqual(
    trend.map((p) => p.attemptLabel),
    ['#1', '#2', '#3']
  );
  assert.equal(trend[0].isCurrent, false);
  assert.equal(trend[1].netScore, -2);
  assert.equal(trend[2].isCurrent, true);
  assert.equal(trend[2].scorePercent, 70);
});

