import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import { examStorageKey, getDefaultStorage, type KeyValueStorage } from "../exam-storage";

// localStorage에 저장하는 부분. 타이머 기준(endsAt)은 서버의 startedAt에서 매번
// 계산하므로 여기에 저장하지 않는다 — 로컬 값이 서버와 어긋날 여지를 없애기 위해서.
export interface ExamDraftState {
  draftAnswers: Record<string, string>; // questionId -> choiceId
  currentIndex: number;
  savedAt: number; // 마지막 변경 시각(ms). pruneStaleExamDrafts가 이 값으로 오래된 세션을 판단한다.
}

export interface ExamStoreState extends ExamDraftState {
  // 제출이 끝난 세션. 메모리에만 있고 저장되지 않는다.
  isFinalized: boolean;
  selectAnswer: (questionId: string, choiceId: string) => void;
  setCurrentIndex: (index: number) => void;
  // 제출 완료(200 또는 409) 후 호출: 이후 변경을 막고 저장된 임시 답안을 지운다.
  finalize: () => void;
}

export interface CreateExamStoreOptions {
  // undefined면 localStorage(사용 가능할 때), null이면 저장 없이 메모리에서만 동작.
  storage?: KeyValueStorage | null;
  now?: () => number;
}

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((v) => typeof v === "string")
  );
}

// 세션마다 별도 스토어(별도 localStorage 키)를 만든다. persist의 name은 생성 시점에
// 고정되기 때문에, 세션별 분리는 스토어 팩토리로 처리한다.
export function createExamStore(sessionId: string, options: CreateExamStoreOptions = {}) {
  const storage = options.storage === undefined ? getDefaultStorage() : options.storage;
  const now = options.now ?? Date.now;

  return createStore<ExamStoreState>()(
    persist(
      (set, get, api) => ({
        draftAnswers: {},
        currentIndex: 0,
        savedAt: now(),
        isFinalized: false,

        selectAnswer: (questionId, choiceId) => {
          const state = get();
          if (state.isFinalized || state.draftAnswers[questionId] === choiceId) return;
          set({ draftAnswers: { ...state.draftAnswers, [questionId]: choiceId }, savedAt: now() });
        },

        setCurrentIndex: (index) => {
          const state = get();
          if (state.isFinalized || state.currentIndex === index) return;
          set({ currentIndex: index, savedAt: now() });
        },

        // persist는 상태가 바뀔 때마다 다시 쓰므로, 먼저 잠근 뒤(이 set 자체가 한 번
        // 저장을 일으킨다) 저장소를 비운다. 이후 변경 액션은 isFinalized로 막힌다.
        finalize: () => {
          set({ isFinalized: true });
          api.persist.clearStorage();
        },
      }),
      {
        name: examStorageKey(sessionId),
        version: 1,
        storage: createJSONStorage<ExamDraftState>(() => storage ?? noopStorage),
        partialize: (state): ExamDraftState => ({
          draftAnswers: state.draftAnswers,
          currentIndex: state.currentIndex,
          savedAt: state.savedAt,
        }),
        // localStorage 값은 신뢰할 수 없는 입력이라(수동 편집, 오래된 형식), 모양이
        // 맞는 필드만 복원하고 나머지는 초기값을 쓴다. currentIndex가 문제 수 범위 안인지는
        // 문제 수를 아는 화면(2단계-E)에서 보정한다.
        merge: (persisted, current) => {
          const p = (persisted ?? {}) as Partial<Record<keyof ExamDraftState, unknown>>;
          return {
            ...current,
            draftAnswers: isStringRecord(p.draftAnswers) ? p.draftAnswers : current.draftAnswers,
            currentIndex:
              typeof p.currentIndex === "number" && Number.isInteger(p.currentIndex) && p.currentIndex >= 0
                ? p.currentIndex
                : current.currentIndex,
            savedAt: typeof p.savedAt === "number" && Number.isFinite(p.savedAt) ? p.savedAt : current.savedAt,
          };
        },
      },
    ),
  );
}

export type ExamStoreApi = ReturnType<typeof createExamStore>;
