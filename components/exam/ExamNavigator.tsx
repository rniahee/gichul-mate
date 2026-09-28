import type { QuestionDetail } from "@/types/question";

interface ExamNavigatorProps {
  // 세션에 배정된 순서 그대로(questionIds 순서 = 화면 번호 순서).
  questions: QuestionDetail[];
  draftAnswers: Record<string, string>;
  currentIndex: number;
  onSelect: (index: number) => void;
}

interface NavigatorGroup {
  subjectName: string;
  items: { question: QuestionDetail; index: number }[];
}

// 문제를 과목 경계로 묶는다(FULL_100에서 20개씩 5과목). 이미 questionIds가
// 과목별로 붙어서 들어오므로 연속된 같은 subjectName만 하나의 그룹으로 합치면 된다.
function groupBySubject(questions: QuestionDetail[]): NavigatorGroup[] {
  const groups: NavigatorGroup[] = [];
  questions.forEach((question, index) => {
    const last = groups[groups.length - 1];
    if (last && last.subjectName === question.subjectName) {
      last.items.push({ question, index });
    } else {
      groups.push({ subjectName: question.subjectName, items: [{ question, index }] });
    }
  });
  return groups;
}

export function ExamNavigator({ questions, draftAnswers, currentIndex, onSelect }: ExamNavigatorProps) {
  const groups = groupBySubject(questions);
  // SUBJECT_20처럼 과목이 하나뿐이면, 이미 상단 헤더에 과목명이 있어서 또 안 보여준다.
  const showSubjectHeaders = groups.length > 1;

  return (
    <nav aria-label="문제 번호" className="space-y-4">
      {groups.map((group) => (
        <div key={group.subjectName + group.items[0].index}>
          {showSubjectHeaders && <p className="mb-2 text-xs font-semibold text-ink/50">{group.subjectName}</p>}
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-4">
            {group.items.map(({ question, index }) => {
              const isAnswered = Boolean(draftAnswers[question.id]);
              const isCurrent = index === currentIndex;
              return (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => onSelect(index)}
                  aria-current={isCurrent ? "true" : undefined}
                  aria-label={`${index + 1}번 문제, ${isAnswered ? "풀었음" : "안 풀음"}`}
                  className={
                    "relative flex h-9 w-9 items-center justify-center border font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-paper " +
                    (isAnswered ? "border-focus" : "border-rule") +
                    (isCurrent ? " ring-2 ring-focus ring-offset-1 ring-offset-paper" : "")
                  }
                >
                  <span aria-hidden="true">{index + 1}</span>
                  {isAnswered && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-focus text-[9px] text-paper"
                    >
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
