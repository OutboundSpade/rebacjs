import type { Rewrite } from "./rewrite";

export type AllowedSubject =
  | string // "user" or "folder"
  | `${string}#${string}`; // "group#member"

export type DirectRelationDef = {
  kind: "direct";
  allowed: AllowedSubject[];
};

export type DerivedRelationDef = {
  kind: "derived";
  rewrite: Rewrite;
};

export type RelationDef = DirectRelationDef | DerivedRelationDef;

export type EntityDef = {
  type: string;
  relations: Record<string, RelationDef>;
};

export type SchemaDef = {
  entities: Record<string, EntityDef>;
};

export function entity(
  type: string,
  cfg?: { relations?: Record<string, RelationDef> },
): EntityDef {
  return { type, relations: cfg?.relations ?? {} };
}

export function relation(cfg: {
  allowed: AllowedSubject[];
}): DirectRelationDef {
  return { kind: "direct", allowed: cfg.allowed };
}

export function derived(rewrite: Rewrite): DerivedRelationDef {
  return { kind: "derived", rewrite };
}

export function defineSchema(entities: Record<string, EntityDef>): SchemaDef {
  const map: Record<string, EntityDef> = {};
  for (const [k, def] of Object.entries(entities)) {
    // allow either key or def.type as canonical type, but prefer def.type
    map[def.type ?? k] = def;
  }
  return { entities: map };
}

export function getEntity(schema: SchemaDef, type: string): EntityDef {
  const ent = schema.entities[type];
  if (!ent) throw new Error(`Unknown entity type '${type}'`);
  return ent;
}

export function getRelation(
  schema: SchemaDef,
  objectType: string,
  relationName: string,
): RelationDef {
  const ent = getEntity(schema, objectType);
  const rel = ent.relations[relationName];
  if (!rel)
    throw new Error(
      `Unknown relation '${relationName}' on type '${objectType}'`,
    );
  return rel;
}
