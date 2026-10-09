import katex from 'katex';

import { extractMathTokens, splitInlineCode } from '../../src/lib/math-tokens';

/** 리치 텍스트의 모든 수식 구간(인라인 코드 밖)이 KaTeX로 파싱되는지 확인한다. 글자 그대로의 `$`는 `\$`로 쓴다. */
export function validateMath(value: string, fieldPath: string): void {
  const tokens = splitInlineCode(value)
    .filter((segment) => !segment.code)
    .flatMap((segment) => extractMathTokens(segment.text));

  for (const token of tokens) {
    try {
      katex.renderToString(token.raw, {
        displayMode: token.displayMode,
        throwOnError: true,
        strict: 'ignore',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${fieldPath} has invalid math "${token.raw.slice(0, 60)}": ${message}`);
    }
  }
}

/**
 * `==강조==` 구분자가 짝이 맞는지 확인한다. 렌더러와 같은 순서로 인라인 코드를 먼저 떼고, 남은 구간에서 수식을
 * 떼어 낸 일반 텍스트를 줄 단위로 나눠 그 조각 안에서만 `==`를 센다. 렌더러도 그 조각 안에서만 짝을 맞추므로,
 * 짝이 없는 `==`는 화면에 글자 그대로 나오거나 다음 `==`와 엉뚱하게 짝지어진다.
 */
export function validateEmphasis(value: string, fieldPath: string): void {
  let line = 0;

  const checkPlain = (text: string) => {
    const parts = text.split('\n');
    for (const [index, part] of parts.entries()) {
      if (countDelimiters(part) % 2 !== 0) {
        throw new Error(
          `${fieldPath} line ${line + index + 1} has an unpaired == highlight delimiter`,
        );
      }
    }
    line += parts.length - 1;
  };

  for (const segment of splitInlineCode(value)) {
    if (segment.code) {
      line += countNewlines(segment.text);
      continue;
    }

    let cursor = 0;
    for (const token of extractMathTokens(segment.text)) {
      checkPlain(segment.text.slice(cursor, token.start));
      line += countNewlines(segment.text.slice(token.start, token.end));
      cursor = token.end;
    }
    checkPlain(segment.text.slice(cursor));
  }
}

/** 화면에서 renderMathText로 그려지는 문자열: 수식과 `==` 강조를 모두 검사한다. */
export function validateRichText(value: string, fieldPath: string): void {
  validateMath(value, fieldPath);
  validateEmphasis(value, fieldPath);
}

/** 렌더러처럼 왼쪽부터 겹치지 않게 `==`를 센다(`===`는 1개). */
function countDelimiters(text: string): number {
  let count = 0;
  let cursor = text.indexOf('==');
  while (cursor !== -1) {
    count += 1;
    cursor = text.indexOf('==', cursor + 2);
  }

  return count;
}

function countNewlines(text: string): number {
  return text.split('\n').length - 1;
}
