import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/contrib/mhchem';

interface MathTextProps {
  text: string;
  className?: string;
}

type Segment =
  | { kind: 'text'; content: string }
  | { kind: 'inline'; content: string }
  | { kind: 'block'; content: string };

/**
 * Parses text into plain prose, inline math ($...$), and block math ($$...$$)
 * while respecting escaped dollar signs (\$) and preserving newlines.
 */
function tokenizeMath(input: string): Segment[] {
  const segments: Segment[] = [];
  let i = 0;
  let textBuf = '';

  const flushText = () => {
    if (textBuf.length > 0) {
      segments.push({ kind: 'text', content: textBuf });
      textBuf = '';
    }
  };

  while (i < input.length) {
    // Escaped \$ in prose
    if (input[i] === '\\' && input[i + 1] === '$') {
      textBuf += '$';
      i += 2;
      continue;
    }

    // Block math $$ ... $$
    if (input[i] === '$' && input[i + 1] === '$') {
      const closeIdx = findClosingDollar(input, i + 2, true);
      if (closeIdx !== -1) {
        flushText();
        segments.push({
          kind: 'block',
          content: input.slice(i + 2, closeIdx),
        });
        i = closeIdx + 2;
        continue;
      }
    }

    // Inline math $ ... $
    if (input[i] === '$') {
      const closeIdx = findClosingDollar(input, i + 1, false);
      if (closeIdx !== -1) {
        flushText();
        segments.push({
          kind: 'inline',
          content: input.slice(i + 1, closeIdx),
        });
        i = closeIdx + 1;
        continue;
      }
    }

    textBuf += input[i];
    i++;
  }

  flushText();
  return segments;
}

function findClosingDollar(str: string, start: number, isDouble: boolean): number {
  for (let i = start; i < str.length; i++) {
    if (str[i] === '\\' && i + 1 < str.length) {
      i++; // Skip escaped char inside math
      continue;
    }
    if (isDouble) {
      if (str[i] === '$' && str[i + 1] === '$') {
        return i;
      }
    } else {
      if (str[i] === '$' && str[i + 1] !== '$') {
        return i;
      }
      if (str[i] === '\n') {
        // Inline math shouldn't span unclosed across blank lines; allow single line only
        return -1;
      }
    }
  }
  return -1;
}

function renderKatexSafe(tex: string, displayMode: boolean): { ok: true; html: string } | { ok: false } {
  try {
    const html = katex.renderToString(tex.trim(), {
      displayMode,
      throwOnError: true,
      strict: false,
      trust: false,
    });
    return { ok: true, html };
  } catch {
    return { ok: false };
  }
}

/**
 * Renders inline formatting like **bold** and preserves \n line breaks safely via React elements.
 */
function renderPlainTextWithBreaks(text: string, keyPrefix: string): React.ReactNode[] {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];

  lines.forEach((line, lineIdx) => {
    if (lineIdx > 0) {
      nodes.push(<br key={`${keyPrefix}-br-${lineIdx}`} />);
    }

    // Simple **bold** support for clean solutions
    const boldParts = line.split(/(\*\*[^*]+\*\*)/g);
    boldParts.forEach((part, partIdx) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        nodes.push(
          <strong key={`${keyPrefix}-b-${lineIdx}-${partIdx}`} className="font-semibold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
      } else if (part.length > 0) {
        nodes.push(<React.Fragment key={`${keyPrefix}-t-${lineIdx}-${partIdx}`}>{part}</React.Fragment>);
      }
    });
  });

  return nodes;
}

export const MathText: React.FC<MathTextProps> = React.memo(({ text, className = '' }) => {
  const renderedNodes = useMemo(() => {
    if (!text) return null;
    const segments = tokenizeMath(text);

    return segments.map((seg, idx) => {
      if (seg.kind === 'text') {
        return <React.Fragment key={`seg-${idx}`}>{renderPlainTextWithBreaks(seg.content, `seg-${idx}`)}</React.Fragment>;
      }

      if (seg.kind === 'block') {
        const res = renderKatexSafe(seg.content, true);
        if (res.ok) {
          return (
            <span
              key={`seg-${idx}`}
              className="block my-2 overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: res.html }}
            />
          );
        }
        return (
          <span key={`seg-${idx}`} className="block my-2 font-mono text-sm text-slate-700 bg-slate-100 px-2 py-1 rounded">
            {`$$${seg.content}$$`}
          </span>
        );
      }

      const res = renderKatexSafe(seg.content, false);
      if (res.ok) {
        return (
          <span
            key={`seg-${idx}`}
            className="inline-block align-baseline"
            dangerouslySetInnerHTML={{ __html: res.html }}
          />
        );
      }
      return (
        <span key={`seg-${idx}`} className="font-mono text-sm text-slate-700">
          {`$${seg.content}$`}
        </span>
      );
    });
  }, [text]);

  return <div className={`math-text break-words ${className}`}>{renderedNodes}</div>;
});

MathText.displayName = 'MathText';
