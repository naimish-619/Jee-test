import type { BackupPayload, Question, QuestionSet, SubjectCategory } from '../types/cbt';

const ALLOWED_SUBJECTS: SubjectCategory[] = ['Physics', 'Chemistry', 'Mathematics', 'Full Mock'];

/**
 * LaTeX commands starting with valid JSON escape letters (f, t, r, b, n)
 * that frequently collide with JSON escape sequences when unescaped.
 */
const LATEX_COLLISION_COMMANDS = [
  // f*
  'frac', 'forall', 'flat', 'frown',
  // t*
  'theta', 'times', 'text', 'textbf', 'textit', 'textrm', 'textsf', 'texttt',
  'tan', 'tanh', 'tau', 'to', 'top', 'triangle', 'triangleq', 'tilde', 'tbinom',
  // r*
  'rightarrow', 'rightleftharpoons', 'right', 'rangle', 'rceil', 'rfloor', 'rho', 'rm', 'root',
  // b*
  'beta', 'bar', 'binom', 'begin', 'big', 'bigcap', 'bigcup', 'bigoplus', 'bigotimes', 'bm', 'bold', 'boldsymbol', 'bot', 'bowtie', 'Box', 'bullet',
  // n*
  'neq', 'ne', 'nu', 'nabla', 'not', 'notin', 'ni', 'nparallel', 'newline', 'nless', 'ngtr', 'nleq', 'ngeq', 'norm',
];

const LATEX_COLLISION_REGEX = new RegExp(`^(${LATEX_COLLISION_COMMANDS.join('|')})(?![a-zA-Z])`);

export interface SanitizeResult {
  sanitized: string;
  repairedCount: number;
}

/**
 * Pre-parser sanitizer that walks JSON string literals and escapes stray single
 * backslashes in LaTeX expressions (e.g. `\frac`, `\theta`, `\int`, `\sqrt`, `\ce`)
 * without corrupting already double-escaped `\\` or genuine `\n` line breaks.
 */
export function sanitizeLatexJson(raw: string): SanitizeResult {
  const input = raw.replace(/^\uFEFF/, '').trim();
  let out = '';
  let inString = false;
  let repairedCount = 0;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (!inString) {
      out += ch;
      if (ch === '"') {
        inString = true;
      }
      continue;
    }

    if (ch === '"') {
      out += ch;
      inString = false;
      continue;
    }

    if (ch !== '\\') {
      out += ch;
      continue;
    }

    // We are inside a string literal and encountered a backslash at index i
    const next = input[i + 1];
    if (next === undefined) {
      out += '\\\\';
      repairedCount++;
      continue;
    }

    // Already escaped backslash or quote or forward slash
    if (next === '\\' || next === '"' || next === '/') {
      out += '\\' + next;
      i++;
      continue;
    }

    // Valid JSON unicode escape \uXXXX
    if (next === 'u' && /^[0-9a-fA-F]{4}/.test(input.slice(i + 2, i + 6))) {
      out += input.slice(i, i + 6);
      i += 5;
      continue;
    }

    // Potential collision between JSON escape (\f, \t, \r, \b, \n) and LaTeX command
    if (next === 'f' || next === 't' || next === 'r' || next === 'b' || next === 'n') {
      const remainder = input.slice(i + 1);
      if (LATEX_COLLISION_REGEX.test(remainder)) {
        out += '\\\\';
        repairedCount++;
        continue;
      }
      // Genuine JSON control escape like \n, \t, \r, \b, \f
      out += '\\' + next;
      i++;
      continue;
    }

    // Any other backslash inside a JSON string (e.g., \int, \sqrt, \pi, \alpha, \vec, \cdot, \ce, \left, \Delta)
    out += '\\\\';
    repairedCount++;
  }

  return { sanitized: out, repairedCount };
}

export interface ParsedQuestionSetResult {
  ok: true;
  questionSet: Omit<QuestionSet, 'id' | 'createdAt' | 'updatedAt'>;
  repairedBackslashes: number;
}

export interface ParsedQuestionSetError {
  ok: false;
  errors: string[];
}

export function validateQuestionSetObject(obj: unknown): { valid: true; data: Omit<QuestionSet, 'id' | 'createdAt' | 'updatedAt'> } | { valid: false; errors: string[] } {
  const errors: string[] = [];

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { valid: false, errors: ['Root JSON value must be an object containing setTitle, subject, chapter, and questions.'] };
  }

  const record = obj as Record<string, unknown>;

  if (typeof record.setTitle !== 'string' || record.setTitle.trim().length === 0) {
    errors.push('Missing or empty "setTitle" (must be a non-empty string).');
  }

  if (typeof record.subject !== 'string' || !ALLOWED_SUBJECTS.includes(record.subject as SubjectCategory)) {
    errors.push(`Invalid "subject" (${String(record.subject)}). Allowed values: ${ALLOWED_SUBJECTS.join(', ')}.`);
  }

  if (typeof record.chapter !== 'string' || record.chapter.trim().length === 0) {
    errors.push('Missing or empty "chapter" (must be a non-empty string).');
  }

  if (!Array.isArray(record.questions) || record.questions.length === 0) {
    errors.push('"questions" must be a non-empty array of question objects.');
  }

  const validatedQuestions: Question[] = [];

  if (Array.isArray(record.questions)) {
    record.questions.forEach((rawQ, idx) => {
      const qLabel = `Question #${idx + 1}`;
      if (!rawQ || typeof rawQ !== 'object' || Array.isArray(rawQ)) {
        errors.push(`${qLabel}: Must be an object.`);
        return;
      }

      const q = rawQ as Record<string, unknown>;

      if (q.id === undefined || q.id === null || (typeof q.id !== 'number' && typeof q.id !== 'string')) {
        errors.push(`${qLabel}: Missing valid "id" (number or string).`);
      }

      if (q.type !== 'MCQ' && q.type !== 'NUMERICAL') {
        errors.push(`${qLabel}: Invalid "type" (${String(q.type)}). Allowed values: "MCQ" or "NUMERICAL".`);
      }

      if (typeof q.question !== 'string' || q.question.trim().length === 0) {
        errors.push(`${qLabel}: Missing or empty "question" text.`);
      }

      if (q.type === 'MCQ') {
        if (!Array.isArray(q.options) || q.options.length !== 4 || q.options.some((opt) => typeof opt !== 'string')) {
          errors.push(`${qLabel} (MCQ): "options" must be an array of exactly 4 strings.`);
        }
        const ansStr = String(q.correctAnswer ?? '');
        if (!['0', '1', '2', '3'].includes(ansStr)) {
          errors.push(`${qLabel} (MCQ): "correctAnswer" must be "0", "1", "2", or "3". Received: ${JSON.stringify(q.correctAnswer)}.`);
        }
      } else if (q.type === 'NUMERICAL') {
        if (!Array.isArray(q.options) || q.options.length !== 0) {
          errors.push(`${qLabel} (NUMERICAL): "options" must be an empty array [].`);
        }
        const ansStr = typeof q.correctAnswer === 'number' ? String(q.correctAnswer) : q.correctAnswer;
        if (typeof ansStr !== 'string' || ansStr.trim().length === 0 || !Number.isFinite(Number(ansStr.trim()))) {
          errors.push(`${qLabel} (NUMERICAL): "correctAnswer" must be a valid numeric string (e.g. "12.5" or "-4"). Received: ${JSON.stringify(q.correctAnswer)}.`);
        }
        if (q.tolerance !== undefined && (typeof q.tolerance !== 'number' || Number.isNaN(q.tolerance) || q.tolerance < 0)) {
          errors.push(`${qLabel} (NUMERICAL): "tolerance" must be a non-negative number if provided.`);
        }
      }

      if (q.solution !== undefined && typeof q.solution !== 'string') {
        errors.push(`${qLabel}: "solution" must be a string if provided.`);
      }

      if (q.image !== undefined && typeof q.image !== 'string') {
        errors.push(`${qLabel}: "image" must be a URL or Base64 data URI string if provided.`);
      }

      if (errors.length === 0) {
        validatedQuestions.push({
          id: q.id as number | string,
          type: q.type as 'MCQ' | 'NUMERICAL',
          question: (q.question as string).trim(),
          options: q.type === 'MCQ' ? (q.options as string[]) : [],
          correctAnswer: String(q.correctAnswer).trim(),
          tolerance: q.type === 'NUMERICAL' ? (typeof q.tolerance === 'number' ? q.tolerance : 0.01) : undefined,
          solution: typeof q.solution === 'string' ? q.solution : undefined,
          image: typeof q.image === 'string' && q.image.trim().length > 0 ? q.image.trim() : undefined,
        });
      }
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors: errors.slice(0, 12) };
  }

  return {
    valid: true,
    data: {
      setTitle: (record.setTitle as string).trim(),
      subject: record.subject as SubjectCategory,
      chapter: (record.chapter as string).trim(),
      questions: validatedQuestions,
    },
  };
}

export function validateAndParseQuestionSet(rawText: string): ParsedQuestionSetResult | ParsedQuestionSetError {
  if (!rawText || rawText.trim().length === 0) {
    return { ok: false, errors: ['Input JSON is empty. Please provide a valid question set JSON.'] };
  }

  const { sanitized, repairedCount } = sanitizeLatexJson(rawText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(sanitized);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown syntax error';
    return {
      ok: false,
      errors: [`JSON Syntax Error: ${message}. Check for missing commas, quotes, or brackets.`],
    };
  }

  const validation = validateQuestionSetObject(parsed);
  if (validation.valid === false) {
    return { ok: false, errors: validation.errors };
  }

  return {
    ok: true,
    questionSet: validation.data,
    repairedBackslashes: repairedCount,
  };
}

export function validateBackupPayload(rawText: string): { ok: true; payload: BackupPayload } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(rawText.replace(/^\uFEFF/, '').trim()) as Partial<BackupPayload>;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.questionSets) || !Array.isArray(parsed.sessions)) {
      return { ok: false, error: 'Invalid backup format. Expected "questionSets" and "sessions" arrays.' };
    }
    for (let i = 0; i < parsed.questionSets.length; i++) {
      const setItem = parsed.questionSets[i];
      if (!setItem.id || typeof setItem.id !== 'string') {
        return { ok: false, error: `Backup Question Set #${i + 1} is missing a valid string "id".` };
      }
      const check = validateQuestionSetObject(setItem);
      if (check.valid === false) {
        return { ok: false, error: `Backup Question Set "${setItem.setTitle || i + 1}": ${check.errors[0]}` };
      }
    }
    return {
      ok: true,
      payload: {
        version: typeof parsed.version === 'number' ? parsed.version : 1,
        exportedAt: typeof parsed.exportedAt === 'number' ? parsed.exportedAt : Date.now(),
        questionSets: parsed.questionSets,
        sessions: parsed.sessions,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: `Failed to parse backup file: ${err instanceof Error ? err.message : 'Invalid JSON'}`,
    };
  }
}
