import type {
  EntityName,
  ObjectRefFor,
  RelationName,
  SchemaDef,
} from "./schema";
import { getRelation } from "./schema";
import type { Tuple } from "./tuple";
import type { TupleStore } from "./storage";
import {
  parseObjectRef,
  isSubjectSetRef,
  parseSubjectSetRef,
  parseObjectRef as parseObj,
  type SubjectRef,
} from "./refs";
import {
  RebacEngine,
  type CheckRequest,
  validateCheckRequest,
  type CheckValidationResult,
} from "./engine";

/**
 * Tuple shape accepted by `RebacClient.write`, constrained by schema types.
 * @example
 * const tuple: WriteTuple = { object: "doc:1", relation: "viewer", subject: "user:alice" };
 */
export type WriteTuple<TSchema extends SchemaDef = SchemaDef> = {
  subject: SubjectRef;
} & {
  [TEntity in EntityName<TSchema>]: {
    object: ObjectRefFor<TSchema, TEntity>;
    relation: RelationName<TSchema, TEntity>;
  };
}[EntityName<TSchema>];

/**
 * High-level API for writing tuples and evaluating authorization checks.
 * @example
 * const rebac = new RebacClient({ schema, store: new MemoryTupleStore() });
 */
export class RebacClient<TSchema extends SchemaDef = SchemaDef> {
  private engine: RebacEngine;

  constructor(
    private readonly cfg: {
      schema: TSchema;
      store: TupleStore;
      options?: { maxDepth?: number };
    },
  ) {
    this.engine = new RebacEngine(cfg.schema, cfg.store, cfg.options);
  }

  /**
   * Evaluates whether a subject has a relation on an object.
   * @example
   * const ok = await rebac.check({ subject: "user:alice", object: "doc:1", relation: "viewer" });
   */
  async check(req: CheckRequest<TSchema>): Promise<boolean> {
    return this.engine.check(req);
  }

  /**
   * Validates a check request and returns explicit errors.
   * @example
   * const v = rebac.validateCheck({ subject: "user:alice", object: "doc:1", relation: "viewer" });
   */
  validateCheck(req: {
    subject: string;
    object: string;
    relation: string;
  }): CheckValidationResult {
    return validateCheckRequest(this.cfg.schema, req);
  }

  /**
   * Writes direct relation tuples after schema validation.
   * @example
   * await rebac.write([{ object: "doc:1", relation: "viewer", subject: "user:alice" }]);
   */
  async write(tuples: WriteTuple<TSchema>[]): Promise<void> {
    this.validateTuples(tuples as Tuple[]);
    await this.cfg.store.write(tuples as Tuple[]);
  }

  /**
   * Deletes tuples from the underlying store.
   * @example
   * await rebac.delete([{ object: "doc:1", relation: "viewer", subject: "user:alice" }]);
   */
  async delete(tuples: Tuple[]): Promise<void> {
    await this.cfg.store.delete(tuples);
  }

  private validateTuples(tuples: Tuple[]) {
    for (const t of tuples) {
      const { type: objType } = parseObjectRef(t.object);
      const relDef = getRelation(this.cfg.schema, objType, t.relation);

      if (relDef.kind !== "direct") {
        throw new Error(
          `Cannot write tuple for derived relation '${objType}.${t.relation}'. Only direct relations are stored.`,
        );
      }

      // Validate subject type against allowed list (best-effort)
      if (isSubjectSetRef(t.subject)) {
        const { type: st, relation: sr } = parseSubjectSetRef(t.subject);
        const token = `${st}#${sr}`;
        if (!relDef.allowed.includes(token)) {
          throw new Error(
            `Subject set '${token}' not allowed for '${objType}.${t.relation}'. Allowed: ${relDef.allowed.join(", ")}`,
          );
        }
      } else {
        const { type: st } = parseObj(t.subject);
        if (!relDef.allowed.includes(st)) {
          throw new Error(
            `Subject type '${st}' not allowed for '${objType}.${t.relation}'. Allowed: ${relDef.allowed.join(", ")}`,
          );
        }
      }
    }
  }
}
