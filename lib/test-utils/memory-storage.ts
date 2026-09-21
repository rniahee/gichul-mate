import type { KeyValueStorage } from "../exam-storage";

// 테스트 전용 메모리 저장소. localStorage와 같은 인터페이스(삽입 순서 유지)를 흉내낸다.
export class MemoryStorage implements KeyValueStorage {
  private readonly items = new Map<string, string>();

  get length(): number {
    return this.items.size;
  }

  key(index: number): string | null {
    return Array.from(this.items.keys())[index] ?? null;
  }

  getItem(name: string): string | null {
    return this.items.get(name) ?? null;
  }

  setItem(name: string, value: string): void {
    this.items.set(name, value);
  }

  removeItem(name: string): void {
    this.items.delete(name);
  }
}
