import { describe, expect, it } from "vitest";
import {
  calculateSubjectScores,
  calculateTotalScore,
  isOverallPassed,
  isSubjectPassed,
  type QuestionAnswerRecord,
} from "./grading";

function makeAnswers(subjectId: string, correctCount: number, total: number): QuestionAnswerRecord[] {
  return Array.from({ length: total }, (_, i) => ({
    questionId: `${subjectId}-q${i}`,
    subjectId,
    isCorrect: i < correctCount,
  }));
}

describe("isSubjectPassed", () => {
  it("40점이면 통과", () => {
    expect(isSubjectPassed(40)).toBe(true);
  });

  it("39점이면 과락", () => {
    expect(isSubjectPassed(39)).toBe(false);
  });

  it("100점이면 통과", () => {
    expect(isSubjectPassed(100)).toBe(true);
  });
});

describe("calculateSubjectScores", () => {
  it("20문항 중 15개 정답이면 75점", () => {
    const answers = makeAnswers("subject-1", 15, 20);
    const result = calculateSubjectScores(answers);
    expect(result).toEqual([{ subjectId: "subject-1", score: 75, isPassed: true }]);
  });

  it("여러 과목을 정확히 분리해서 계산", () => {
    const answers = [...makeAnswers("subject-1", 20, 20), ...makeAnswers("subject-2", 8, 20)];
    const result = calculateSubjectScores(answers);
    expect(result).toEqual([
      { subjectId: "subject-1", score: 100, isPassed: true },
      { subjectId: "subject-2", score: 40, isPassed: true },
    ]);
  });

  it("빈 배열이면 빈 결과", () => {
    expect(calculateSubjectScores([])).toEqual([]);
  });

  it("부동소수점 오차 없이 정수로 떨어진다 (11/20 → 55, 55.00000000000001 아님)", () => {
    const answers = makeAnswers("subject-1", 11, 20);
    const result = calculateSubjectScores(answers);
    expect(result[0].score).toBe(55);
  });

  it("subjectIds를 넘기면 답안이 없는 과목도 0점으로 포함된다 (0으로 나누기 방지)", () => {
    const answers = makeAnswers("subject-1", 10, 20);
    const result = calculateSubjectScores(answers, ["subject-1", "subject-2"]);
    expect(result).toEqual([
      { subjectId: "subject-1", score: 50, isPassed: true },
      { subjectId: "subject-2", score: 0, isPassed: false },
    ]);
  });

  it("subjectIds를 안 넘기면 답안이 없는 과목은 결과에서 빠진다", () => {
    const answers = makeAnswers("subject-1", 10, 20);
    const result = calculateSubjectScores(answers);
    expect(result).toEqual([{ subjectId: "subject-1", score: 50, isPassed: true }]);
  });
});

describe("calculateTotalScore", () => {
  it("과목별 점수의 평균을 계산", () => {
    const scores = [
      { subjectId: "a", score: 100, isPassed: true },
      { subjectId: "b", score: 40, isPassed: true },
    ];
    expect(calculateTotalScore(scores)).toBe(70);
  });

  it("빈 배열이면 0", () => {
    expect(calculateTotalScore([])).toBe(0);
  });
});

describe("isOverallPassed", () => {
  it("전 과목 40점 이상 + 평균 60점 이상이면 합격 (5과목)", () => {
    const scores = [
      { subjectId: "1", score: 40, isPassed: true },
      { subjectId: "2", score: 100, isPassed: true },
      { subjectId: "3", score: 100, isPassed: true },
      { subjectId: "4", score: 100, isPassed: true },
      { subjectId: "5", score: 60, isPassed: true },
    ];
    // 평균 = (40+100+100+100+60)/5 = 80
    expect(isOverallPassed(scores)).toBe(true);
  });

  it("한 과목이라도 40점 미만(과락)이면 평균이 60 이상이어도 불합격", () => {
    const scores = [
      { subjectId: "1", score: 39, isPassed: false },
      { subjectId: "2", score: 100, isPassed: true },
      { subjectId: "3", score: 100, isPassed: true },
      { subjectId: "4", score: 100, isPassed: true },
      { subjectId: "5", score: 100, isPassed: true },
    ];
    // 평균 = 87.8 이지만 1과목 과락
    expect(isOverallPassed(scores)).toBe(false);
  });

  it("전 과목 과락은 아니지만 평균이 60 미만이면 불합격", () => {
    const scores = Array.from({ length: 5 }, (_, i) => ({
      subjectId: String(i),
      score: 45,
      isPassed: true,
    }));
    // 평균 = 45
    expect(isOverallPassed(scores)).toBe(false);
  });

  it("전 과목 40점 이상(과락 없음)인데 평균만 59점이면 불합격", () => {
    const scores = [
      { subjectId: "1", score: 40, isPassed: true },
      { subjectId: "2", score: 40, isPassed: true },
      { subjectId: "3", score: 40, isPassed: true },
      { subjectId: "4", score: 100, isPassed: true },
      { subjectId: "5", score: 75, isPassed: true },
    ];
    // 평균 = (40+40+40+100+75)/5 = 59, 과락 과목 없음
    expect(isOverallPassed(scores)).toBe(false);
  });

  it("평균이 정확히 60점이고 전 과목 40점 이상이면 합격 (경계값)", () => {
    const scores = [
      { subjectId: "1", score: 40, isPassed: true },
      { subjectId: "2", score: 40, isPassed: true },
      { subjectId: "3", score: 40, isPassed: true },
      { subjectId: "4", score: 100, isPassed: true },
      { subjectId: "5", score: 80, isPassed: true },
    ];
    // 평균 = (40+40+40+100+80)/5 = 60, 전 과목 40점 이상
    expect(isOverallPassed(scores)).toBe(true);
  });

  it("평균이 59.9점이면 불합격 (경계값)", () => {
    const scores = [
      { subjectId: "1", score: 40, isPassed: true },
      { subjectId: "2", score: 40, isPassed: true },
      { subjectId: "3", score: 40, isPassed: true },
      { subjectId: "4", score: 100, isPassed: true },
      { subjectId: "5", score: 79.5, isPassed: true },
    ];
    // 평균 = 59.9
    expect(isOverallPassed(scores)).toBe(false);
  });

  it("과목 1개(SUBJECT_20)면 평균 조건 없이 그 과목 과락 여부만 본다", () => {
    expect(isOverallPassed([{ subjectId: "1", score: 40, isPassed: true }])).toBe(true);
    expect(isOverallPassed([{ subjectId: "1", score: 39, isPassed: false }])).toBe(false);
    // 평균 60 미만이어도 단일 과목이 40점 이상이면 합격 처리 (평균 개념 미적용)
    expect(isOverallPassed([{ subjectId: "1", score: 45, isPassed: true }])).toBe(true);
  });

  it("빈 배열이면 불합격", () => {
    expect(isOverallPassed([])).toBe(false);
  });
});
