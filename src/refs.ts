export type ObjectRef = `${string}:${string}`; // "doc:123"
export type UsersetRef = `${string}:${string}#${string}`; // "group:eng#member"
export type SubjectRef = ObjectRef | UsersetRef;

export function obj<TType extends string>(
  type: TType,
  id: string,
): `${TType}:${string}` {
  return `${type}:${id}`;
}

export function user(id: string): `user:${string}` {
  return `user:${id}`;
}

export function userset<TType extends string, TRel extends string>(
  type: TType,
  id: string,
  rel: TRel,
): `${TType}:${string}#${TRel}` {
  return `${type}:${id}#${rel}`;
}

export function isUsersetRef(s: string): s is UsersetRef {
  return s.includes("#");
}

export function parseObjectRef(ref: ObjectRef): { type: string; id: string } {
  const idx = ref.indexOf(":");
  if (idx <= 0) throw new Error(`Invalid object ref: ${ref}`);
  return { type: ref.slice(0, idx), id: ref.slice(idx + 1) };
}

export function parseUsersetRef(ref: UsersetRef): {
  type: string;
  id: string;
  relation: string;
} {
  const hash = ref.indexOf("#");
  const base = ref.slice(0, hash) as ObjectRef;
  const { type, id } = parseObjectRef(base);
  const relation = ref.slice(hash + 1);
  if (!relation) throw new Error(`Invalid userset ref: ${ref}`);
  return { type, id, relation };
}
