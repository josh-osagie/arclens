export type HighlightPart = { key: string; className?: string; text: string };

const KEYWORD =
  /\b(?:import|export|from|const|let|var|function|return|if|else|type|interface|extends|implements|async|await|new|class|default|as|typeof|keyof|readonly|public|private|protected|void|null|undefined|true|false)\b/g;
const LINE_COMMENT = /(\/\/.*$)/g;
const BLOCK_COMMENT = /(\/\*[\s\S]*?\*\/)/g;
const STRING = /('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)/g;
const NUMBER = /\b(\d+(?:\.\d+)?)\b/g;
const JSX_TAG = /(<\/?[A-Za-z][\w.-]*|\/?>)/g;

function globalPattern(pattern: RegExp): RegExp {
  if (pattern.flags.includes("g")) {
    return pattern;
  }
  return new RegExp(pattern.source, `${pattern.flags}g`);
}

export function highlightLine(line: string): HighlightPart[] {
  if (!line) {
    return [{ key: "empty", text: " " }];
  }

  const tokens: Array<{ start: number; end: number; className: string }> = [];

  const addMatches = (pattern: RegExp, className: string) => {
    for (const match of line.matchAll(globalPattern(pattern))) {
      if (match.index === undefined) continue;
      tokens.push({
        start: match.index,
        end: match.index + match[0].length,
        className,
      });
    }
  };

  addMatches(LINE_COMMENT, "snippet-token--comment");
  addMatches(BLOCK_COMMENT, "snippet-token--comment");
  addMatches(STRING, "snippet-token--string");
  addMatches(JSX_TAG, "snippet-token--tag");
  addMatches(NUMBER, "snippet-token--number");
  addMatches(KEYWORD, "snippet-token--keyword");

  tokens.sort((a, b) => a.start - b.start || b.end - a.end);

  const merged: typeof tokens = [];
  for (const token of tokens) {
    const last = merged.at(-1);
    if (last && token.start < last.end) {
      continue;
    }
    merged.push(token);
  }

  if (merged.length === 0) {
    return [{ key: "plain", text: line }];
  }

  const parts: HighlightPart[] = [];
  let cursor = 0;

  merged.forEach((token, index) => {
    if (token.start > cursor) {
      parts.push({
        key: `gap-${index}`,
        text: line.slice(cursor, token.start),
      });
    }
    parts.push({
      key: `tok-${index}`,
      className: token.className,
      text: line.slice(token.start, token.end),
    });
    cursor = token.end;
  });

  if (cursor < line.length) {
    parts.push({ key: "tail", text: line.slice(cursor) });
  }

  return parts;
}
