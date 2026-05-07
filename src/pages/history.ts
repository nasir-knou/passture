import type { Catalog } from '../types/catalog';
import type { Choice, Passage, Question, QuestionImage } from '../types/question';
import { loadQuestionFile } from '../lib/data-loader';
import {
  loadBookmarks,
  loadWrongAnswers,
  removeBookmark,
  type WrongAnswerRecord,
} from '../lib/storage';
import { escapeHtml, renderFooter, renderTopNav, sourceKindLabel } from './shared';

type HistoryFilter = 'all' | 'bookmarked' | 'wrong';

interface HistoryEntry {
  key: string;
  subjectId: string;
  subjectTitle: string;
  sourceId: string;
  sourceKey: string;
  sourceTitle: string;
  sourceKind: string;
  question: Question;
  passages: Passage[];
  choices: Choice[];
  bookmarked: boolean;
  wrongAnswer: WrongAnswerRecord | undefined;
}

export async function renderHistoryPage(catalog: Catalog): Promise<HTMLElement> {
  const page = document.createElement('main');
  page.className = 'app-shell';
  const filter = readHistoryFilter();
  const subjectId = readSubjectFilter();
  const sourceKey = readSourceFilter();
  const entries = await readHistoryEntries(catalog);
  const visibleEntries = entries.filter(
    (entry) =>
      (filter === 'all' ||
        (filter === 'bookmarked' && entry.bookmarked) ||
        (filter === 'wrong' && entry.wrongAnswer)) &&
      (subjectId === 'all' || entry.subjectId === subjectId) &&
      (sourceKey === 'all' || entry.sourceKey === sourceKey),
  );

  page.innerHTML = `
    ${renderTopNav('history')}
    <section class="page-header">
      <p class="eyebrow">history</p>
      <h1>학습 기록</h1>
      <p class="lead">북마크한 문제와 오답 문제를 모아두는 공간입니다.</p>
    </section>
    ${renderHistoryFilters(catalog, filter, subjectId, sourceKey, entries)}
    ${
      visibleEntries.length === 0
        ? renderEmptyState(filter)
        : `<section class="stack" aria-label="학습 기록 문제">${visibleEntries.map(renderHistoryEntry).join('')}</section>`
    }
    ${renderFooter()}
  `;

  page.querySelectorAll<HTMLButtonElement>('[data-remove-bookmark]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.removeBookmark;
      if (key) {
        removeBookmark(key);
        window.location.hash = createHistoryHash(
          filter,
          subjectId,
          sourceKey,
          Date.now().toString(),
        );
      }
    });
  });

  page.querySelector<HTMLButtonElement>('[data-expand-history]')?.addEventListener('click', () => {
    page.querySelectorAll<HTMLDetailsElement>('[data-history-item]').forEach((details) => {
      details.open = true;
    });
  });

  page
    .querySelector<HTMLButtonElement>('[data-collapse-history]')
    ?.addEventListener('click', () => {
      page.querySelectorAll<HTMLDetailsElement>('[data-history-item]').forEach((details) => {
        details.open = false;
      });
    });

  page
    .querySelector<HTMLSelectElement>('[data-history-filter]')
    ?.addEventListener('change', (event) => {
      const target = event.currentTarget as HTMLSelectElement;
      window.location.hash = createHistoryHash(readFilterValue(target.value), subjectId, sourceKey);
    });

  page
    .querySelector<HTMLSelectElement>('[data-subject-filter]')
    ?.addEventListener('change', (event) => {
      const target = event.currentTarget as HTMLSelectElement;
      window.location.hash = createHistoryHash(filter, target.value, 'all');
    });

  page
    .querySelector<HTMLSelectElement>('[data-source-filter]')
    ?.addEventListener('change', (event) => {
      const target = event.currentTarget as HTMLSelectElement;
      window.location.hash = createHistoryHash(filter, subjectId, target.value);
    });

  return page;
}

async function readHistoryEntries(catalog: Catalog): Promise<HistoryEntry[]> {
  const bookmarkSet = new Set(loadBookmarks());
  const wrongAnswers = loadWrongAnswers();
  const trackedKeys = new Set([...bookmarkSet, ...Object.keys(wrongAnswers)]);

  if (trackedKeys.size === 0) {
    return [];
  }

  const entries = await Promise.all(
    catalog.subjects.flatMap((subject) =>
      subject.sources.map(async (source) => {
        const file = await loadQuestionFile(source.path);
        const passagesById = new Map(file.passages?.map((passage) => [passage.id, passage]));

        return file.questions.flatMap<HistoryEntry>((question) => {
          const key = `${subject.id}:${source.id}:${question.id}`;
          if (!trackedKeys.has(key)) {
            return [];
          }

          return {
            key,
            subjectId: subject.id,
            subjectTitle: subject.title,
            sourceId: source.id,
            sourceKey: `${subject.id}:${source.id}`,
            sourceTitle: source.title,
            sourceKind: sourceKindLabel(source.kind),
            question,
            passages: question.passageRefs?.flatMap((id) => passagesById.get(id) ?? []) ?? [],
            choices: question.choices,
            bookmarked: bookmarkSet.has(key),
            wrongAnswer: wrongAnswers[key],
          };
        });
      }),
    ),
  );

  return entries.flat().sort((left, right) => left.key.localeCompare(right.key));
}

function readHistoryFilter(): HistoryFilter {
  const query = window.location.hash.split('?')[1] ?? '';
  return readFilterValue(new URLSearchParams(query).get('filter') ?? 'all');
}

function readFilterValue(value: string): HistoryFilter {
  return value === 'bookmarked' || value === 'wrong' ? value : 'all';
}

function readSubjectFilter(): string {
  const query = window.location.hash.split('?')[1] ?? '';
  return new URLSearchParams(query).get('subject') ?? 'all';
}

function readSourceFilter(): string {
  const query = window.location.hash.split('?')[1] ?? '';
  return new URLSearchParams(query).get('source') ?? 'all';
}

function renderHistoryFilters(
  catalog: Catalog,
  filter: HistoryFilter,
  subjectId: string,
  sourceKey: string,
  entries: readonly HistoryEntry[],
): string {
  const bookmarkedCount = entries.filter((entry) => entry.bookmarked).length;
  const wrongCount = entries.filter((entry) => entry.wrongAnswer).length;

  return `
    <section class="panel history-toolbar" aria-label="학습 기록 필터">
      <div class="history-stat-list" aria-label="학습 기록 요약">
        <span><strong>${entries.length}</strong>전체</span>
        <span><strong>${bookmarkedCount}</strong>북마크</span>
        <span><strong>${wrongCount}</strong>오답 문제</span>
      </div>
      <div class="history-filter-row">
        <div class="filter-bar">
          <label>
            <span>기록 유형</span>
            <select data-history-filter>
              <option value="all" ${filter === 'all' ? 'selected' : ''}>전체</option>
              <option value="bookmarked" ${filter === 'bookmarked' ? 'selected' : ''}>북마크</option>
              <option value="wrong" ${filter === 'wrong' ? 'selected' : ''}>오답 문제</option>
            </select>
          </label>
          <label>
            <span>과목</span>
            <select data-subject-filter>
              <option value="all" ${subjectId === 'all' ? 'selected' : ''}>전체 과목</option>
              ${catalog.subjects
                .map(
                  (subject) => `
                    <option value="${escapeHtml(subject.id)}" ${subjectId === subject.id ? 'selected' : ''}>
                      ${escapeHtml(subject.title)}
                    </option>
                  `,
                )
                .join('')}
            </select>
          </label>
          <label>
            <span>출처</span>
            <select data-source-filter>
              <option value="all" ${sourceKey === 'all' ? 'selected' : ''}>전체 출처</option>
              ${renderSourceFilterOptions(catalog, subjectId, sourceKey)}
            </select>
          </label>
        </div>
        <div class="history-toggle-actions" aria-label="학습 기록 펼침 제어">
          <button class="secondary-button" type="button" data-expand-history>모두 펼치기</button>
          <button class="secondary-button" type="button" data-collapse-history>모두 접기</button>
        </div>
      </div>
    </section>
  `;
}

function renderSourceFilterOptions(
  catalog: Catalog,
  subjectId: string,
  selectedSourceKey: string,
): string {
  return catalog.subjects
    .filter((subject) => subjectId === 'all' || subject.id === subjectId)
    .flatMap((subject) =>
      subject.sources.map((source) => {
        const sourceKey = `${subject.id}:${source.id}`;
        const label =
          subjectId === 'all'
            ? `${subject.title} · ${source.title}`
            : `${source.title} · ${sourceKindLabel(source.kind)}`;

        return `
          <option value="${escapeHtml(sourceKey)}" ${selectedSourceKey === sourceKey ? 'selected' : ''}>
            ${escapeHtml(label)}
          </option>
        `;
      }),
    )
    .join('');
}

function renderEmptyState(filter: HistoryFilter): string {
  const label =
    filter === 'bookmarked'
      ? '북마크한 문제가 없습니다.'
      : filter === 'wrong'
        ? '저장된 오답 문제가 없습니다.'
        : '아직 학습 기록이 없습니다.';

  return `
    <section class="panel">
      <h2>기록 없음</h2>
      <p class="muted">${label}</p>
    </section>
  `;
}

function renderHistoryEntry(entry: HistoryEntry): string {
  return `
    <details class="panel history-item" data-history-item>
      <summary class="history-item-summary">
        <div class="history-item-header">
          <div>
            <strong>${escapeHtml(entry.key)}</strong>
            <p class="muted">${escapeHtml(entry.subjectTitle)} · ${escapeHtml(entry.sourceTitle)} · ${escapeHtml(entry.sourceKind)}</p>
          </div>
          <div class="history-badges" aria-label="문제 상태">
            ${entry.bookmarked ? '<span class="history-badge">북마크</span>' : ''}
            ${entry.wrongAnswer ? `<span class="history-badge is-wrong">오답 ${entry.wrongAnswer.wrongCount}회</span>` : ''}
          </div>
        </div>
        <p class="question-prompt">${escapeHtml(entry.question.prompt)}</p>
      </summary>
      <div class="history-item-body">
        ${renderPassages(entry.passages)}
        <fieldset class="choice-list">
          <legend class="sr-only">선택지</legend>
          ${entry.choices
            .map(
              (choice) => `
                <label class="choice-row">
                  <input
                    type="${entry.question.answers.length > 1 ? 'checkbox' : 'radio'}"
                    name="${escapeHtml(entry.key)}"
                    value="${escapeHtml(choice.id)}"
                    disabled
                  />
                  <span>${escapeHtml(choice.text)}</span>
                </label>
              `,
            )
            .join('')}
        </fieldset>
        ${
          entry.bookmarked
            ? `<div class="action-row"><button class="secondary-button" type="button" data-remove-bookmark="${escapeHtml(entry.key)}">북마크 해제</button></div>`
            : ''
        }
      </div>
    </details>
  `;
}

function renderPassages(passages: readonly Passage[]): string {
  if (passages.length === 0) {
    return '';
  }

  return passages
    .map(
      (passage) => `
        <section class="passage">
          <p class="muted">${escapeHtml(passage.id)}${passage.language ? ` · ${escapeHtml(passage.language)}` : ''}</p>
          ${passage.image ? renderImage(passage.image) : `<pre><code>${escapeHtml(passage.body ?? '')}</code></pre>`}
        </section>
      `,
    )
    .join('');
}

function renderImage(image: QuestionImage): string {
  return `
    <img
      class="question-image"
      src="${escapeHtml(image.path)}"
      alt="${escapeHtml(image.alt)}"
      loading="lazy"
    />
  `;
}

function createHistoryHash(
  filter: HistoryFilter,
  subjectId: string,
  sourceKey: string,
  ts?: string,
): string {
  const params = new URLSearchParams();
  if (filter !== 'all') {
    params.set('filter', filter);
  }

  if (subjectId !== 'all') {
    params.set('subject', subjectId);
  }

  if (sourceKey !== 'all') {
    params.set('source', sourceKey);
  }

  if (ts) {
    params.set('ts', ts);
  }

  const query = params.toString();
  return query ? `#/history?${query}` : '#/history';
}
