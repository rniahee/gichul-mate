# 기출메이트 (GichulMate) — 정보처리기사 필기 스터디 사이트 개발 구현 문서

> 작성일: 2026-08-16
> 버전: v0.1 (MVP 설계안)
> 프로젝트명: 기출메이트 (GichulMate) / 리포지토리명: `gichul-mate`
> 작성 목적: 사이드 프로젝트 개발 방향 정리 및 개인 포트폴리오용 설계 문서

---

## 1. 프로젝트 개요

**프로젝트명: 기출메이트 (GichulMate)** — 기출문제를 함께 푸는 학습 메이트라는 의미.

### 1.1 배경

정보처리기사 필기를 합격하고 현재 실기를 준비하는 과정에서, 기출문제를 효율적으로 반복 학습하고 취약 과목을 파악할 수 있는 개인 학습 도구가 필요하다고 느꼈다. 시중 문제풀이 사이트/앱은 광고가 많거나, 오답 관리·통계 기능이 약하거나, UI가 낡은 경우가 많았다. 이를 직접 만들어 사용하면서 실제 학습에 활용하고, 동시에 포트폴리오로도 활용 가능한 프로젝트로 발전시킨다.

### 1.2 목적

- 1차 목표: 정보처리기사 **필기** 학습에 실질적으로 도움이 되는 문제풀이·오답관리·통계 서비스를 만들고 직접 사용한다.
- 2차 목표(향후): **실기** 영역(단답형·서술형)까지 확장하여 필기~실기 전 과정을 커버하는 학습 플랫폼으로 성장시킨다.
- 포트폴리오 목표: AI 활용, 데이터 모델링, 상태 관리, 시각화 등 기존 프로젝트(Doc Analyzer, Work Dashboard, Pomodoro Todo)와 차별화되는 기술적 포인트(간격 반복 알고리즘, AI 기반 해설/채점, 시험 시뮬레이션)를 확보한다.

### 1.3 대상 사용자

- 1차 사용자: 본인 (직접 실기 준비까지 사용)
- 2차 잠재 사용자: 정보처리기사를 준비하는 비전공자/취준생 (내일배움카드 등으로 단기간에 준비하는 수요가 많은 자격증)

### 1.4 프로젝트 범위

| 구분 | 범위 | 이번 단계 개발 여부 |
| --- | --- | --- |
| 필기 (객관식 4지선다) | 문제풀이, 모의고사(CBT), 오답노트, 통계, AI 해설 | ✅ 이번 단계에서 개발 |
| 실기 (단답형/서술형) | 문제풀이, AI 채점, 코드/SQL 실행형 문제 | 🔜 이후 단계 — **설계 단계에서는 반드시 고려**, 개발은 보류 |

> 실기는 지금 당장 만들지 않지만, 데이터 모델·라우팅·컴포넌트 구조 전반에 "실기가 추가돼도 스키마를 갈아엎지 않아도 되는" 설계를 전제로 한다. 아래 3, 5장에서 이 부분을 구체적으로 표시했다.

### 1.5 참고: 정보처리기사 필기 시험 규격 (2026년 기준)

기능 설계(특히 모의고사 시뮬레이션)의 기준이 되는 실제 시험 규격이다.

- 5과목: 소프트웨어 설계 / 소프트웨어 개발 / 데이터베이스 구축 / 프로그래밍 언어 활용 / 정보시스템 구축관리
- 과목당 20문항, 4지선다 객관식, 총 100문항
- 시험시간: 과목당 30분, 총 150분
- 합격 기준: 과목당 40점 이상 **AND** 전 과목 평균 60점 이상

> 참고로 2027년에 출제기준 개정이 예정되어 있다는 논의가 있다. 과목명·문항수가 바뀔 수 있으므로, 아래 데이터 모델은 **과목/시험 규격을 하드코딩하지 않고 설정 가능한 테이블로 분리**해서 이런 변화에 대응하도록 설계했다.

---

## 2. 핵심 컨셉 & 차별점

기존에 만든 프로젝트들과 비교했을 때 이 프로젝트에서 새로 확보하려는 기술적 포인트는 다음과 같다.

| 프로젝트 | 이미 확보한 역량 | 이번 프로젝트에서 추가로 확보할 역량 |
| --- | --- | --- |
| Doc Analyzer | AI(Gemini) 연동, 프롬프트 설계 | 정답이 정해진 도메인에서의 AI 활용(해설 생성, 채점) — 자유 서술 요약보다 훨씬 엄격한 프롬프트 설계 필요 |
| Work Dashboard | TanStack Query, Zustand, Recharts, MSW, Vitest | 실제 학습 데이터 기반 통계/취약점 분석 로직, 시험 시뮬레이션(타이머·자동 채점) |
| Pomodoro Todo | 상태 직접 구현, localStorage | 간격 반복(Spaced Repetition) 알고리즘 직접 구현, 정식 DB 설계 |

즉 이 프로젝트의 핵심 차별점은 **"AI를 요약이 아니라 채점/해설/취약점 분석에 쓴다"**는 점과 **"실제 시험 데이터(800문제)를 다루는 정식 데이터 모델링"**이다.

---

## 3. 기능 목록

### 3.1 MVP — 필기 핵심 기능

| 기능 | 설명 |
| --- | --- |
| 문제 은행 조회 | 과목/연도/키워드로 문제 검색·필터링, 문제 목록 페이지네이션 |
| 단원별 학습 모드 | 과목/단원(태그) 단위로 문제를 순서대로 풀이, 즉시 정답 확인 |
| CBT 모의고사 모드 | 실제 시험과 동일한 조건(5과목×20문항, 과목당 30분 or 전체 150분)으로 랜덤 출제 → 자동 채점 → 과목별 합/불 판정 |
| 오답노트 | 틀린 문제 자동 수집, 재풀이, "정답이었지만 헷갈렸던 문제" 별도 표시(즐겨찾기와 구분) |
| 즐겨찾기 / 북마크 | 나중에 다시 볼 문제 표시 |
| AI 해설 보기 | 문제 해설이 부족하거나 이해가 안 될 때 AI에게 추가 설명 요청 |
| 학습 통계 | 과목별 정답률, 최근 7/30일 학습량, 취약 단원 Top N |
| 학습 캘린더(잔디) | 날짜별 학습량 시각화 (Pomodoro Todo의 통계 UX 재활용) |

### 3.2 확장 기능 (필기 완성 이후, 여유 있으면)

| 기능 | 설명 |
| --- | --- |
| 간격 반복 복습 스케줄 | 오답/헷갈린 문제를 Leitner 시스템 기반으로 재출제 주기 자동 계산 |
| 취약 유형 AI 코칭 | 오답 데이터를 모아 "당신은 OSI 7계층 관련 문제에 약합니다" 같은 코멘트를 AI가 생성 |
| D-day / 목표 설정 | 실제 응시일까지 남은 기간 기반으로 하루 목표 문제 수 자동 추천 |
| 문제 신고/오탈자 제보 | 데이터 정합성 관리용 |

### 3.3 실기 확장 대비 (지금 개발 X, 설계에서만 고려)

| 기능 | 설명 | 설계 반영 포인트 |
| --- | --- | --- |
| 실기 단답형 문제 풀이 | 주관식 텍스트 입력 → 정답 비교 | `question_type` 컬럼에 `SHORT_ANSWER` 이미 정의 |
| 실기 서술형/코드 해석 문제 | 자유 서술 답안 → AI 채점 | `grading_type`(EXACT / AI_RUBRIC) 필드로 채점 방식 분기 가능하게 설계 |
| 필기-실기 연계 학습 | 필기에서 약한 단원을 실기 문제와 매핑해 추천 | `subjects`/`topics` 테이블을 필기·실기 공용으로 설계 |

---

## 4. 화면 구조 (정보 구조 / IA)

```
/                          홈 대시보드 (오늘의 학습 요약, 최근 정답률, D-day)
├── /questions             문제 은행 (필터: 과목, 연도, 난이도, 키워드 / 리스트 + 검색)
│   └── /questions/[id]     문제 상세 (풀이 → 정답 확인 → 해설 → AI 해설 더보기)
├── /study/[subjectId]      단원별 학습 모드 (연속 풀이, 진행률 바)
├── /exam                  CBT 모의고사 시작 화면 (모드 선택: 전체 100문항 / 과목별 20문항)
│   ├── /exam/[sessionId]   시험 진행 화면 (타이머, 문제 네비게이터, 답안 표시)
│   └── /exam/[sessionId]/result   결과 리포트 (과목별 점수, 합/불 판정, 오답 목록)
├── /wrong-notes            오답노트 (틀린 문제 모아보기, 재풀이 모드)
├── /bookmarks               즐겨찾기 문제 모음
├── /stats                  학습 통계 (과목별 정답률 차트, 학습 캘린더, 취약 단원)
├── /login, /signup          (선택) 계정 시스템 — 기기 이동/백업 대비, 최소 기능만
└── /practical  (향후)       실기 영역 진입점 — 현재는 "준비 중" 플레이스홀더만 배치
```

### 4.1 핵심 화면 상세

**홈 대시보드**
- 오늘 목표 문제 수 / 진행률
- 최근 모의고사 점수 추이(미니 차트)
- 취약 과목 배지, 바로가기 CTA("취약한 데이터베이스 구축 풀어보기")

**문제 상세 화면**
- 문제 지문 + 4지선다 보기
- 정답 제출 → 즉시 정오 표시 → 기본 해설 노출
- "AI에게 더 물어보기" 버튼 → 채팅형 UI로 꼬리질문 가능 (예: "3번 보기가 왜 틀렸는지 더 설명해줘")

**CBT 모의고사 진행 화면**
- 실제 큐넷 CBT와 유사한 UI: 좌측 문제 네비게이터(번호별 풀이 여부 색상 표시), 우측 문제/보기
- 과목 전환 시 남은 시간 표시, 제출 전 "안 푼 문제 N개" 경고
- 자동 채점 후 결과 리포트로 이동

**결과 리포트**
- 과목별 점수 막대 그래프 + 과락 여부(40점 미만 빨간색 강조)
- 평균 60점 기준선 표시
- 오답 문제 리스트 → 바로 오답노트에 담기

**오답노트**
- 틀린 문제 리스트 (틀린 횟수, 마지막 풀이일 표시)
- "재풀이" 모드: 오답만 모아 다시 시험처럼 풀기
- (확장) 복습 주기가 도래한 문제 상단 노출

**통계**
- 과목별 정답률 도넛/바 차트 (Work Dashboard에서 썼던 Recharts 패턴 재사용)
- 일별 학습량 캘린더 히트맵
- 취약 단원 랭킹

---

## 5. 데이터 설계

### 5.1 기출문제 원본 데이터 처리 전략

사용자가 보유한 기출문제(약 800문제)는 아마 한글/엑셀/텍스트 등 비정형에 가까운 형태일 가능성이 높다는 전제로, 다음과 같은 **적재 파이프라인**을 제안한다.

```
[원본 데이터]              [정제 스크립트]              [구조화 JSON]           [DB Seed]
엑셀/텍스트/PDF   ──▶   파싱 + AI 보정 스크립트   ──▶   questions.json   ──▶   Prisma seed
(문제, 보기, 정답,        (1회성, 개발 단계에서만 실행)
 해설, 연도, 과목 등)
```

**단계별 설명**

1. **원본 확보**: 기출문제를 과목/연도별로 최대한 정리된 형태(엑셀 표가 이상적)로 준비한다. 완전히 비정형 텍스트(예: PDF에서 복붙한 덩어리 텍스트)라면 2번 단계에서 AI로 구조화한다.
2. **AI 기반 구조화(1회성 배치 작업)**: 비정형 텍스트를 아래 스키마에 맞는 JSON으로 변환하는 스크립트를 작성하고, Gemini API에 "다음 텍스트에서 문제/보기 4개/정답/해설/과목을 JSON으로 추출해줘"라는 프롬프트로 배치 처리한다. 이 작업은 **서비스 런타임이 아니라 개발 단계에서 한 번 돌리는 오프라인 스크립트**로 설계한다(비용·정합성 관리 목적).
3. **검수**: AI가 추출한 800문제를 스프레드시트로 내보내 눈으로 한 번 빠르게 검수(특히 정답 번호, 특수문자 깨짐 여부)한다. 자격증 문제는 정답이 틀리면 학습에 직접적인 악영향을 주므로 이 단계는 생략하지 않는다.
4. **DB 적재**: 검수된 JSON을 Prisma seed 스크립트로 DB에 적재한다.
5. **이후 신규 회차 문제 추가**: 매 회차 시험 후 새 기출문제를 같은 파이프라인으로 추가할 수 있도록 스크립트를 재사용 가능하게 만든다.

> 실기 확장 시에도 동일 파이프라인을 재사용할 수 있도록, JSON 스키마에 `question_type`, `subjective_answer`, `grading_rubric` 필드를 처음부터 옵셔널로 포함해둔다.

### 5.2 데이터베이스 스키마

관계형 DB(PostgreSQL) + Prisma ORM 기준으로 설계했다. 실기 확장을 고려해 `exam_type`, `question_type` 등을 처음부터 열어둔 것이 포인트다.

```prisma
// 시험 종류 (필기/실기) — 향후 실기 확장 대비, 처음부터 분리
enum ExamType {
  WRITTEN     // 필기
  PRACTICAL   // 실기 (지금은 데이터 없음, 스키마만 존재)
}

// 문제 유형 — 실기의 단답형/서술형까지 미리 정의
enum QuestionType {
  MULTIPLE_CHOICE   // 4지선다 (필기)
  SHORT_ANSWER       // 단답형 (실기)
  ESSAY              // 서술형/코드해석 (실기)
}

// 채점 방식 — 실기 서술형은 AI 채점으로 분기
enum GradingType {
  EXACT_MATCH   // 정답 일치 여부 (필기, 실기 단답형)
  AI_RUBRIC     // AI가 루브릭 기반으로 채점 (실기 서술형)
}

model Subject {
  id          String     @id @default(cuid())
  examType    ExamType
  name        String     // 예: "소프트웨어 설계"
  order       Int        // 시험 내 과목 순서
  questions   Question[]
  topics      Topic[]
}

// 과목 하위의 세부 단원/태그 (취약점 분석 단위)
model Topic {
  id          String     @id @default(cuid())
  subjectId   String
  subject     Subject    @relation(fields: [subjectId], references: [id])
  name        String     // 예: "OSI 7계층", "정규화"
  questions   Question[]
}

model Question {
  id             String        @id @default(cuid())
  examType       ExamType
  subjectId      String
  subject        Subject       @relation(fields: [subjectId], references: [id])
  topicId        String?
  topic          Topic?        @relation(fields: [topicId], references: [id])
  type           QuestionType  @default(MULTIPLE_CHOICE)
  gradingType    GradingType   @default(EXACT_MATCH)

  year           Int?          // 출제 연도 (예: 2024)
  round          Int?          // 회차 (1/2/3회)
  content        String        // 문제 지문
  explanation    String?       // 기본 해설

  choices        Choice[]      // 필기 4지선다용
  correctAnswer  String?       // 단답형 정답 텍스트 (실기용, 지금은 미사용)
  gradingRubric  String?       // 서술형 채점 기준 (실기용, 지금은 미사용)

  createdAt      DateTime      @default(now())

  userAnswers    UserAnswer[]
  wrongNotes     WrongNote[]
  bookmarks      Bookmark[]
}

model Choice {
  id          String    @id @default(cuid())
  questionId  String
  question    Question  @relation(fields: [questionId], references: [id])
  label       String    // "1", "2", "3", "4"
  content     String
  isCorrect   Boolean
}

// 사용자가 문제를 풀 때마다의 기록 (단건 풀이 + 모의고사 풀이 공용)
model UserAnswer {
  id            String     @id @default(cuid())
  userId        String?    // 로그인 없이 쓸 경우 null 허용, 추후 계정 연동
  questionId    String
  question      Question   @relation(fields: [questionId], references: [id])
  examSessionId String?    // 모의고사 중 풀었다면 세션 연결, 단건 풀이면 null
  examSession   ExamSession? @relation(fields: [examSessionId], references: [id])

  selectedChoiceId String?  // 필기 객관식 선택
  submittedText    String?  // 실기 주관식 입력 (지금은 미사용)
  isCorrect        Boolean
  aiScore          Float?   // 실기 AI 채점 점수 (지금은 미사용)

  answeredAt       DateTime @default(now())
}

// CBT 모의고사 세션
model ExamSession {
  id           String    @id @default(cuid())
  userId       String?
  examType     ExamType  @default(WRITTEN)
  mode         String    // "FULL_100" | "SUBJECT_20" 등
  startedAt    DateTime  @default(now())
  finishedAt   DateTime?
  totalScore   Float?
  isPassed     Boolean?

  answers      UserAnswer[]
  subjectScores SubjectScore[]
}

// 모의고사의 과목별 채점 결과 (과락 판정용)
model SubjectScore {
  id            String       @id @default(cuid())
  examSessionId String
  examSession   ExamSession  @relation(fields: [examSessionId], references: [id])
  subjectId     String
  score         Float
  isPassed      Boolean      // 40점 이상 여부
}

model WrongNote {
  id           String    @id @default(cuid())
  userId       String?
  questionId   String
  question     Question  @relation(fields: [questionId], references: [id])
  wrongCount   Int       @default(1)
  lastWrongAt  DateTime  @default(now())
  nextReviewAt DateTime? // 간격 반복 스케줄용 (확장 기능)
  resolved     Boolean   @default(false) // 더 이상 틀리지 않게 된 문제
}

model Bookmark {
  id          String    @id @default(cuid())
  userId      String?
  questionId  String
  question    Question  @relation(fields: [questionId], references: [id])
  createdAt   DateTime  @default(now())
}

// AI 응답 캐시 (동일 문제에 대한 AI 해설 재요청 시 비용 절감)
model AiExplanationCache {
  id          String    @id @default(cuid())
  questionId  String    @unique
  content     String    // AI가 생성한 보충 해설
  createdAt   DateTime  @default(now())
}
```

**설계 포인트 요약**

- `ExamType`, `QuestionType`, `GradingType`을 enum으로 분리해, 실기 데이터가 들어와도 `Question` 테이블 구조를 바꾸지 않고 확장 가능.
- `UserAnswer`는 단건 풀이와 모의고사 풀이를 같은 테이블에서 관리해, 통계 집계 쿼리를 하나로 통일.
- `SubjectScore`를 별도 테이블로 분리해 "과목당 40점 미만 과락" 판정을 정확히 표현.
- `AiExplanationCache`로 동일 문제에 대한 AI 호출을 캐싱 → 비용 절감 + 응답 속도 개선.
- `userId`를 전부 nullable로 설계해, **MVP 단계에서는 로그인 없이 로컬(브라우저) 단일 사용자로 운영**하다가, 필요 시 계정 시스템을 나중에 얹을 수 있도록 함.

### 5.3 초기 로그인 전략에 대한 제안

정식 회원 시스템을 처음부터 만들면 개발 범위가 커진다. 다음 중 하나를 선택하는 것을 제안한다.

| 옵션 | 장점 | 단점 |
| --- | --- | --- |
| A. 로그인 없이 시작 (브라우저 고정 ID + DB 저장) | 빠른 MVP, 본인 사용에 충분 | 기기 이동 시 데이터 이전 어려움, 포트폴리오에서 "인증" 역량 어필 어려움 |
| B. 간단한 이메일/비밀번호 or OAuth(Google) 로그인 | 여러 기기 동기화, 회원 관리 역량 어필 | 초기 개발 범위 증가 |

**제안**: 처음엔 A로 시작해 핵심 학습 기능부터 완성하고, 오답노트/통계가 안정화된 뒤 B를 추가하는 순서를 권장한다(NextAuth.js 또는 Supabase Auth 활용).

---

## 6. 기술 스택

| 영역 | 기술 | 선택 이유 |
| --- | --- | --- |
| 프레임워크 | Next.js 16 (App Router) | Doc Analyzer, Work Dashboard와 동일 — 숙련도가 높고 이력서 스킬셋과 일치 |
| 언어 | TypeScript | 문제/보기/채점 로직처럼 타입 오류가 곧 데이터 오류로 이어지는 도메인에서 특히 유용 |
| 스타일 | Tailwind CSS v4 | 기존 프로젝트와 통일, 빠른 UI 개발 |
| 서버 상태 관리 | TanStack Query v5 | 문제 목록/통계 등 서버 데이터 캐싱·리페칭에 재사용 |
| 클라이언트 상태 관리 | Zustand | 모의고사 진행 중 타이머·현재 답안 등 로컬 상태 관리 |
| DB | PostgreSQL (Supabase 또는 Neon) | 무료 티어로 시작 가능, 관계형 데이터(과목-문제-보기-오답)에 적합 |
| ORM | Prisma | 스키마 관리와 마이그레이션이 명확, seed 스크립트로 800문제 적재에 용이 |
| 인증(추후) | NextAuth.js 또는 Supabase Auth | 최소 설정으로 이메일/OAuth 로그인 지원 |
| AI | Gemini API (`gemini-2.5-flash` 등) | 이미 Doc Analyzer에서 사용 경험 보유, 비용 효율적 |
| 차트/시각화 | Recharts | Work Dashboard와 동일 — 학습 통계 화면에 재사용 |
| 폼 | react-hook-form | 문제 신고, 회원가입 등 폼 처리 |
| 테스트 | Vitest + Testing Library | 채점 로직(과락 판정 등)은 반드시 단위 테스트로 검증 |
| 배포 | Vercel + Supabase | 기존 Work Dashboard 배포 경험 재사용 |

---

## 7. AI 활용 방향 상세

이 프로젝트에서 AI는 크게 **(1) 데이터 구축 단계**, **(2) 서비스 내 학습 보조 기능**, **(3) 향후 실기 채점**, 세 곳에서 사용한다.

### 7.1 데이터 구축 단계 — 기출문제 구조화

- 목적: 비정형 원본(엑셀/텍스트/PDF 복붙 텍스트)을 DB 스키마에 맞는 JSON으로 변환
- 실행 시점: **서비스 런타임이 아닌 개발 단계의 1회성 배치 스크립트**
- 프롬프트 설계 방향: "다음 텍스트에서 문제 지문, 보기 4개, 정답 번호, 과목명, 연도를 추출해서 지정된 JSON 스키마로만 응답해줘"처럼 **출력 형식을 엄격하게 고정**(Doc Analyzer의 자유 서술 요약과 달리, 여기서는 정형 출력이 핵심)
- 검수 필수: AI 추출 결과는 정답 정확도가 생명이므로, 사람이 최종 검수하는 단계를 반드시 거친다(5.1 참고)

### 7.2 서비스 내 AI 기능

| 기능 | 입력 | 출력 | 비고 |
| --- | --- | --- | --- |
| AI 추가 해설 | 문제 지문 + 보기 + 기본 해설 + 사용자 질문("왜 3번이 틀렸어?") | 꼬리질문에 대한 맞춤 설명 | `AiExplanationCache`로 동일 질문 재사용 시 캐시 우선 조회 |
| 취약 유형 코칭 | 최근 N개 오답 데이터(과목/단원 통계) | "정규화·인덱스 관련 문제 정답률이 낮습니다. OO 개념을 다시 보는 걸 추천합니다" 형태의 코멘트 | 통계 페이지에서 주기적으로 생성, 매 요청마다 호출하지 않고 하루 1회 등으로 제한 |

### 7.3 향후 실기 확장 시 AI 활용 (설계만, 개발은 보류)

- **단답형 채점**: 정답 텍스트와 사용자 입력을 정규화(공백/대소문자 등) 후 비교하는 규칙 기반 채점이 1차. 애매한 경우(동의어, 표현 차이)만 AI로 2차 검증.
- **서술형/코드 해석 채점**: 채점 기준(루브릭)을 `gradingRubric` 필드에 저장해두고, AI에게 "다음 루브릭 기준으로 사용자 답안을 채점하고 부족한 부분을 알려줘"라는 형태로 요청. 점수는 `UserAnswer.aiScore`에 저장.
- 이 부분은 정답의 모호성이 커서 신중한 프롬프트 설계와 실제 기출 정답 사례 기반의 검증이 필요하므로, 필기 기능이 안정화된 이후 별도 단계로 진행한다.

### 7.4 AI 사용 시 유의사항

- **비용 관리**: 동일 문제에 대한 반복 요청은 캐시(`AiExplanationCache`)로 최소화. 배치 구조화 작업은 개발 단계에서만 실행해 런타임 비용과 분리.
- **정답 노출 순서**: AI에게 해설을 요청할 때 이미 정답과 사용자가 고른 오답을 함께 전달하되, 서비스 UI 상에서는 사용자가 먼저 풀이를 완료한 뒤에만 AI 해설 버튼이 노출되도록 해 학습 효과를 해치지 않게 한다.
- **환각(hallucination) 방지**: 문제 데이터 자체(지문/보기/정답)는 AI가 실시간으로 새로 생성하지 않고 반드시 DB의 검수된 데이터만 사용한다. AI는 "설명을 덧붙이는 역할"로 한정하고 "정답을 판단하는 역할"에는 최대한 규칙 기반 로직을 우선한다.

---

## 8. 비기능 요구사항

- **반응형**: 모바일에서도 문제풀이가 가능하도록 우선 설계 (이동 중 학습 시나리오 고려)
- **타이머 정확도**: CBT 모의고사 타이머는 클라이언트 setInterval 오차가 누적되지 않도록 시작 시각(timestamp) 기준으로 남은 시간을 재계산하는 방식 사용 (Pomodoro Todo에서 얻은 경험 재사용)
- **오프라인 대비**: 문제풀이 중 네트워크가 끊겨도 임시 답안이 유실되지 않도록 로컬 상태에 우선 저장 후 배치로 서버 반영
- **접근성**: 키보드만으로 보기 선택 및 제출 가능하도록 처리 (1, 2, 3, 4 숫자 키 단축 지원 등)

---

## 9. 개발 로드맵

| 단계 | 범위 |
| --- | --- |
| 0단계 | 기출문제 원본 정리, AI 구조화 스크립트 작성, DB 스키마 확정, 800문제 seed 완료 |
| 1단계 (MVP) | 문제 은행 조회, 단원별 학습 모드, 기본 해설 노출 |
| 2단계 | CBT 모의고사 모드, 결과 리포트(과목별 과락 판정) |
| 3단계 | 오답노트, 즐겨찾기 |
| 4단계 | 학습 통계(정답률 차트, 캘린더 히트맵) |
| 5단계 | AI 추가 해설 기능 (캐시 포함) |
| 6단계 | (선택) 계정 시스템 추가, 간격 반복 복습 스케줄, 취약 유형 AI 코칭 |
| 7단계 (향후) | 실기 데이터 확보 후 실기 문제풀이/AI 채점 기능 개발 |

---

## 10. 요약

- 이번 단계는 **필기 학습 서비스(문제은행 + CBT 모의고사 + 오답노트 + 통계 + AI 해설)**를 완성하는 데 집중한다.
- 데이터 모델은 처음부터 `ExamType`/`QuestionType`/`GradingType`을 분리해, **실기 데이터가 추가돼도 스키마를 다시 짜지 않아도 되도록** 설계했다.
- AI는 "정답을 만드는 도구"가 아니라 "검수된 정답 데이터를 보조 설명하는 도구"로 역할을 한정해, 신뢰도 높은 학습 자료를 유지한다.
- 기술 스택은 기존 프로젝트(Doc Analyzer, Work Dashboard)에서 검증된 조합(Next.js + TypeScript + TanStack Query + Zustand + Recharts + Gemini API)을 그대로 재사용해 개발 속도를 높이고, DB/ORM(Prisma + PostgreSQL)만 새로 도입해 백엔드 데이터 모델링 역량을 포트폴리오에 추가한다.
