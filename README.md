# PASSture

방통대 기출, 워크북, 강의 연습문제를 정적 사이트에서 반복 풀이하는 학습 도구입니다. 별도의 서버/데이터베이스 없이 사용자 데이터는 로컬 브라우저에 저장합니다.

## 현재 기능

- 과목별 출처 선택: 기출(기말·출석대체), 기본서·워크북 문제, 강의 연습문제·기초특강
- 전체/1학기/2학기 과목 필터: 홈, 문제 선택, 모의 시험 선택, 학습 기록 화면
- 풀이 세션: 문제 순서/선지 순서 기본 또는 무작위 설정, 문제별 바로가기, 답안 체크 진행률
- 정답 확인과 다음 이동 분리, 전체 답안 체크 후 최종 채점
- 결과 화면: 출처 세트 요약, 문제별 정답/오답 바로가기, 선택 문항 해설 확인
- 북마크 저장/해제, 학습 기록에서 북마크와 오답 문제 필터링 확인
- 오답 기록 저장, 북마크만/오답만 다시 풀기
- 데이터 관리: 사용자 데이터 JSON 내보내기/가져오기(병합/덮어쓰기), 풀이 상태/학습 기록 초기화
- KaTeX 수식, 인라인 코드·`==강조==`, 코드 지문, 이미지 지문, 구조화 다이어그램(표·그래프 등) 지문 렌더링, 해설의 `※` 안내 블록
- 챕터별 풀이: 교재 목차(syllabus)가 등록된 과목은 교재 장 단위로 강의·교재·기출 문제를 모아 풀기, 장별 결과(대상 과목: [docs/source-coverage.md](docs/source-coverage.md))
- 모의 시험: 최대 3과목, 과목별 출처 선택, 과목당 25분 타이머, 시험형 풀이/결과 화면

## 로컬 개발

Node.js는 `.nvmrc`의 22 LTS, 패키지 매니저는 `package.json`의 `packageManager`에 맞춘 pnpm 10.11.0을 사용합니다.

```bash
corepack enable
corepack prepare pnpm@10.11.0 --activate
pnpm install       # 처음 실행하거나 의존성이 바뀐 뒤
pnpm dev           # 로컬 개발 서버 (기본 http://localhost:5173/)
pnpm data:build    # YAML 문제 원본을 public/data JSON으로 변환 및 검증
pnpm test          # 단위 테스트 (DOM 테스트는 happy-dom)
pnpm build         # 프로덕션 빌드
pnpm preview       # 빌드 결과 로컬 확인
pnpm format        # Prettier로 포맷
pnpm format:check  # Prettier 형식 검사 (CI에서도 실행)
```

`pnpm dev`와 `pnpm build`는 실행 전에 `pnpm data:build`를 자동으로 수행합니다. 개발 서버는 YAML을 검증 없이 직접 읽으므로, 실행 중 데이터를 고쳤다면 `pnpm data:build`로 다시 검증합니다.

## 콘텐츠

- 문제 원본은 `data/**/*.yaml`에 작성하고 `pnpm data:build`가 `public/data/**/*.json`을 생성합니다. 작성법은 [CONTRIBUTING.md](CONTRIBUTING.md), 스키마는 [docs/data-schema.md](docs/data-schema.md)를 참고합니다.
- 카탈로그에는 1학기 5과목과 2학기 8과목이 있습니다. 과목별 출처 현황과 챕터별 풀이 대상은 [docs/source-coverage.md](docs/source-coverage.md)에서 추적합니다.
- 현행 교재에 없어 챕터별 풀이에서 빠진 기출은 [docs/outdated.md](docs/outdated.md)에 기록합니다.
- `origin/`은 입력 참고용 원본(비공개)이며, 앱에서 쓰는 이미지는 `public/images/subjects/**`에 둡니다. 시험지 전체 이미지는 공개 자산으로 쓰지 않고, 도표는 가능하면 diagram으로 코드화합니다([docs/data-schema.md §8](docs/data-schema.md)).

## 라이선스와 권리

코드는 MIT License로 배포합니다.

모든 기출·교재·강의 관련 권리는 한국방송통신대학교 및 한국방송통신대학교 출판문화원에 있습니다.

Passture는 비영리 학습 목적의 문제풀이 도구이며, 권리자 요청 시 관련 자료를 삭제합니다.
