import type { Tuple, TupleQuery } from "./tuple";

/**
 * Pluggable persistence interface for relationship tuples.
 * @example
 * class MyStore implements TupleStore { async write(){} async delete(){} async query(){ return []; } }
 */
export interface TupleStore {
  write(tuples: Tuple[]): Promise<void>;
  delete(tuples: Tuple[]): Promise<void>;
  query(q: TupleQuery): Promise<Tuple[]>;
}
