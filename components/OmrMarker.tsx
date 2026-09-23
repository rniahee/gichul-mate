// 보기 선택/정오 표시를 나타내는 OMR 마킹 스타일 원형 마커.
// 색만으로 구분하지 않고 ✓/✗ 기호를 함께 써서 색각 이상 사용자도 구분할 수 있게 한다.
export type OmrMarkerState = "empty" | "selected" | "correct" | "incorrect";

interface OmrMarkerProps {
  state: OmrMarkerState;
}

export function OmrMarker({ state }: OmrMarkerProps) {
  return (
    <span
      aria-hidden="true"
      className={
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold " +
        (state === "correct"
          ? "border-correct bg-correct text-paper"
          : state === "incorrect"
            ? "border-incorrect bg-incorrect text-paper"
            : state === "selected"
              ? "border-focus bg-focus"
              : "border-rule")
      }
    >
      {state === "correct" ? "✓" : state === "incorrect" ? "✗" : ""}
    </span>
  );
}
