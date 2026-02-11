# AI Agent Guide for rebacjs

This file helps coding agents quickly generate correct code using `rebacjs`.

## Core API (current names)

- Schema:
  - `defineSchema(entities, options?)`
  - `entity({ relations? })`
  - `relation({ allowed })`
  - `derived(rewrite)`
- Rewrite helpers:
  - `sameObjectRelation(relation)`
  - `followRelation({ through, relation })`
  - `union(...children)`
  - `intersection(...children)`
  - `difference(base, ...subtract)`
- Refs:
  - `obj(type, id)` -> `"type:id"`
  - `subjectSet(type, id, rel)` -> `"type:id#rel"`
- Runtime:
  - `new RebacClient({ schema, store, options? })`
  - `rebac.write(tuples)`
  - `rebac.delete(tuples)`
  - `rebac.check({ subject, object, relation })`
  - `rebac.validateCheck({ subject, object, relation })`

## Critical behavior rules

- `check(...)` is fail-closed: invalid checks return `false` (no throws).
- Schema validates by default in `defineSchema(...)`.
- Disable schema validation only when needed: `defineSchema(..., { validate: false })`.
- Use `validateSchema(schema)` to collect explicit validation errors.
- Only direct relations are writable. Writing to derived relations throws.

## Canonical policy pattern

```ts
import {
  MemoryTupleStore,
  RebacClient,
  defineSchema,
  derived,
  entity,
  followRelation,
  obj,
  relation,
  sameObjectRelation,
  subjectSet,
  union,
} from "rebacjs";

const schema = defineSchema({
  user: entity(),
  group: entity({
    relations: { member: relation({ allowed: ["user"] }) },
  }),
  folder: entity({
    relations: {
      parent: relation({ allowed: ["folder"] }),
      owner: relation({ allowed: ["user"] }),
      editor: relation({ allowed: ["user", "group#member"] }),
      viewer: derived(
        union(
          sameObjectRelation("owner"),
          sameObjectRelation("editor"),
          followRelation({ through: "parent", relation: "viewer" }),
        ),
      ),
    },
  }),
});

const rebac = new RebacClient({ schema, store: new MemoryTupleStore() });

await rebac.write([
  {
    object: obj("group", "eng"),
    relation: "member",
    subject: obj("user", "alice"),
  },
  {
    object: obj("folder", "root"),
    relation: "editor",
    subject: subjectSet("group", "eng", "member"),
  },
]);

const ok = await rebac.check({
  subject: obj("user", "alice"),
  object: obj("folder", "root"),
  relation: "viewer",
});
```

## Common mistakes to avoid

- Do not send `{ user: ... }` to `check`; use `{ subject: ... }`.
- Do not write tuples to derived relations.
- Avoid malformed refs:
  - object must look like `type:id`
  - subject set must look like `type:id#relation`

## Where to learn by example

- `examples/saas-workspace`
- `examples/healthcare-emr`
- `examples/code-hosting`
- `examples/b2b-data-room`
- `examples/custom-storage`

## Test commands

- Type check: `bunx tsc --noEmit`
- Unit tests: `bun run test`
