import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeLatexJson, validateAndParseQuestionSet } from './jsonSanitizer';

test('sanitizeLatexJson repairs unescaped single backslashes including JSON escape collisions', () => {
  const raw = `{
    "setTitle": "Optics Test",
    "subject": "Physics",
    "chapter": "Wave Optics",
    "questions": [
      {
        "id": 1,
        "type": "MCQ",
        "question": "Find $\\frac{\\sin\\theta}{\\pi}$ and \\int_0^1 \\sqrt{x}\\,dx with \\vec{E} \\cdot \\vec{B} \\times \\vec{v} \\rightarrow 0 and \\ce{H_2SO_4}.\\nNext line.",
        "options": ["$\\\\alpha$", "$\\beta$", "$\\left(x\\right)$", "$0$"],
        "correctAnswer": "0",
        "solution": "Check \\neq and \\rightleftharpoons"
      }
    ]
  }`.replace(/\\\\/g, '\\').replace('"$\\alpha$"', '"$\\\\alpha$"');

  // Construct an explicit raw string with unescaped single backslashes
  const rawBroken = String.raw`{
    "setTitle": "Optics Test",
    "subject": "Physics",
    "chapter": "Wave Optics",
    "questions": [
      {
        "id": 1,
        "type": "MCQ",
        "question": "Find $\frac{\sin\theta}{\pi}$ and \int_0^1 \sqrt{x}\,dx with \vec{E} \cdot \vec{B} \times \vec{v} \rightarrow 0 and \ce{H_2SO_4}.",
        "options": ["$\\alpha$", "$\beta$", "$\left(x\right)$", "$0$"],
        "correctAnswer": "0",
        "solution": "Check \neq and \rightleftharpoons"
      }
    ]
  }`;

  const { sanitized, repairedCount } = sanitizeLatexJson(rawBroken);
  assert.ok(repairedCount > 0);
  const parsed = JSON.parse(sanitized);
  assert.equal(parsed.questions[0].options[0], '$\\alpha$');
  assert.equal(parsed.questions[0].options[1], '$\\beta$');
  assert.ok(parsed.questions[0].question.includes('\\frac{\\sin\\theta}{\\pi}'));
  assert.ok(parsed.questions[0].question.includes('\\rightarrow'));
  assert.ok(parsed.questions[0].solution.includes('\\neq'));
  assert.ok(raw.length > 0);
});

test('validateAndParseQuestionSet accepts valid schema and rejects malformed schema with human-readable errors', () => {
  const validJson = JSON.stringify({
    setTitle: 'Rotational Motion - Set 1',
    subject: 'Physics',
    chapter: 'Rotational Motion',
    questions: [
      {
        id: 1,
        type: 'MCQ',
        question: 'Find kinetic energy.',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: '1',
      },
      {
        id: 2,
        type: 'NUMERICAL',
        question: 'Find work.',
        options: [],
        correctAnswer: '-4.5',
      },
    ],
  });

  const okRes = validateAndParseQuestionSet(validJson);
  assert.equal(okRes.ok, true);
  if (okRes.ok) {
    assert.equal(okRes.questionSet.questions[1].tolerance, 0.01);
  }

  const badJson = JSON.stringify({
    setTitle: '',
    subject: 'Biology',
    chapter: 'Cells',
    questions: [
      {
        id: 1,
        type: 'MCQ',
        question: 'Bad options',
        options: ['Only two', 'Options'],
        correctAnswer: '5',
      },
    ],
  });

  const badRes = validateAndParseQuestionSet(badJson);
  assert.equal(badRes.ok, false);
  if (!badRes.ok) {
    assert.ok(badRes.errors.length >= 4);
  }
});
