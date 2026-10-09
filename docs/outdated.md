# Outdated 기출 문제

교재 개정으로 현재 교재 목차에 해당 장이 없어 챕터별 풀이에서 제외한 기출(`outdated: true`) 목록이다. 연도별 풀이와 모의 시험에는 그대로 나온다. `pnpm data:build`가 데이터의 `outdated: true` 문제와 아래 목록의 문제 키가 정확히 일치하는지 검사한다(규칙: [data-schema.md §4.4](./data-schema.md)).

항목 형식:

```text
- `{subjectId}:{sourceId}:{questionId}` — 주제 — 현재 교재에 없다고 판단한 근거
```

## 선형대수

기준 교재: 손진곤, 강태원, 김진욱, 『선형대수』(2024-07-25)

없음

## 컴퓨터과학개론

기준 교재: 이관용, 정광식, 『컴퓨터과학개론』(2021-07-25)

없음

## 프로그래밍언어론

기준 교재: 우균, 김진욱, 『프로그래밍언어론』(2025-07-25)

없음

## 컴파일러구성

기준 교재: 김강현, 박두순, 『컴파일러구성』(2023-07-25)

없음

## 시뮬레이션

기준 교재: 김강현, 백두권, 『시뮬레이션』(2022-09-01)

없음

## C프로그래밍

기준 교재: 『C프로그래밍』 현행 교재 목차(`data/subjects/c-programming/syllabus.yaml`, 1~9장)

없음

## UNIX시스템

기준 교재: 『UNIX시스템』 현행 교재 목차(`data/subjects/unix-system/syllabus.yaml`, 1~14장). 현행 교재는 네트워크 설정·원격 접속·웹 서버 장이 없고 12~14장이 깃으로 바뀌었다.

- `unix-system:past-exams-2017:e17-20` — 네트워크 명령(ping, netstat, traceroute, ifconfig) — 네트워크 관리를 다루는 장이 없음
- `unix-system:past-exams-2017:e17-21` — 네트워크 설정 파일(/etc/sysconfig/network, resolv.conf) — 네트워크 관리를 다루는 장이 없음
- `unix-system:past-exams-2017:e17-22` — 암호화 전송 프로그램(sftp, rcp, rlogin, telnet) — 원격 접속을 다루는 장이 없음
- `unix-system:past-exams-2017:e17-23` — SSH 서버 운영 점검 사항 — 원격 접속·SSH 서버를 다루는 장이 없음
- `unix-system:past-exams-2017:e17-24` — Apache httpd.conf 설정 항목 — 웹 서버를 다루는 장이 없음
- `unix-system:past-exams-2017:e17-25` — 웹 사이트 구축용 프로그램(Apache, PHP, MySQL) — 웹 서버를 다루는 장이 없음
- `unix-system:past-exams-2018:e18-19` — Apache httpd.conf Listen 항목 — 웹 서버를 다루는 장이 없음
- `unix-system:past-exams-2018:e18-24` — 네트워크 점검 명령(ifconfig, nslookup, traceroute, route) — 네트워크 관리를 다루는 장이 없음
- `unix-system:past-exams-2018:e18-25` — SSH 프로토콜 — 원격 접속을 다루는 장이 없음
- `unix-system:past-exams-2019:e19-20` — 네트워크 명령(traceroute, ping, route, netstat) — 네트워크 관리를 다루는 장이 없음
- `unix-system:past-exams-2019:e19-21` — ifconfig 명령의 기능 — 네트워크 관리를 다루는 장이 없음
- `unix-system:past-exams-2019:e19-23` — SSH를 쓰지 않는 원격 명령(rcp, ssh, sftp, scp) — 원격 접속을 다루는 장이 없음
- `unix-system:past-exams-2019:e19-24` — 아파치 DirectoryIndex 설정 항목 — 웹 서버를 다루는 장이 없음
