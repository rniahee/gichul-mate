import { QuestionView } from "@/components/QuestionView";

export default async function QuestionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // key={id}: URL을 직접 바꾸거나 히스토리로 이동해서 같은 라우트 안에서
  // id만 바뀌는 경우, Next.js가 컴포넌트를 자동으로 리마운트하지 않아서
  // 이전 문제의 선택값/결과 state가 남을 수 있다. key로 강제 리마운트한다.
  return <QuestionView key={id} questionId={id} />;
}
