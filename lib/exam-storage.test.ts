import { describe, expect, it } from "vitest";
import {
  clearExamDraft,
  examStorageKey,
  getDefaultStorage,
  pruneStaleExamDrafts,
  STALE_DRAFT_TTL_MS,
  type KeyValueStorage,
} from "./exam-storage";
import { MemoryStorage } from "./test-utils/memory-storage";

const NOW = 1_800_000_000_000;

function draft(savedAt: unknown): string {
  return JSON.stringify({ state: { draftAnswers: {}, currentIndex: 0, savedAt }, version: 1 });
}

describe("examStorageKey", () => {
  it("세션 ID를 접두어 뒤에 붙인다", () => {
    expect(examStorageKey("abc")).toBe("exam-session-abc");
  });
});

describe("getDefaultStorage", () => {
  it("브라우저가 아닌 환경(node)에서는 null", () => {
    expect(getDefaultStorage()).toBeNull();
  });
});

describe("clearExamDraft", () => {
  it("대상 세션의 키만 지운다", () => {
    const storage = new MemoryStorage();
    storage.setItem(examStorageKey("a"), draft(NOW));
    storage.setItem(examStorageKey("b"), draft(NOW));

    clearExamDraft("a", storage);

    expect(storage.getItem(examStorageKey("a"))).toBeNull();
    expect(storage.getItem(examStorageKey("b"))).not.toBeNull();
  });

  it("저장소가 null이거나 removeItem이 throw해도 예외를 던지지 않는다", () => {
    expect(() => clearExamDraft("a", null)).not.toThrow();

    const throwing: KeyValueStorage = {
      length: 0,
      key: () => null,
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() => clearExamDraft("a", throwing)).not.toThrow();
  });
});

describe("pruneStaleExamDrafts", () => {
  it("TTL보다 오래된 항목만 지우고 지운 개수를 반환한다", () => {
    const storage = new MemoryStorage();
    storage.setItem(examStorageKey("old1"), draft(NOW - STALE_DRAFT_TTL_MS - 1));
    storage.setItem(examStorageKey("old2"), draft(NOW - STALE_DRAFT_TTL_MS * 3));
    storage.setItem(examStorageKey("fresh"), draft(NOW - 1000));

    expect(pruneStaleExamDrafts(storage, NOW)).toBe(2);
    expect(storage.getItem(examStorageKey("old1"))).toBeNull();
    expect(storage.getItem(examStorageKey("old2"))).toBeNull();
    expect(storage.getItem(examStorageKey("fresh"))).not.toBeNull();
  });

  it("경계: 정확히 TTL만큼 지난 항목은 남기고, 1ms 더 지나면 지운다", () => {
    const storage = new MemoryStorage();
    storage.setItem(examStorageKey("exact"), draft(NOW - STALE_DRAFT_TTL_MS));
    storage.setItem(examStorageKey("over"), draft(NOW - STALE_DRAFT_TTL_MS - 1));

    pruneStaleExamDrafts(storage, NOW);

    expect(storage.getItem(examStorageKey("exact"))).not.toBeNull();
    expect(storage.getItem(examStorageKey("over"))).toBeNull();
  });

  it("ttl 인자를 바꿀 수 있다", () => {
    const storage = new MemoryStorage();
    storage.setItem(examStorageKey("a"), draft(NOW - 5000));

    expect(pruneStaleExamDrafts(storage, NOW, 10_000)).toBe(0);
    expect(pruneStaleExamDrafts(storage, NOW, 1000)).toBe(1);
  });

  it("접두어가 다른 키는 오래돼 보여도 건드리지 않는다", () => {
    const storage = new MemoryStorage();
    storage.setItem("other-app-setting", draft(0));
    storage.setItem("exam-old", draft(0));

    expect(pruneStaleExamDrafts(storage, NOW)).toBe(0);
    expect(storage.length).toBe(2);
  });

  it("파싱이 안 되거나 savedAt이 없거나 잘못된 항목은 지우지 않는다", () => {
    const storage = new MemoryStorage();
    storage.setItem(examStorageKey("broken"), "{not json");
    storage.setItem(examStorageKey("no-state"), JSON.stringify({ version: 1 }));
    storage.setItem(examStorageKey("no-saved-at"), JSON.stringify({ state: { draftAnswers: {} }, version: 1 }));
    storage.setItem(examStorageKey("string-saved-at"), draft("0"));
    storage.setItem(examStorageKey("null-json"), "null");

    expect(pruneStaleExamDrafts(storage, NOW)).toBe(0);
    expect(storage.length).toBe(5);
  });

  it("삭제 중 인덱스가 밀려도 대상을 빠뜨리지 않는다(연속된 오래된 항목 여러 개)", () => {
    const storage = new MemoryStorage();
    for (let i = 0; i < 10; i++) {
      storage.setItem(examStorageKey(`old${i}`), draft(0));
    }
    storage.setItem(examStorageKey("fresh"), draft(NOW));

    expect(pruneStaleExamDrafts(storage, NOW)).toBe(10);
    expect(storage.length).toBe(1);
  });

  it("저장소가 null이면 0, 접근 중 throw해도 예외 없이 0", () => {
    expect(pruneStaleExamDrafts(null, NOW)).toBe(0);

    const throwing: KeyValueStorage = {
      get length(): number {
        throw new Error("blocked");
      },
      key: () => null,
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    expect(pruneStaleExamDrafts(throwing, NOW)).toBe(0);
  });
});
