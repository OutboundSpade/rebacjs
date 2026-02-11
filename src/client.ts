import type { SchemaDef } from "./schema";
import { getEntity, getRelation } from "./schema";
import type { Tuple } from "./tuple";
import type { TupleStore } from "./storage";
import {
  parseObjectRef,
  isUsersetRef,
  parseUsersetRef,
  parseObjectRef as parseObj,
} from "./refs";
import { RebacEngine, type CheckRequest } from "./engine";

export class RebacClient {
  private engine: RebacEngine;

  constructor(
    private readonly cfg: {
      schema: SchemaDef;
      store: TupleStore;
      options?: { maxDepth?: number };
    },
  ) {
    this.engine = new RebacEngine(cfg.schema, cfg.store, cfg.options);
  }

  async check(req: CheckRequest): Promise<boolean> {
    return this.engine.check(req);
  }

  async write(tuples: Tuple[]): Promise<void> {
    this.validateTuples(tuples);
    await this.cfg.store.write(tuples);
  }

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
      if (isUsersetRef(t.subject)) {
        const { type: st, relation: sr } = parseUsersetRef(t.subject);
        const token = `${st}#${sr}`;
        if (!relDef.allowed.includes(token)) {
          throw new Error(
            `Subject userset '${token}' not allowed for '${objType}.${t.relation}'. Allowed: ${relDef.allowed.join(", ")}`,
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

      // Optional: validate that referenced entity types exist
      getEntity(this.cfg.schema, objType);
    }
  }
}
