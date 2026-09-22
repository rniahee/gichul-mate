// CBT 시험 타이머의 순수 계산 로직과 브라우저 타이머 부착.
// 남은 시간은 매번 endsAt(절대 시각)과 현재 시각의 차이로 다시 계산한다.
// 1초씩 빼는 방식을 쓰지 않는 이유: 탭이 백그라운드로 가면 setInterval이 늦게 불려서
// 감소분이 실제 경과 시간보다 적어지기 때문이다.

// 클라이언트 시계가 서버보다 얼마나 빠른지(+)/느린지(-)를 ms로 반환한다.
// 네트워크 왕복 시간(RTT)은 보정하지 않는다 — 150분 시험 기준으로 무시 가능한 오차(수백 ms)라고 보고 감수한다.
export function computeClockOffset(serverNowMs: number, clientNowMs: number): number {
  return serverNowMs - clientNowMs;
}

export function computeEndsAt(startedAtIso: string, durationSeconds: number): number {
  return new Date(startedAtIso).getTime() + durationSeconds * 1000;
}

// offsetMs를 더해 서버 기준 "지금"으로 보정한 뒤 종료 시각과의 차이를 구한다.
export function computeRemainingMs(endsAt: number, clientNowMs: number, offsetMs: number): number {
  return Math.max(0, endsAt - (clientNowMs + offsetMs));
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

// 초 단위는 올림한다. 예: 400ms 남음 → "00:00:01". 실제로 시간이 다 되기 전에
// 화면이 먼저 00:00:00으로 보이는 것을 막기 위해서다.
export function formatRemaining(ms: number): string {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

// document.addEventListener를 흉내낸 최소 인터페이스. 테스트에서 가짜 target을 주입한다.
export interface VisibilityTarget {
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
}

export interface StartExamTimerOptions {
  endsAt: number;
  offsetMs: number;
  onTick: (remainingMs: number) => void;
  // 정확히 한 번만 호출된다. 시작 시점에 이미 만료된 경우에는 호출되지 않는다
  // (합의된 정책: 로드 시 만료는 자동 제출하지 않고, 사용자가 명시적으로 제출 버튼을 누른다).
  onExpire: () => void;
  now?: () => number;
  intervalMs?: number;
  // undefined면 전역 document를 쓴다(있을 때만). null을 넘기면 가시성 재계산을 하지 않는다.
  visibilityTarget?: VisibilityTarget | null;
}

export interface ExamTimerHandle {
  stop: () => void;
  // 타이머를 시작하는 시점에 이미 남은 시간이 0이었는지.
  expiredOnStart: boolean;
}

export function startExamTimer(options: StartExamTimerOptions): ExamTimerHandle {
  const now = options.now ?? Date.now;
  const intervalMs = options.intervalMs ?? 1000;

  const remaining = () => computeRemainingMs(options.endsAt, now(), options.offsetMs);

  let finished = false;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const expiredOnStart = remaining() <= 0;
  finished = expiredOnStart;

  const target =
    options.visibilityTarget === undefined
      ? typeof document !== "undefined"
        ? document
        : null
      : options.visibilityTarget;

  const clearTimerInterval = () => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  const tick = () => {
    if (finished) return;
    const remainingMs = remaining();
    options.onTick(remainingMs);
    if (remainingMs <= 0) {
      finished = true;
      clearTimerInterval();
      options.onExpire();
    }
  };

  if (!expiredOnStart) {
    intervalId = setInterval(tick, intervalMs);
  }

  // 탭이 백그라운드에 있는 동안 setInterval이 지연/중단될 수 있으므로,
  // 다시 보이는 순간 즉시 재계산해서 만료를 놓치지 않는다.
  const handleVisibility = () => tick();
  target?.addEventListener("visibilitychange", handleVisibility);

  const stop = () => {
    finished = true;
    clearTimerInterval();
    target?.removeEventListener("visibilitychange", handleVisibility);
  };

  return { stop, expiredOnStart };
}
