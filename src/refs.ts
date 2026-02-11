/**
 * Reference to a concrete object instance.
 * @example
 * const doc = "doc:123" satisfies ObjectRef;
 */
export type ObjectRef = `${string}:${string}`;

/**
 * Reference to a relation on an object (subject set).
 * @example
 * const members = "group:eng#member" satisfies SubjectSetRef;
 */
export type SubjectSetRef = `${string}:${string}#${string}`;

/**
 * Subject used in tuples and checks.
 * @example
 * const subject: SubjectRef = "user:alice";
 */
export type SubjectRef = ObjectRef | SubjectSetRef;

/**
 * Builds an object reference (`type:id`).
 * @example
 * const user = obj("user", "alice"); // "user:alice"
 */
export function obj<TType extends string>(
  type: TType,
  id: string,
): `${TType}:${string}` {
  return `${type}:${id}`;
}

/**
 * Builds a subject-set reference (`type:id#relation`).
 * @example
 * const set = subjectSet("group", "eng", "member"); // "group:eng#member"
 */
export function subjectSet<TType extends string, TRel extends string>(
  type: TType,
  id: string,
  rel: TRel,
): `${TType}:${string}#${TRel}` {
  return `${type}:${id}#${rel}`;
}

/**
 * Returns true when a ref is in subject-set format.
 * @example
 * const isSet = isSubjectSetRef("group:eng#member"); // true
 */
export function isSubjectSetRef(s: string): s is SubjectSetRef {
  return s.includes("#");
}

/**
 * Parses an object ref into `{ type, id }`.
 * @example
 * const parsed = parseObjectRef("doc:123"); // { type: "doc", id: "123" }
 */
export function parseObjectRef(ref: ObjectRef): { type: string; id: string } {
  const idx = ref.indexOf(":");
  if (idx <= 0) throw new Error(`Invalid object ref: ${ref}`);
  return { type: ref.slice(0, idx), id: ref.slice(idx + 1) };
}

/**
 * Parses a subject-set ref into `{ type, id, relation }`.
 * @example
 * const parsed = parseSubjectSetRef("group:eng#member");
 */
export function parseSubjectSetRef(ref: SubjectSetRef): {
  type: string;
  id: string;
  relation: string;
} {
  const hash = ref.indexOf("#");
  const base = ref.slice(0, hash) as ObjectRef;
  const { type, id } = parseObjectRef(base);
  const relation = ref.slice(hash + 1);
  if (!relation) throw new Error(`Invalid subject-set ref: ${ref}`);
  return { type, id, relation };
}
