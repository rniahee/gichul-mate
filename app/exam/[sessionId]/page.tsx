import { ExamSession } from "@/components/exam/ExamSession";

export default async function ExamSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;

  return <ExamSession sessionId={sessionId} />;
}
