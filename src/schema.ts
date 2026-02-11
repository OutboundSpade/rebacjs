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

export type SchemaValidationResult = {
  valid: boolean;
  errors: string[];
};

export type DefineSchemaOptions = {
  validate?: boolean;
};

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

function isInvalidName(name: string): boolean {
  return name.length === 0 || name.includes(":") || name.includes("#");
}

function validateRewrite(
  schema: SchemaDef,
  entityType: string,
  rewrite: Rewrite,
  path: string,
  errors: string[],
): void {
  const relations = schema.entities[entityType]?.relations;
  if (!relations) {
    errors.push(`${path}: unknown entity type '${entityType}'`);
    return;
  }

  switch (rewrite.op) {
    case "sameObjectRelation": {
      if (!relations[rewrite.relation]) {
        errors.push(
          `${path}: relation '${rewrite.relation}' not found on '${entityType}'`,
        );
      }
      return;
    }

    case "followRelation": {
      const throughDef = relations[rewrite.through];
      if (!throughDef) {
        errors.push(
          `${path}: through relation '${rewrite.through}' not found on '${entityType}'`,
        );
        return;
      }

      if (throughDef.kind !== "direct") {
        errors.push(
          `${path}: through relation '${entityType}.${rewrite.through}' must be direct`,
        );
        return;
      }

      for (const allowed of throughDef.allowed) {
        if (allowed.includes("#")) {
          errors.push(
            `${path}: through relation '${entityType}.${rewrite.through}' allows subject set '${allowed}', but followRelation only follows object refs`,
          );
          continue;
        }

        const targetEnt = schema.entities[allowed];
        if (!targetEnt) {
          errors.push(
            `${path}: through relation '${entityType}.${rewrite.through}' references unknown type '${allowed}'`,
          );
          continue;
        }

        if (!targetEnt.relations[rewrite.relation]) {
          errors.push(
            `${path}: relation '${rewrite.relation}' not found on followed type '${allowed}'`,
          );
        }
      }
      return;
    }

    case "union":
    case "intersection": {
      for (const [idx, child] of rewrite.children.entries()) {
        validateRewrite(
          schema,
          entityType,
          child,
          `${path}.${rewrite.op}[${idx}]`,
          errors,
        );
      }
      return;
    }

    case "difference": {
      validateRewrite(schema, entityType, rewrite.base, `${path}.base`, errors);
      for (const [idx, child] of rewrite.subtract.entries()) {
        validateRewrite(
          schema,
          entityType,
          child,
          `${path}.subtract[${idx}]`,
          errors,
        );
      }
      return;
    }
  }
}

export function validateSchema(schema: SchemaDef): SchemaValidationResult {
  const errors: string[] = [];

  for (const [entityType, ent] of Object.entries(schema.entities)) {
    if (isInvalidName(entityType)) {
      errors.push(`entity '${entityType}' has invalid name`);
    }

    for (const [relationName, relDef] of Object.entries(ent.relations)) {
      if (isInvalidName(relationName)) {
        errors.push(
          `relation '${entityType}.${relationName}' has invalid relation name`,
        );
      }

      if (relDef.kind === "direct") {
        for (const allowed of relDef.allowed) {
          if (!allowed.includes("#")) {
            if (!schema.entities[allowed]) {
              errors.push(
                `relation '${entityType}.${relationName}' allows unknown type '${allowed}'`,
              );
            }
            continue;
          }

          const [subjectType, subjectRelation, ...rest] = allowed.split("#");
          if (!subjectType || !subjectRelation || rest.length > 0) {
            errors.push(
              `relation '${entityType}.${relationName}' has invalid allowed subject '${allowed}'`,
            );
            continue;
          }

          const subjectEntity = schema.entities[subjectType];
          if (!subjectEntity) {
            errors.push(
              `relation '${entityType}.${relationName}' allows unknown subject set type '${subjectType}'`,
            );
            continue;
          }

          if (!subjectEntity.relations[subjectRelation]) {
            errors.push(
              `relation '${entityType}.${relationName}' allows unknown subject set relation '${subjectType}.${subjectRelation}'`,
            );
          }
        }
      } else {
        validateRewrite(
          schema,
          entityType,
          relDef.rewrite,
          `rewrite '${entityType}.${relationName}'`,
          errors,
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function defineSchema<const TEntities extends Record<string, EntityDef>>(
  entities: TEntities,
  options: DefineSchemaOptions = {},
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

  const schema = { entities: map };

  if (options.validate !== false) {
    const result = validateSchema(schema);
    if (!result.valid) {
      throw new Error(`Invalid schema:\n- ${result.errors.join("\n- ")}`);
    }
  }

  return schema;
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
