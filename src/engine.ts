import type {
  EntityName,
  ObjectRefFor,
  RelationName,
  SchemaDef,
} from "./schema";
import { getRelation } from "./schema";
import type { TupleStore } from "./storage";
import {
  isSubjectSetRef,
  parseObjectRef,
  parseSubjectSetRef,
  type ObjectRef,
  type SubjectRef,
} from "./refs";
import type { Rewrite } from "./rewrite";

export type CheckRequest<TSchema extends SchemaDef = SchemaDef> = {
  subject: SubjectRef;
} & {
  [TEntity in EntityName<TSchema>]: {
    object: ObjectRefFor<TSchema, TEntity>;
    relation: RelationName<TSchema, TEntity>;
  };
}[EntityName<TSchema>];

export type EngineOptions = {
  maxDepth?: number;
};

type MemoKey = string;

export class RebacEngine {
  constructor(
    private readonly schema: SchemaDef,
    private readonly store: TupleStore,
    private readonly opts: EngineOptions = {},
  ) {}

  async check(req: CheckRequest): Promise<boolean> {
    const maxDepth = this.opts.maxDepth ?? 32;
    const memo = new Map<MemoKey, boolean>();
    const visiting = new Set<MemoKey>();

    const checkInner = async (
      userRef: SubjectRef,
      objectRef: ObjectRef,
      relation: string,
      depth: number,
    ): Promise<boolean> => {
      if (depth > maxDepth) return false;

      const memoKey = `${userRef}|${objectRef}|${relation}`;
      if (memo.has(memoKey)) return memo.get(memoKey)!;
      if (visiting.has(memoKey)) {
        // cycle detected; treat as false (or you could throw)
        return false;
      }

      visiting.add(memoKey);

      const { type: objType } = parseObjectRef(objectRef);
      const relDef = getRelation(this.schema, objType, relation);

      let result = false;

      if (relDef.kind === "direct") {
        result = await this.checkDirect(
          userRef,
          objectRef,
          relation,
          depth,
          checkInner,
        );
      } else {
        result = await this.evalRewrite(
          relDef.rewrite,
          userRef,
          objectRef,
          depth,
          checkInner,
        );
      }

      visiting.delete(memoKey);
      memo.set(memoKey, result);
      return result;
    };

    return checkInner(req.subject, req.object, req.relation, 0);
  }

  private async checkDirect(
    userRef: SubjectRef,
    objectRef: ObjectRef,
    relation: string,
    depth: number,
    checkInner: (
      u: SubjectRef,
      o: ObjectRef,
      r: string,
      d: number,
    ) => Promise<boolean>,
  ): Promise<boolean> {
    const tuples = await this.store.query({ object: objectRef, relation });

    for (const t of tuples) {
      if (t.subject === userRef) return true;

      // If tuple subject is a subject-set like "group:eng#member",
      // then user is related if check(user, "group:eng", "member") is true.
      if (isSubjectSetRef(t.subject)) {
        const { type, id, relation: rel } = parseSubjectSetRef(t.subject);
        const targetObject = `${type}:${id}` as ObjectRef;
        if (await checkInner(userRef, targetObject, rel, depth + 1))
          return true;
      }
    }
    return false;
  }

  private async evalRewrite(
    rewrite: Rewrite,
    userRef: SubjectRef,
    objectRef: ObjectRef,
    depth: number,
    checkInner: (
      u: SubjectRef,
      o: ObjectRef,
      r: string,
      d: number,
    ) => Promise<boolean>,
  ): Promise<boolean> {
    switch (rewrite.op) {
      case "sameObjectRelation":
        return checkInner(userRef, objectRef, rewrite.relation, depth + 1);

      case "followRelation": {
        // For each tuple (objectRef, through, subject = someObjectRef),
        // check(user, subjectObjectRef, relation)
        const tuples = await this.store.query({
          object: objectRef,
          relation: rewrite.through,
        });
        for (const t of tuples) {
          if (isSubjectSetRef(t.subject)) {
            // Relation-following normally expects object refs as subjects.
            // You can decide to allow subject sets, but v0 keeps it strict.
            continue;
          }
          const targetObject = t.subject as ObjectRef;
          if (
            await checkInner(userRef, targetObject, rewrite.relation, depth + 1)
          )
            return true;
        }
        return false;
      }

      case "union": {
        for (const child of rewrite.children) {
          if (
            await this.evalRewrite(
              child,
              userRef,
              objectRef,
              depth + 1,
              checkInner,
            )
          )
            return true;
        }
        return false;
      }

      case "intersection": {
        for (const child of rewrite.children) {
          if (
            !(await this.evalRewrite(
              child,
              userRef,
              objectRef,
              depth + 1,
              checkInner,
            ))
          )
            return false;
        }
        return true;
      }

      case "difference": {
        const baseOk = await this.evalRewrite(
          rewrite.base,
          userRef,
          objectRef,
          depth + 1,
          checkInner,
        );
        if (!baseOk) return false;
        for (const sub of rewrite.subtract) {
          if (
            await this.evalRewrite(
              sub,
              userRef,
              objectRef,
              depth + 1,
              checkInner,
            )
          )
            return false;
        }
        return true;
      }
    }
  }
}
