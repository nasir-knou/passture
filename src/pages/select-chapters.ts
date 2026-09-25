import type { CatalogSubject } from '../types/catalog';
import type { SyllabusChapter, SyllabusLecture } from '../types/syllabus';
import {
  chapterLabel,
  sourceCategories,
  sourceCategoryLabel,
  type SourceCategory,
} from '../lib/chapter';
import {
  countSelectedQuestions,
  loadChapterIndex,
  loadChapterSelection,
  type ChapterIndex,
  type ChapterSelection,
} from '../lib/chapter-practice';
import { escapeHtml } from './shared';

const romanNumerals = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ', 'Ⅹ'];
const panelIndexes = new WeakMap<HTMLElement, ChapterIndex>();

export function renderChapterPanelShell(): string {
  return `
    <fieldset class="segmented-field source-field chapter-field" data-chapter-panel>
      <legend>장 선택</legend>
      <p class="muted" data-chapter-loading>교재 목차와 문제를 불러오는 중입니다.</p>
    </fieldset>
  `;
}

/** 목차·문제 파일을 읽어 장 목록을 그린다. 요약 갱신은 onChange로 알린다. */
export async function hydrateChapterPanel(
  page: HTMLElement,
  subject: CatalogSubject,
  onChange: () => void,
): Promise<void> {
  const panel = page.querySelector<HTMLElement>('[data-chapter-panel]');
  if (!panel) {
    return;
  }

  let index: ChapterIndex;
  try {
    index = await loadChapterIndex(subject);
  } catch (error) {
    panel.innerHTML = `
      <legend>장 선택</legend>
      <p class="form-message">장 정보를 불러오지 못했습니다. ${escapeHtml(String(error))}</p>
    `;
    return;
  }

  panelIndexes.set(panel, index);
  const saved = loadChapterSelection();
  const restored = saved?.subjectId === subject.id ? saved : undefined;
  panel.innerHTML = renderChapterPanel(index, restored);
  bindChapterPanel(panel, onChange);
  onChange();
}

export function readChapterSelection(
  page: HTMLElement,
  subjectId: string,
): ChapterSelection | undefined {
  const panel = page.querySelector<HTMLElement>('[data-chapter-panel]');
  if (!panel || !panelIndexes.has(panel)) {
    return undefined;
  }

  return {
    subjectId,
    chapters: [
      ...new Set(
        Array.from(panel.querySelectorAll<HTMLInputElement>('input[name="chapter"]:checked')).map(
          (input) => Number(input.value),
        ),
      ),
    ],
    categories: sourceCategories.filter(
      (category) =>
        panel.querySelector<HTMLInputElement>(`input[name="chapter-category"][value="${category}"]`)
          ?.checked,
    ),
  };
}

export interface ChapterSummary {
  chapterCount: number;
  questionCount: number;
  chapterLabels: string[];
}

/** allowedKeys를 주면 북마크/오답 범위까지 반영해 실제 세션에 들어갈 문제 수를 센다. */
export function readChapterSummary(
  page: HTMLElement,
  subjectId: string,
  allowedKeys?: ReadonlySet<string>,
): ChapterSummary {
  const panel = page.querySelector<HTMLElement>('[data-chapter-panel]');
  const index = panel ? panelIndexes.get(panel) : undefined;
  const selection = readChapterSelection(page, subjectId);

  if (!index || !selection) {
    return { chapterCount: 0, questionCount: 0, chapterLabels: [] };
  }

  return {
    chapterCount: selection.chapters.length,
    questionCount: countSelectedQuestions(index, selection, allowedKeys),
    chapterLabels: selection.chapters.map(chapterLabel),
  };
}

function renderChapterPanel(index: ChapterIndex, restored: ChapterSelection | undefined): string {
  const selectedChapters = new Set(restored?.chapters ?? []);
  const selectedCategories = new Set<SourceCategory>(restored?.categories ?? sourceCategories);
  const availableCategories = new Set(index.sources.map((source) => source.category));
  const parts = index.syllabus.parts?.length
    ? index.syllabus.parts.map((part) => ({
        title: `${romanNumerals[part.no - 1] ?? part.no}부 ${part.title}`,
        chapters: index.syllabus.chapters.filter((chapter) => part.chapters.includes(chapter.no)),
      }))
    : [{ title: '', chapters: index.syllabus.chapters }];

  return `
    <legend>장 선택</legend>
    <div class="chapter-category-row" role="group" aria-label="문제 종류">
      <span class="muted">문제 종류</span>
      ${sourceCategories
        .map((category) => {
          const available = availableCategories.has(category);
          return `
            <label class="chapter-category ${available ? '' : 'is-unavailable'}">
              <input
                type="checkbox"
                name="chapter-category"
                value="${category}"
                ${available && selectedCategories.has(category) ? 'checked' : ''}
                ${available ? '' : 'disabled'}
              />
              <span>${sourceCategoryLabel(category)}${available ? '' : ' (준비 중)'}</span>
            </label>
          `;
        })
        .join('')}
    </div>
    <div class="chapter-bulk-actions">
      <button class="text-button" type="button" data-chapter-select-all>전체 선택</button>
      <button class="text-button" type="button" data-chapter-clear>전체 해제</button>
    </div>
    ${parts
      .map(
        (part, partIndex) => `
          <section class="chapter-part" data-chapter-part="${partIndex}">
            ${
              part.title
                ? `
                  <div class="chapter-part-header">
                    <strong>${escapeHtml(part.title)}</strong>
                    <button class="text-button" type="button" data-chapter-part-toggle="${partIndex}">부 전체</button>
                  </div>
                `
                : ''
            }
            <div class="check-list chapter-list">
              ${part.chapters
                .map((chapter) =>
                  renderChapterRow(chapter, index, selectedChapters.has(chapter.no)),
                )
                .join('')}
            </div>
          </section>
        `,
      )
      .join('')}
    ${
      index.outdatedCount > 0
        ? `<p class="muted chapter-note">교재 개정으로 현재 목차에 없는 기출 ${index.outdatedCount}문제는 챕터별 풀이에서 제외됩니다. 연도별 풀이에서는 그대로 풀 수 있습니다.</p>`
        : ''
    }
  `;
}

function renderChapterRow(chapter: SyllabusChapter, index: ChapterIndex, checked: boolean): string {
  const counts = index.counts.get(chapter.no) ?? { lecture: 0, material: 0, exam: 0 };
  const total = counts.lecture + counts.material + counts.exam;
  const lectures = formatLectureRange(
    index.syllabus.lectures.filter((lecture) => lecture.chapters.includes(chapter.no)),
  );

  return `
    <label class="check-row chapter-row ${total === 0 ? 'is-empty' : ''}">
      <input
        type="checkbox"
        name="chapter"
        value="${chapter.no}"
        ${checked && total > 0 ? 'checked' : ''}
        ${total === 0 ? 'disabled' : ''}
      />
      <span>
        <strong>${chapterLabel(chapter.no)} ${escapeHtml(chapter.title)}</strong>
        <small class="chapter-meta">
          ${sourceCategories
            .map(
              (category) =>
                `<span data-chapter-count="${category}">${sourceCategoryLabel(category)} ${counts[category]}</span>`,
            )
            .join('<span aria-hidden="true">·</span>')}
          ${lectures ? `<span class="chapter-lectures">${escapeHtml(lectures)}</span>` : ''}
        </small>
      </span>
    </label>
  `;
}

/** [3강, 4강] → "3–4강", [1강] → "1강", [1, 3강] → "1·3강" */
function formatLectureRange(lectures: SyllabusLecture[]): string {
  const numbers = lectures.map((lecture) => lecture.no).sort((a, b) => a - b);
  if (numbers.length === 0) {
    return '';
  }

  const first = numbers[0]!;
  const last = numbers[numbers.length - 1]!;
  const contiguous = last - first === numbers.length - 1;

  if (numbers.length === 1) {
    return `${first}강`;
  }

  return contiguous ? `${first}–${last}강` : `${numbers.join('·')}강`;
}

function bindChapterPanel(panel: HTMLElement, onChange: () => void): void {
  panel.addEventListener('change', onChange);

  const setAll = (inputs: Iterable<HTMLInputElement>, checked: boolean) => {
    for (const input of inputs) {
      if (!input.disabled) {
        input.checked = checked;
      }
    }
    onChange();
  };
  const chapterInputs = (root: ParentNode) =>
    Array.from(root.querySelectorAll<HTMLInputElement>('input[name="chapter"]'));

  panel
    .querySelector('[data-chapter-select-all]')
    ?.addEventListener('click', () => setAll(chapterInputs(panel), true));
  panel
    .querySelector('[data-chapter-clear]')
    ?.addEventListener('click', () => setAll(chapterInputs(panel), false));

  panel.querySelectorAll<HTMLButtonElement>('[data-chapter-part-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const part = panel.querySelector(
        `[data-chapter-part="${button.dataset.chapterPartToggle ?? ''}"]`,
      );
      if (!part) {
        return;
      }

      const inputs = chapterInputs(part).filter((input) => !input.disabled);
      setAll(
        inputs,
        inputs.some((input) => !input.checked),
      );
    });
  });
}
