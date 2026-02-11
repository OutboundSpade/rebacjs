import type { ObjectRef, SubjectRef } from "./refs";

/**
 * Stored relationship tuple.
 * @example
 * const t: Tuple = { object: "doc:1", relation: "viewer", subject: "user:alice" };
 */
export type Tuple = {
  object: ObjectRef; // "doc:123"
  relation: string; // "viewer"
  subject: SubjectRef; // "user:alice" OR "group:eng#member" OR "folder:root"
};

/**
 * Query shape supported by tuple stores.
 * @example
 * const q: TupleQuery = { object: "doc:1", relation: "viewer" };
 */
export type TupleQuery = {
  object?: ObjectRef;
  relation?: string;
  subject?: SubjectRef;
  // room for expansion: prefix scans, objectType, subjectType, etc.
};
