// DevTools의 오프라인 시뮬레이션은 (진짜 네트워크 단절과 달리) 요청을 즉시
// 실패시키지 않고 응답 없이 계속 pending 상태로 둘 수 있다. 그런 경우든
// 실제 서버 장애든, 요청이 무한정 걸려있는 상황 자체를 막기 위해 모든 시험 관련
// 요청에 공통 타임아웃을 둔다.
export const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    // 정상 완료든, HTTP 에러든, abort든 항상 타이머를 정리한다.
    clearTimeout(timeoutId);
  }
}
