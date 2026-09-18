// CBT 모의고사 채점 로직. DB/React에 의존하지 않는 순수 함수로 분리해서
// Vitest로 검증한다 (spec.md 1.5절: 과목당 40점 이상 AND 평균 60점 이상 합격).

export interface QuestionAnswerRecord {
  questionId: string;
  subjectId: string;
  isCorrect: boolean;
}

export interface SubjectScoreResult {
  subjectId: string;
  score: number;
  isPassed: boolean;
}

const PASSING_SCORE = 40;
const PASSING_AVERAGE = 60;

export function isSubjectPassed(score: number): boolean {
  return score >= PASSING_SCORE;
}

// 부동소수점 오차 방지용(예: 11/20*100 === 55.00000000000001). 시험 점수는
// 소수 둘째 자리보다 정밀할 필요가 없어서, 이 정도로 반올림해도 의미 손실이 없다.
function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

// 과목별로 묶어서 100점 만점으로 환산한다. subjectIds를 넘기면, 답안이 하나도
// 없는 과목(문제 배정 단계의 버그 등으로 발생할 수 있음)도 0점으로 결과에
// 포함시킨다 — 넘기지 않으면 답안이 있는 과목만 결과에 나타난다.
export function calculateSubjectScores(
  answers: QuestionAnswerRecord[],
  subjectIds?: string[],
): SubjectScoreResult[] {
  const bySubject = new Map<string, { correct: number; total: number }>();

  for (const subjectId of subjectIds ?? []) {
    bySubject.set(subjectId, { correct: 0, total: 0 });
  }

  for (const answer of answers) {
    const entry = bySubject.get(answer.subjectId) ?? { correct: 0, total: 0 };
    entry.total += 1;
    if (answer.isCorrect) entry.correct += 1;
    bySubject.set(answer.subjectId, entry);
  }

  return Array.from(bySubject.entries()).map(([subjectId, { correct, total }]) => {
    const score = total > 0 ? roundScore((correct / total) * 100) : 0;
    return { subjectId, score, isPassed: isSubjectPassed(score) };
  });
}

export function calculateTotalScore(subjectScores: SubjectScoreResult[]): number {
  if (subjectScores.length === 0) return 0;
  return roundScore(subjectScores.reduce((sum, s) => sum + s.score, 0) / subjectScores.length);
}

// 5과목(FULL_100)이면 전 과목 40점 이상 AND 평균 60점 이상, 1과목(SUBJECT_20)이면
// 그 과목의 과락 여부만으로 판정한다 — "평균" 개념이 성립하지 않기 때문.
export function isOverallPassed(subjectScores: SubjectScoreResult[]): boolean {
  if (subjectScores.length === 0) return false;
  if (subjectScores.length === 1) {
    return subjectScores[0].isPassed;
  }
  const average = calculateTotalScore(subjectScores);
  return subjectScores.every((s) => s.isPassed) && average >= PASSING_AVERAGE;
}
