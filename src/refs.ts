export type ObjectRef = `${string}:${string}`; // "doc:123"
export type SubjectSetRef = `${string}:${string}#${string}`; // "group:eng#member"
export type SubjectRef = ObjectRef | SubjectSetRef;

export function obj<TType extends string>(
  type: TType,
  id: string,
): `${TType}:${string}` {
  return `${type}:${id}`;
}

export function subjectSet<TType extends string, TRel extends string>(
  type: TType,
  id: string,
  rel: TRel,
): `${TType}:${string}#${TRel}` {
  return `${type}:${id}#${rel}`;
}

export function isSubjectSetRef(s: string): s is SubjectSetRef {
  return s.includes("#");
}

export function parseObjectRef(ref: ObjectRef): { type: string; id: string } {
  const idx = ref.indexOf(":");
  if (idx <= 0) throw new Error(`Invalid object ref: ${ref}`);
  return { type: ref.slice(0, idx), id: ref.slice(idx + 1) };
}

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
