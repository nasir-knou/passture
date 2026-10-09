import type { ChoiceDiagram } from '../../types/question';

/** 같은 화면에 여러 도식이 있어도 marker id가 겹치지 않도록 도식 내용으로 만든 짧은 해시. */
export function hashDiagram(diagram: ChoiceDiagram): string {
  const value = JSON.stringify(diagram);
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}

export function renderArrowMarker(markerId: string): string {
  return `<marker id="${markerId}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z"></path>
        </marker>`;
}
