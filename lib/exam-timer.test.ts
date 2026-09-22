import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeClockOffset,
  computeEndsAt,
  computeRemainingMs,
  formatRemaining,
  startExamTimer,
  type VisibilityTarget,
} from "./exam-timer";

describe("computeClockOffset", () => {
  it("클라이언트 시계가 빠른 경우 음수", () => {
    expect(computeClockOffset(1000, 1200)).toBe(-200);
  });

  it("클라이언트 시계가 느린 경우 양수", () => {
    expect(computeClockOffset(1200, 1000)).toBe(200);
  });

  it("차이가 없으면 0", () => {
    expect(computeClockOffset(1000, 1000)).toBe(0);
  });
});

describe("computeEndsAt", () => {
  it("시작 시각 + 소요 시간(초)", () => {
    const startedAt = new Date("2026-01-01T00:00:00.000Z").toISOString();
    expect(computeEndsAt(startedAt, 90 * 60)).toBe(new Date("2026-01-01T01:30:00.000Z").getTime());
  });
});

describe("computeRemainingMs", () => {
  it("오프셋 없이 남은 시간을 계산한다", () => {
    expect(computeRemainingMs(10_000, 3_000, 0)).toBe(7_000);
  });

  it("클라이언트 시계가 빠르면(오프셋 음수) 보정해서 더 적게 남는다", () => {
    // 서버 기준 지금 = clientNow + offsetMs
    expect(computeRemainingMs(10_000, 9_000, -500)).toBe(1_500);
  });

  it("클라이언트 시계가 느리면(오프셋 양수) 보정해서 더 적게 남는다", () => {
    expect(computeRemainingMs(10_000, 9_000, 500)).toBe(500);
  });

  it("0 아래로 내려가지 않는다", () => {
    expect(computeRemainingMs(1_000, 5_000, 0)).toBe(0);
  });
});

describe("formatRemaining", () => {
  it("HH:MM:SS 형식", () => {
    expect(formatRemaining(150 * 60 * 1000)).toBe("02:30:00");
    expect(formatRemaining(1000)).toBe("00:00:01");
    expect(formatRemaining(61_000)).toBe("00:01:01");
  });

  it("0 이하는 00:00:00", () => {
    expect(formatRemaining(0)).toBe("00:00:00");
    expect(formatRemaining(-500)).toBe("00:00:00");
  });

  it("초 단위는 올림한다(0.4초 남음 → 1초로 표시)", () => {
    expect(formatRemaining(400)).toBe("00:00:01");
    expect(formatRemaining(1_400)).toBe("00:00:02");
  });

  it("정확히 초 단위로 떨어지면 그대로", () => {
    expect(formatRemaining(2_000)).toBe("00:00:02");
  });
});

class FakeVisibilityTarget implements VisibilityTarget {
  private listeners: (() => void)[] = [];

  addEventListener(_type: "visibilitychange", listener: () => void): void {
    this.listeners.push(listener);
  }

  removeEventListener(_type: "visibilitychange", listener: () => void): void {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  fire(): void {
    for (const l of this.listeners) l();
  }

  get listenerCount(): number {
    return this.listeners.length;
  }
}

describe("startExamTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("1초 간격으로 onTick을 호출한다", () => {
    const onTick = vi.fn();
    const onExpire = vi.fn();
    const start = Date.now();

    startExamTimer({
      endsAt: start + 5_000,
      offsetMs: 0,
      onTick,
      onExpire,
      visibilityTarget: null,
    });

    vi.advanceTimersByTime(1000);
    expect(onTick).toHaveBeenCalledTimes(1);
    expect(onTick).toHaveBeenLastCalledWith(4_000);

    vi.advanceTimersByTime(2000);
    expect(onTick).toHaveBeenCalledTimes(3);
    expect(onTick).toHaveBeenLastCalledWith(2_000);
  });

  it("만료되면 onExpire를 정확히 한 번 호출하고, 이후 tick이 이어져도 재호출하지 않는다", () => {
    const onTick = vi.fn();
    const onExpire = vi.fn();
    const start = Date.now();

    startExamTimer({
      endsAt: start + 2_000,
      offsetMs: 0,
      onTick,
      onExpire,
      visibilityTarget: null,
    });

    vi.advanceTimersByTime(2000);
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(onTick).toHaveBeenLastCalledWith(0);

    vi.advanceTimersByTime(5000); // 만료 후에도 시간이 흐름
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("시작 시점에 이미 만료돼 있으면 expiredOnStart=true이고 onExpire는 호출되지 않는다", () => {
    const onTick = vi.fn();
    const onExpire = vi.fn();
    const start = Date.now();

    const handle = startExamTimer({
      endsAt: start - 1,
      offsetMs: 0,
      onTick,
      onExpire,
      visibilityTarget: null,
    });

    expect(handle.expiredOnStart).toBe(true);
    vi.advanceTimersByTime(5000);
    expect(onExpire).not.toHaveBeenCalled();
    expect(onTick).not.toHaveBeenCalled();
  });

  it("stop() 이후에는 onTick/onExpire가 더 이상 호출되지 않는다", () => {
    const onTick = vi.fn();
    const onExpire = vi.fn();
    const start = Date.now();

    const handle = startExamTimer({
      endsAt: start + 2_000,
      offsetMs: 0,
      onTick,
      onExpire,
      visibilityTarget: null,
    });

    vi.advanceTimersByTime(1000);
    handle.stop();
    vi.advanceTimersByTime(5000);

    expect(onTick).toHaveBeenCalledTimes(1);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("stop()을 여러 번 불러도 안전하다", () => {
    const handle = startExamTimer({
      endsAt: Date.now() + 1000,
      offsetMs: 0,
      onTick: vi.fn(),
      onExpire: vi.fn(),
      visibilityTarget: null,
    });
    expect(() => {
      handle.stop();
      handle.stop();
    }).not.toThrow();
  });

  it("visibilitychange 시 즉시 재계산한다(탭이 절전 후 돌아와 시계가 점프한 상황)", () => {
    const onTick = vi.fn();
    const onExpire = vi.fn();
    const target = new FakeVisibilityTarget();
    const start = Date.now();
    let current = start;

    startExamTimer({
      endsAt: start + 5_000,
      offsetMs: 0,
      onTick,
      onExpire,
      now: () => current,
      visibilityTarget: target,
    });

    // 인터벌이 못 불린 채로 시계가 크게 점프한 상황을 흉내낸다.
    current = start + 10_000;
    target.fire();

    expect(onTick).toHaveBeenCalledWith(0);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("visibilityTarget이 null이면 리스너를 등록하지 않는다", () => {
    const target = new FakeVisibilityTarget();
    startExamTimer({
      endsAt: Date.now() + 1000,
      offsetMs: 0,
      onTick: vi.fn(),
      onExpire: vi.fn(),
      visibilityTarget: null,
    });
    expect(target.listenerCount).toBe(0);
  });

  it("stop() 시 visibilitychange 리스너를 제거한다", () => {
    const target = new FakeVisibilityTarget();
    const handle = startExamTimer({
      endsAt: Date.now() + 5000,
      offsetMs: 0,
      onTick: vi.fn(),
      onExpire: vi.fn(),
      visibilityTarget: target,
    });

    expect(target.listenerCount).toBe(1);
    handle.stop();
    expect(target.listenerCount).toBe(0);
  });

  it("offsetMs를 반영해서 tick과 만료 시점이 앞당겨진다", () => {
    const onTick = vi.fn();
    const onExpire = vi.fn();
    const start = Date.now();

    // 서버 시계가 1초 빠름(클라이언트가 느림) → offsetMs = +1000
    startExamTimer({
      endsAt: start + 2_000,
      offsetMs: 1000,
      onTick,
      onExpire,
      visibilityTarget: null,
    });

    vi.advanceTimersByTime(1000);
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(onTick).toHaveBeenLastCalledWith(0);
  });
});
