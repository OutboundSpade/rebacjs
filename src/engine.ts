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
  type SubjectSetRef,
  type SubjectRef,
} from "./refs";
import type { Rewrite } from "./rewrite";

/**
 * Authorization check input with schema-aware object/relation typing.
 * @example
 * const req: CheckRequest = { subject: "user:alice", object: "doc:1", relation: "viewer" };
 */
export type CheckRequest<TSchema extends SchemaDef = SchemaDef> = {
  subject: SubjectRef;
} & {
  [TEntity in EntityName<TSchema>]: {
    object: ObjectRefFor<TSchema, TEntity>;
    relation: RelationName<TSchema, TEntity>;
  };
}[EntityName<TSchema>];

/**
 * Validation result for check requests.
 * @example
 * const result: CheckValidationResult = { valid: false, errors: ["Unknown relation"] };
 */
export type CheckValidationResult = {
  valid: boolean;
  errors: string[];
};

/**
 * Validates object, subject, and relation references for a check request.
 * @example
 * const result = validateCheckRequest(schema, { subject: "user:alice", object: "doc:1", relation: "viewer" });
 */
export function validateCheckRequest(
  schema: SchemaDef,
  req: { subject: string; object: string; relation: string },
): CheckValidationResult {
  const errors: string[] = [];

  try {
    const { type: objectType } = parseObjectRef(req.object as ObjectRef);
    getRelation(schema, objectType, req.relation);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  try {
    if (isSubjectSetRef(req.subject)) {
      const { type, relation } = parseSubjectSetRef(
        req.subject as SubjectSetRef,
      );
      getRelation(schema, type, relation);
    } else {
      const { type } = parseObjectRef(req.subject as ObjectRef);
      if (!schema.entities[type]) {
        errors.push(`Unknown entity type '${type}'`);
      }
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Execution options for the authorization engine.
 * @example
 * const options: EngineOptions = { maxDepth: 64 };
 */
export type EngineOptions = {
  maxDepth?: number;
};

type MemoKey = string;

/**
 * Core evaluator that resolves direct and derived relation checks.
 * @example
 * const engine = new RebacEngine(schema, store, { maxDepth: 32 });
 */
export class RebacEngine {
  constructor(
    private readonly schema: SchemaDef,
    private readonly store: TupleStore,
    private readonly opts: EngineOptions = {},
  ) {}

  async check(req: CheckRequest): Promise<boolean> {
    const validation = validateCheckRequest(this.schema, req);
    if (!validation.valid) return false;

    try {
      const maxDepth = this.opts.maxDepth ?? 32;
      const memo = new Map<MemoKey, boolean>();
      const visiting = new Set<MemoKey>();

      const checkInner = async (
        subjectRef: SubjectRef,
        objectRef: ObjectRef,
        relation: string,
        depth: number,
      ): Promise<boolean> => {
        if (depth > maxDepth) return false;

        const memoKey = `${subjectRef}|${objectRef}|${relation}`;
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
            subjectRef,
            objectRef,
            relation,
            depth,
            checkInner,
          );
        } else {
          result = await this.evalRewrite(
            relDef.rewrite,
            subjectRef,
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
    } catch {
      return false;
    }
  }

  private async checkDirect(
    subjectRef: SubjectRef,
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
      if (t.subject === subjectRef) return true;

      // If tuple subject is a subject-set like "group:eng#member",
      // then user is related if check(user, "group:eng", "member") is true.
      if (isSubjectSetRef(t.subject)) {
        const { type, id, relation: rel } = parseSubjectSetRef(t.subject);
        const targetObject = `${type}:${id}` as ObjectRef;
        if (await checkInner(subjectRef, targetObject, rel, depth + 1))
          return true;
      }
    }
    return false;
  }

  private async evalRewrite(
    rewrite: Rewrite,
    subjectRef: SubjectRef,
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
        return checkInner(subjectRef, objectRef, rewrite.relation, depth + 1);

      case "followRelation": {
        // For each tuple (objectRef, through, subject = someObjectRef),
        // check(subject, subjectObjectRef, relation)
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
            await checkInner(
              subjectRef,
              targetObject,
              rewrite.relation,
              depth + 1,
            )
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
              subjectRef,
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
              subjectRef,
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
          subjectRef,
          objectRef,
          depth + 1,
          checkInner,
        );
        if (!baseOk) return false;
        for (const sub of rewrite.subtract) {
          if (
            await this.evalRewrite(
              sub,
              subjectRef,
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
