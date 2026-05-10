# Java Lecture Exercises Audit

대상: `data/subjects/java-programming/lecture-exercises.yaml`

원본: `origin/java 강의연습문제`

검토 기준:

- `docs/data-schema.md`의 강의 문제 ID, 지문/이미지 처리 규칙
- 기존 Java 기출 데이터셋의 문제·선택지·정답·해설 작성 방식
- 원본 이미지를 10문항 단위로 대조

## 결과

- 총 31문항이 원본 1강~15강 31개 문항과 대응한다.
- 문제 본문, 선택지, 정답은 원본과 대체로 일치한다.
- 코드 지문은 `passages`의 `type: code`로 분리되어 있어 재사용성과 렌더링 측면에서 적절하다.
- 3강 접근제어 도식은 `simple-graph` diagram으로 도표화되어 있어 이미지 크롭보다 적절하다.
- 해설은 선택지별 오답 이유와 핵심 개념을 포함하고 있어 기존 기출 데이터셋 스타일과 맞는다.
- `multi-answer` 또는 `answers`가 2개 이상인 문항은 남아 있지 않다.

## 1~10번

범위:

- `l01-01` ~ `l05-01`
- 원본 `1강/001.png` ~ `5강/001.png`

확인 내용:

- Java 플랫폼 독립성, class 파일 생성, 기본형/클래스명, 정수 리터럴, 배열 문법, 출력문, protected 접근, final, Circle 상수, 다형성 문항을 대조했다.
- `g03-package-relation`은 원본 도식을 구조화한 diagram으로 적절하다.
- `g04-circle-code`, `g05-polymorph-code`는 이미지 대신 코드 지문으로 입력되어 적절하다.

## 11~20번

범위:

- `l05-02` ~ `l10-01`
- 원본 `5강/002.png` ~ `10강/001.png`

확인 내용:

- 인터페이스 상속/구현, 제네릭, 람다식, 패키지 선언, `throws`, `String` 불변성, `Object`/`String`, 기본/보조 스트림, `BufferedReader`, `Path` 문항을 대조했다.
- 코드 지문은 모두 `passageRefs`로 연결되어 있으며 원본의 핵심 정보를 텍스트로 보존한다.

## 21~31번

범위:

- `l10-02` ~ `l15-02`
- 원본 `10강/002.png` ~ `15강/002.png`

확인 내용:

- `FileChannel`, `ArrayList`, `Map`/`Set`, `IntStream`, 스트림 `filter`, 스레드 동기화, JDBC, `PreparedStatement`, JAR classpath, `java.base` 문항을 대조했다.
- `l12-02`는 원본 지문 자체가 “길이가 6 이상”이라고 쓰면서 코드 조건은 `word.length() >= 5`로 제시한다. 데이터셋은 원문 문구와 코드 조건을 그대로 보존했다.

## 수정 사항

- 모든 강의 문제 ID와 태그를 당시 문서 규칙에 맞춰 정리했다.
- passage화 가능한 코드/도식 지문은 `passages`와 `passageRefs`로 분리했다.
- 원본 기준 다중선택지 문항 제거 조건을 재확인했으며, 현재 데이터셋에는 제거 대상이 없다.

## 검증

- `pnpm exec tsx scripts/build-data.ts` 통과.
- `pnpm test -- --run tests/build-data.test.ts` 통과.
- 데이터셋 기계 점검 결과: 31문항, 12개 passage 모두 참조됨, `multi-answer` 및 복수 정답 문항 0개.

## 남은 리스크

- 원본은 이미지 캡처 기반이라 OCR 자동 검증은 수행하지 못했다. 이번 검토는 원본 이미지를 직접 열어 문항 단위로 대조했다.
