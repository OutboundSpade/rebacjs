import type { Tuple, TupleQuery } from "../tuple";
import type { TupleStore } from "../storage";

function keyOR(object: string, relation: string) {
  return `${object}|${relation}`;
}

/**
 * In-memory tuple store for tests, demos, and local development.
 * @example
 * const store = new MemoryTupleStore();
 */
export class MemoryTupleStore implements TupleStore {
  // index: (object, relation) -> tuples
  private byOR = new Map<string, Tuple[]>();

  async write(tuples: Tuple[]): Promise<void> {
    for (const t of tuples) {
      const k = keyOR(t.object, t.relation);
      const arr = this.byOR.get(k) ?? [];
      // naive dedupe
      if (!arr.some((x) => x.subject === t.subject)) {
        arr.push({ ...t });
      }
      this.byOR.set(k, arr);
    }
  }

  async delete(tuples: Tuple[]): Promise<void> {
    for (const t of tuples) {
      const k = keyOR(t.object, t.relation);
      const arr = this.byOR.get(k);
      if (!arr) continue;
      const next = arr.filter((x) => x.subject !== t.subject);
      if (next.length === 0) this.byOR.delete(k);
      else this.byOR.set(k, next);
    }
  }

  async query(q: TupleQuery): Promise<Tuple[]> {
    // Fast path: object+relation query (most checks).
    if (q.object && q.relation) {
      const arr = this.byOR.get(keyOR(q.object, q.relation)) ?? [];
      if (q.subject)
        return arr
          .filter((t) => t.subject === q.subject)
          .map((t) => ({ ...t }));
      return arr.map((t) => ({ ...t }));
    }

    // Slow path scan (still fine for a memory backend)
    const out: Tuple[] = [];
    for (const arr of this.byOR.values()) {
      for (const t of arr) {
        if (q.object && t.object !== q.object) continue;
        if (q.relation && t.relation !== q.relation) continue;
        if (q.subject && t.subject !== q.subject) continue;
        out.push({ ...t });
      }
    }
    return out;
  }
}
