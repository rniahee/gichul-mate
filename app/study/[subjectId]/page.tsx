import { StudySession } from "@/components/StudySession";

export default async function StudyPage({ params }: { params: Promise<{ subjectId: string }> }) {
  const { subjectId } = await params;

  return <StudySession subjectId={subjectId} />;
}
