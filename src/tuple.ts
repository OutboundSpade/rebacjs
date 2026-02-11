import type { ObjectRef, SubjectRef } from "./refs";

export type Tuple = {
  object: ObjectRef; // "doc:123"
  relation: string; // "viewer"
  subject: SubjectRef; // "user:alice" OR "group:eng#member" OR "folder:root"
};

export type TupleQuery = {
  object?: ObjectRef;
  relation?: string;
  subject?: SubjectRef;
  // room for expansion: prefix scans, objectType, subjectType, etc.
};
