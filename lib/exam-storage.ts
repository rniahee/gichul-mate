// CBT 모의고사 임시 답안의 localStorage 키 규칙과 정리 로직.
// 세션별로 키를 분리(exam-session-{sessionId})해서, 시험 A를 풀다가 시험 B를
// 시작해도 서로의 답안이 섞이거나 덮어써지지 않게 한다.

export const EXAM_STORAGE_PREFIX = "exam-session-";

// 시험은 최대 150분이라, 하루 동안 아무 변경이 없으면 버려진 세션으로 본다.
export const STALE_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

// window.localStorage(Storage)의 부분집합. 테스트에서 가짜 저장소를 주입하려고 분리했다.
export interface KeyValueStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(name: string): string | null;
  setItem(name: string, value: string): void;
  removeItem(name: string): void;
}

export function examStorageKey(sessionId: string): string {
  return `${EXAM_STORAGE_PREFIX}${sessionId}`;
}

// SSR이거나, 프라이버시 모드 등으로 localStorage 접근이 막힌 경우엔 null.
export function getDefaultStorage(): KeyValueStorage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

// zustand persist가 저장하는 { state, version } 구조에서 state.savedAt만 읽는다.
function readSavedAt(raw: string | null): number | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    const savedAt = (parsed as { state?: { savedAt?: unknown } } | null)?.state?.savedAt;
    return typeof savedAt === "number" && Number.isFinite(savedAt) ? savedAt : null;
  } catch {
    return null;
  }
}

// 제출이 끝난 세션의 임시 답안을 지운다.
export function clearExamDraft(sessionId: string, storage: KeyValueStorage | null = getDefaultStorage()): void {
  try {
    storage?.removeItem(examStorageKey(sessionId));
  } catch {
    // 저장소를 쓸 수 없으면 지울 것도 없다.
  }
}

// savedAt이 ttlMs보다 오래된 세션 임시 답안을 지우고, 지운 개수를 반환한다.
// 파싱이 안 되거나 savedAt이 없는 항목, 접두어가 다른 키는 이해할 수 없는 데이터라 건드리지 않는다.
export function pruneStaleExamDrafts(
  storage: KeyValueStorage | null = getDefaultStorage(),
  now: number = Date.now(),
  ttlMs: number = STALE_DRAFT_TTL_MS,
): number {
  if (!storage) return 0;

  try {
    // 삭제하면 인덱스가 밀리므로, 대상 키를 먼저 모은 뒤에 지운다.
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key !== null && key.startsWith(EXAM_STORAGE_PREFIX)) {
        keys.push(key);
      }
    }

    let removed = 0;
    for (const key of keys) {
      const savedAt = readSavedAt(storage.getItem(key));
      if (savedAt !== null && now - savedAt > ttlMs) {
        storage.removeItem(key);
        removed++;
      }
    }
    return removed;
  } catch {
    return 0;
  }
}
