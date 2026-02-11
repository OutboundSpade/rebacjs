import type { Tuple, TupleQuery } from "./tuple";

export interface TupleStore {
  write(tuples: Tuple[]): Promise<void>;
  delete(tuples: Tuple[]): Promise<void>;
  query(q: TupleQuery): Promise<Tuple[]>;
}
