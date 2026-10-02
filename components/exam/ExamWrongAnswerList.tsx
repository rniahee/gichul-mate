import Link from "next/link";
import type { ExamResultWrongAnswer } from "@/types/exam";

interface ExamWrongAnswerListProps {
  wrongAnswers: ExamResultWrongAnswer[];
}

export function ExamWrongAnswerList({ wrongAnswers }: ExamWrongAnswerListProps) {
  if (wrongAnswers.length === 0) {
    return <p className="text-ink/60">틀린 문제가 없습니다.</p>;
  }

  return (
    <ul className="divide-y divide-rule border-t border-rule">
      {wrongAnswers.map((w) => (
        <li key={w.questionId} className="py-4">
          <p className="font-mono text-sm text-ink/60">
            {w.questionNumber}번 · {w.subjectName}
          </p>
          <p className="mt-1 line-clamp-2 leading-relaxed">{w.content}</p>

          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="shrink-0 text-ink/60">내 답</dt>
              <dd className={w.selectedChoiceLabel ? "text-incorrect" : "text-ink/60"}>
                {w.selectedChoiceLabel ? `${w.selectedChoiceLabel}. ${w.selectedChoiceContent}` : "안 풀음"}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 text-ink/60">정답</dt>
              <dd className="text-correct">
                {w.correctChoiceLabel}. {w.correctChoiceContent}
              </dd>
            </div>
          </dl>

          <Link
            href={`/questions/${w.questionId}`}
            className="mt-2 inline-block text-sm font-semibold text-focus underline underline-offset-2"
          >
            문제 상세 보기
          </Link>
        </li>
      ))}
    </ul>
  );
}
