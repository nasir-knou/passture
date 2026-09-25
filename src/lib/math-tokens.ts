/** 리치 텍스트 안의 KaTeX 수식 구간(`$…$`, `$$…$$`). 렌더러와 빌드 검증이 같은 규칙을 쓴다. */
export type MathToken = {
  displayMode: boolean;
  end: number;
  raw: string;
  start: number;
};

/** 앞에 백슬래시가 홀수 개 붙은 `\$`를 건너뛰고 needle의 위치를 찾는다. */
function indexOfUnescaped(value: string, needle: string, from: number): number {
  let index = value.indexOf(needle, from);

  while (index !== -1) {
    let backslashes = 0;
    for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor -= 1) {
      backslashes += 1;
    }

    if (backslashes % 2 === 0) {
      return index;
    }

    index = value.indexOf(needle, index + 1);
  }

  return -1;
}

export function findNextMathToken(value: string, from: number): MathToken | undefined {
  const displayStart = indexOfUnescaped(value, '$$', from);
  const inlineStart = indexOfUnescaped(value, '$', from);

  if (displayStart === -1 && inlineStart === -1) {
    return undefined;
  }

  if (displayStart !== -1 && (inlineStart === -1 || displayStart <= inlineStart)) {
    const end = indexOfUnescaped(value, '$$', displayStart + 2);
    if (end !== -1) {
      return {
        displayMode: true,
        start: displayStart,
        end: end + 2,
        raw: value.slice(displayStart + 2, end).trim(),
      };
    }
  }

  const start = inlineStart;
  const end = indexOfUnescaped(value, '$', start + 1);
  if (start !== -1 && end !== -1) {
    return {
      displayMode: false,
      start,
      end: end + 1,
      raw: value.slice(start + 1, end).trim(),
    };
  }

  return undefined;
}

export function extractMathTokens(value: string): MathToken[] {
  const tokens: MathToken[] = [];
  let cursor = 0;

  while (cursor < value.length) {
    const token = findNextMathToken(value, cursor);
    if (!token) {
      break;
    }

    tokens.push(token);
    cursor = token.end;
  }

  return tokens;
}
