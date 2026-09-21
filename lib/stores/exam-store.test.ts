import { describe, expect, it } from "vitest";
import { examStorageKey, pruneStaleExamDrafts, STALE_DRAFT_TTL_MS } from "../exam-storage";
import { MemoryStorage } from "../test-utils/memory-storage";
import { createExamStore } from "./exam-store";

function clock(start: number) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

function storedState(storage: MemoryStorage, sessionId: string) {
  const raw = storage.getItem(examStorageKey(sessionId));
  return raw === null ? null : (JSON.parse(raw) as { state: Record<string, unknown>; version: number });
}

describe("createExamStore: 기본 동작", () => {
  it("초기 상태는 빈 답안, 0번 문제, 미제출", () => {
    const store = createExamStore("s1", { storage: new MemoryStorage(), now: () => 1000 });
    const s = store.getState();

    expect(s.draftAnswers).toEqual({});
    expect(s.currentIndex).toBe(0);
    expect(s.savedAt).toBe(1000);
    expect(s.isFinalized).toBe(false);
  });

  it("답안 선택 및 같은 문제 덮어쓰기", () => {
    const store = createExamStore("s1", { storage: new MemoryStorage() });

    store.getState().selectAnswer("q1", "c1");
    store.getState().selectAnswer("q2", "c5");
    store.getState().selectAnswer("q1", "c2");

    expect(store.getState().draftAnswers).toEqual({ q1: "c2", q2: "c5" });
  });

  it("setCurrentIndex", () => {
    const store = createExamStore("s1", { storage: new MemoryStorage() });
    store.getState().setCurrentIndex(7);
    expect(store.getState().currentIndex).toBe(7);
  });

  it("변경 시 savedAt이 갱신되고, 값이 그대로면 갱신하지 않는다", () => {
    const c = clock(1000);
    const store = createExamStore("s1", { storage: new MemoryStorage(), now: c.now });

    c.advance(500);
    store.getState().selectAnswer("q1", "c1");
    expect(store.getState().savedAt).toBe(1500);

    c.advance(500);
    store.getState().selectAnswer("q1", "c1"); // 같은 값
    expect(store.getState().savedAt).toBe(1500);

    store.getState().setCurrentIndex(0); // 이미 0
    expect(store.getState().savedAt).toBe(1500);

    store.getState().setCurrentIndex(3);
    expect(store.getState().savedAt).toBe(2000);
  });
});

describe("createExamStore: 저장과 복원", () => {
  it("저장되는 필드는 draftAnswers/currentIndex/savedAt뿐이다(isFinalized, 함수 제외)", () => {
    const storage = new MemoryStorage();
    const store = createExamStore("s1", { storage, now: () => 42 });
    store.getState().selectAnswer("q1", "c1");

    const stored = storedState(storage, "s1");
    expect(stored?.version).toBe(1);
    expect(Object.keys(stored?.state ?? {}).sort()).toEqual(["currentIndex", "draftAnswers", "savedAt"]);
  });

  it("같은 저장소로 새 스토어를 만들면 답안과 위치가 복원된다", () => {
    const storage = new MemoryStorage();
    const first = createExamStore("s1", { storage });
    first.getState().selectAnswer("q1", "c1");
    first.getState().selectAnswer("q2", "c6");
    first.getState().setCurrentIndex(4);

    const second = createExamStore("s1", { storage });
    expect(second.getState().draftAnswers).toEqual({ q1: "c1", q2: "c6" });
    expect(second.getState().currentIndex).toBe(4);
    expect(second.getState().isFinalized).toBe(false);
  });

  it("세션별로 저장이 분리된다", () => {
    const storage = new MemoryStorage();
    const a = createExamStore("a", { storage });
    const b = createExamStore("b", { storage });

    a.getState().selectAnswer("q1", "c1");
    b.getState().selectAnswer("q1", "c9");

    expect(createExamStore("a", { storage }).getState().draftAnswers).toEqual({ q1: "c1" });
    expect(createExamStore("b", { storage }).getState().draftAnswers).toEqual({ q1: "c9" });
  });

  it("깨진 JSON이 저장돼 있으면 초기 상태로 시작하고 예외를 던지지 않는다", () => {
    const storage = new MemoryStorage();
    storage.setItem(examStorageKey("s1"), "{not json");

    const store = createExamStore("s1", { storage, now: () => 1000 });
    expect(store.getState().draftAnswers).toEqual({});
    expect(store.getState().currentIndex).toBe(0);
  });

  it("필드 모양이 잘못된 값은 해당 필드만 초기값으로 대체한다", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      examStorageKey("s1"),
      JSON.stringify({
        state: { draftAnswers: { q1: 123 }, currentIndex: -3, savedAt: "yesterday" },
        version: 1,
      }),
    );

    const store = createExamStore("s1", { storage, now: () => 1000 });
    expect(store.getState().draftAnswers).toEqual({});
    expect(store.getState().currentIndex).toBe(0);
    expect(store.getState().savedAt).toBe(1000);
  });

  it("일부 필드만 정상이면 정상인 필드는 복원한다", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      examStorageKey("s1"),
      JSON.stringify({ state: { draftAnswers: { q1: "c1" }, currentIndex: 1.5, savedAt: 500 }, version: 1 }),
    );

    const store = createExamStore("s1", { storage, now: () => 1000 });
    expect(store.getState().draftAnswers).toEqual({ q1: "c1" });
    expect(store.getState().currentIndex).toBe(0); // 정수가 아님
    expect(store.getState().savedAt).toBe(500);
  });

  it("draftAnswers가 배열이거나 null이어도 무시한다", () => {
    for (const bad of [["c1"], null, "x", 5]) {
      const storage = new MemoryStorage();
      storage.setItem(examStorageKey("s1"), JSON.stringify({ state: { draftAnswers: bad }, version: 1 }));
      expect(createExamStore("s1", { storage }).getState().draftAnswers).toEqual({});
    }
  });
});

describe("finalize", () => {
  it("저장된 임시 답안을 지우고 이후 변경을 막는다", () => {
    const storage = new MemoryStorage();
    const store = createExamStore("s1", { storage });
    store.getState().selectAnswer("q1", "c1");
    expect(storage.getItem(examStorageKey("s1"))).not.toBeNull();

    store.getState().finalize();
    expect(storage.getItem(examStorageKey("s1"))).toBeNull();
    expect(store.getState().isFinalized).toBe(true);

    store.getState().selectAnswer("q2", "c2");
    store.getState().setCurrentIndex(9);

    expect(store.getState().draftAnswers).toEqual({ q1: "c1" });
    expect(store.getState().currentIndex).toBe(0);
    expect(storage.getItem(examStorageKey("s1"))).toBeNull(); // 다시 쓰이지 않음
  });

  it("다른 세션의 임시 답안은 건드리지 않는다", () => {
    const storage = new MemoryStorage();
    const a = createExamStore("a", { storage });
    const b = createExamStore("b", { storage });
    a.getState().selectAnswer("q1", "c1");
    b.getState().selectAnswer("q1", "c1");

    a.getState().finalize();

    expect(storage.getItem(examStorageKey("a"))).toBeNull();
    expect(storage.getItem(examStorageKey("b"))).not.toBeNull();
  });

  it("두 번 호출해도 안전하다", () => {
    const storage = new MemoryStorage();
    const store = createExamStore("s1", { storage });
    store.getState().finalize();
    expect(() => store.getState().finalize()).not.toThrow();
    expect(storage.getItem(examStorageKey("s1"))).toBeNull();
  });
});

describe("저장소 없음(null)", () => {
  it("메모리에서만 동작한다", () => {
    const store = createExamStore("s1", { storage: null });
    store.getState().selectAnswer("q1", "c1");
    store.getState().setCurrentIndex(2);
    expect(store.getState().draftAnswers).toEqual({ q1: "c1" });
    expect(store.getState().currentIndex).toBe(2);

    expect(() => store.getState().finalize()).not.toThrow();
    expect(store.getState().isFinalized).toBe(true);
  });

  it("node 환경에서 storage 옵션을 생략해도(localStorage 없음) 동작한다", () => {
    const store = createExamStore("s1");
    store.getState().selectAnswer("q1", "c1");
    expect(store.getState().draftAnswers).toEqual({ q1: "c1" });
  });
});

describe("스토어가 저장한 값과 pruneStaleExamDrafts의 연동", () => {
  it("실제로 저장된 savedAt으로 오래된 세션만 정리된다", () => {
    const storage = new MemoryStorage();
    const c = clock(1_000_000);

    const old = createExamStore("old", { storage, now: c.now });
    old.getState().selectAnswer("q1", "c1");

    c.advance(STALE_DRAFT_TTL_MS + 1);

    const fresh = createExamStore("fresh", { storage, now: c.now });
    fresh.getState().selectAnswer("q1", "c1");

    expect(pruneStaleExamDrafts(storage, c.now())).toBe(1);
    expect(storage.getItem(examStorageKey("old"))).toBeNull();
    expect(storage.getItem(examStorageKey("fresh"))).not.toBeNull();
  });
});
