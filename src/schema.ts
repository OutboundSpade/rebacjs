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

export type EntityDef<
  TRelations extends Record<string, RelationDef> = Record<string, RelationDef>,
> = {
  type: string;
  relations: TRelations;
};

export type SchemaDef<
  TEntities extends Record<string, EntityDef> = Record<string, EntityDef>,
> = {
  entities: TEntities;
};

export type EntityName<TSchema extends SchemaDef> = Extract<
  keyof TSchema["entities"],
  string
>;

export type RelationName<
  TSchema extends SchemaDef,
  TEntity extends EntityName<TSchema>,
> = Extract<keyof TSchema["entities"][TEntity]["relations"], string>;

export type ObjectRefFor<
  TSchema extends SchemaDef,
  TEntity extends EntityName<TSchema> = EntityName<TSchema>,
> = `${TEntity}:${string}`;

export function entity<
  const TRelations extends Record<string, RelationDef> = Record<
    string,
    RelationDef
  >,
>(cfg?: { relations?: TRelations }): EntityDef<TRelations> {
  return { type: "", relations: (cfg?.relations ?? {}) as TRelations };
}

export function relation(cfg: {
  allowed: AllowedSubject[];
}): DirectRelationDef {
  return { kind: "direct", allowed: cfg.allowed };
}

export function derived(rewrite: Rewrite): DerivedRelationDef {
  return { kind: "derived", rewrite };
}

export function defineSchema<const TEntities extends Record<string, EntityDef>>(
  entities: TEntities,
): SchemaDef<{
  [K in keyof TEntities]: EntityDef<TEntities[K]["relations"]> & {
    type: Extract<K, string>;
  };
}> {
  const map = {} as {
    [K in keyof TEntities]: EntityDef<TEntities[K]["relations"]> & {
      type: Extract<K, string>;
    };
  };

  for (const key of Object.keys(entities) as (keyof TEntities)[]) {
    const def = entities[key];
    map[key] = {
      ...def,
      type: key as Extract<typeof key, string>,
    };
  }

  return { entities: map };
}

export function getEntity(schema: SchemaDef, type: string): EntityDef;
export function getEntity<
  TSchema extends SchemaDef,
  TType extends EntityName<TSchema>,
>(schema: TSchema, type: TType): TSchema["entities"][TType] {
  const ent = schema.entities[type] as TSchema["entities"][TType] | undefined;
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
