import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ExamMode, ExamResultResponse, ExamResultSubjectScore, ExamResultWrongAnswer } from "@/types/exam";

export async function GET(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;

  const session = await prisma.examSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    return NextResponse.json({ error: "시험 세션을 찾을 수 없습니다." }, { status: 404 });
  }
  // 이 엔드포인트는 종료된 시험만 다룬다 — 진행 중인 시험의 정답을 노출하면 안 되므로
  // (기존 GET /api/exams/[sessionId]는 반대로 isCorrect를 항상 숨긴다), 끝나지 않은
  // 세션이면 여기서 막는다. 클라이언트는 이 경우 /exam/[sessionId]로 돌려보낸다.
  if (!session.finishedAt || session.totalScore === null || session.isPassed === null) {
    return NextResponse.json({ error: "아직 종료되지 않은 시험입니다." }, { status: 400 });
  }

  const [subjectScores, questions, userAnswers] = await Promise.all([
    prisma.subjectScore.findMany({ where: { examSessionId: sessionId } }),
    prisma.question.findMany({
      where: { id: { in: session.questionIds } },
      include: {
        subject: { select: { name: true } },
        // 시험이 끝난 뒤라 정답을 보여줘도 되는 시점 — isCorrect를 포함한다
        // (진행 중 조회용 GET과의 핵심 차이).
        choices: { orderBy: { label: "asc" } },
      },
    }),
    // examSessionId로만 걸고 isCorrect 등으로 필터링하지 않는다 — 안 푼 문제도
    // submit 시점에 selectedChoiceId: null, isCorrect: false로 이미 저장돼 있으므로
    // (2단계-B 정책: 안 푼 문제 = 오답), 여기서 걸러내면 오히려 빠뜨리게 된다.
    prisma.userAnswer.findMany({ where: { examSessionId: sessionId } }),
  ]);

  const questionById = new Map(questions.map((q) => [q.id, q]));
  const userAnswerByQuestionId = new Map(userAnswers.map((a) => [a.questionId, a]));

  // subjectScores엔 Subject로의 relation이 없어서(schema상 subjectId만 있음), 이미
  // 불러온 questions에서 과목명을 찾아 채운다 — 추가 쿼리 없이 해결 가능.
  const subjectNameById = new Map(questions.map((q) => [q.subjectId, q.subject.name]));

  const resultSubjectScores: ExamResultSubjectScore[] = subjectScores.map((s) => ({
    subjectId: s.subjectId,
    subjectName: subjectNameById.get(s.subjectId) ?? "",
    score: s.score,
    isPassed: s.isPassed,
  }));

  const wrongAnswers: ExamResultWrongAnswer[] = [];
  session.questionIds.forEach((questionId, index) => {
    const question = questionById.get(questionId);
    const userAnswer = userAnswerByQuestionId.get(questionId);
    if (!question || !userAnswer || userAnswer.isCorrect) return;

    const correctChoice = question.choices.find((c) => c.isCorrect);
    const selectedChoice = question.choices.find((c) => c.id === userAnswer.selectedChoiceId);
    if (!correctChoice) return; // 방어적: 이론상 발생하지 않음

    wrongAnswers.push({
      questionId: question.id,
      questionNumber: index + 1,
      content: question.content,
      subjectName: question.subject.name,
      selectedChoiceLabel: selectedChoice?.label ?? null,
      selectedChoiceContent: selectedChoice?.content ?? null,
      correctChoiceLabel: correctChoice.label,
      correctChoiceContent: correctChoice.content,
    });
  });

  const response: ExamResultResponse = {
    sessionId: session.id,
    mode: session.mode as ExamMode,
    finishedAt: session.finishedAt.toISOString(),
    totalScore: session.totalScore,
    isPassed: session.isPassed,
    subjectScores: resultSubjectScores,
    wrongAnswers,
  };

  return NextResponse.json(response);
}
