# passture

방통대 기출, 워크북, 강의 연습문제를 정적 사이트에서 반복 풀이하는 학습 도구입니다.

## 개발

```bash
pnpm install
pnpm data:build
pnpm test
pnpm build
pnpm dev
```

## 콘텐츠

- 문제 원본은 `data/**/*.yaml`에 작성하고 `pnpm data:build`로 `public/data/**/*.json`을 생성합니다.
- `origin/`의 기출 이미지는 입력 참고용 원본이며, 앱에서 쓰는 이미지는 `public/images/subjects/**` 아래에 둡니다.
- 시험지 전체 이미지는 공개 자산으로 쓰지 않고, 필요한 코드·도표·표만 `pnpm image:crop <input> <output> <x> <y> <width> <height>`로 잘라 저장합니다.
- 공식 정답 대조 전 문항은 이미지 판독과 직접 풀이로 임시 정답을 넣고, 이후 M10에서 정오표/정답표로 검증합니다.

## 라이선스와 권리

코드는 MIT License로 배포합니다.

기출·교재·강의 관련 문제와 이미지는 비영리 학습 목적의 인용·정리 자료입니다. 관련 권리는 각 권리자에게 있으며, 권리자 요청이 있으면 해당 자료를 삭제합니다.
