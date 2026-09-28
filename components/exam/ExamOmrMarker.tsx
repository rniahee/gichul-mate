import { OmrMarker } from "@/components/OmrMarker";

// 시험 응시 화면 전용 마커: 정답/오답 상태를 아예 받을 수 없게 타입을 좁힌 래퍼.
// GET /api/exams/[sessionId]가 isCorrect를 응답에서 빼는 것과 별개로,
// UI 레벨에서도 실수로 정답 정보를 넘기지 못하게 이중으로 막는다.
export type ExamMarkerState = "empty" | "selected";

export function ExamOmrMarker({ state }: { state: ExamMarkerState }) {
  return <OmrMarker state={state} />;
}
