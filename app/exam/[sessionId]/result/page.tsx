import { ExamResult } from "@/components/exam/ExamResult";

export default async function ExamResultPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;

  return <ExamResult sessionId={sessionId} />;
}
