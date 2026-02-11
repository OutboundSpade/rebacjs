# rebacjs

A small, type-friendly Relationship-Based Access Control (ReBAC) engine for TypeScript inspired by Zanzibar/[OpenFGA](https://openfga.dev/).

`rebacjs` lets you model permissions as relationships between objects (users, groups, docs, orgs, etc.) and evaluate access through direct and derived relations.

## Highlights

- Small API surface and in-memory store for fast local development.
- Schema-first modeling with runtime validation by default.
- TypeScript relation hints based on your schema keys.
- Safe check behavior: `check(...)` is fail-closed and returns `false` for invalid checks.
- Optional explicit validation APIs for schema and check requests.
- Custom storage interface for external databases or APIs.

## Installation

```bash
bun install rebacjs
```

## Quick Start

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
    relations: {
      member: relation({ allowed: ["user"] }),
    },
  }),
  folder: entity({
    relations: {
      owner: relation({ allowed: ["user"] }),
      editor: relation({ allowed: ["user", "group#member"] }),
      viewer: derived(
        union(sameObjectRelation("owner"), sameObjectRelation("editor")),
      ),
    },
  }),
  doc: entity({
    relations: {
      parent: relation({ allowed: ["folder"] }),
      viewer: derived(
        followRelation({ through: "parent", relation: "viewer" }),
      ),
    },
  }),
});

const store = new MemoryTupleStore();
const rebac = new RebacClient({ schema, store });

await rebac.write([
  {
    object: obj("group", "eng"),
    relation: "member",
    subject: obj("user", "bob"),
  },
  {
    object: obj("folder", "root"),
    relation: "editor",
    subject: subjectSet("group", "eng", "member"),
  },
  {
    object: obj("doc", "spec"),
    relation: "parent",
    subject: obj("folder", "root"),
  },
]);

const canView = await rebac.check({
  subject: obj("user", "bob"),
  object: obj("doc", "spec"),
  relation: "viewer",
});

console.log(canView); // true
```

## Core Concepts

- `object`: target resource (for example `doc:spec`).
- `subject`: actor or userset (for example `user:bob`, `group:eng#member`).
- `relation`: permission or link name (for example `viewer`, `owner`, `parent`).

### Direct vs Derived Relations

- Direct relations are stored tuples (`relation({ allowed: [...] })`).
- Derived relations are computed from rewrites (`derived(...)`).

Rewrite operators:

- `sameObjectRelation("owner")`: evaluate another relation on the same object.
- `followRelation({ through: "parent", relation: "viewer" })`: follow object links and evaluate a relation on the linked object.
- `union(...)`, `intersection(...)`, `difference(base, ...)`: combine policy logic.

## Schema Validation

Schema validation runs by default in `defineSchema(...)`.

```ts
const schema = defineSchema(
  {
    user: entity(),
    doc: entity({
      relations: {
        viewer: derived(sameObjectRelation("missing")),
      },
    }),
  },
  { validate: false },
);

const result = validateSchema(schema);
console.log(result.valid, result.errors);
```

Validation covers:

- invalid entity/relation names
- unknown allowed subject types and subject-set relations
- invalid rewrite references (missing relations, invalid `followRelation` paths)

## Check Behavior and Validation

`check(...)` never throws. Invalid requests return `false`.

If you need detailed reasons, call:

- `validateCheckRequest(schema, req)`
- or `rebac.validateCheck(req)` from `RebacClient`

```ts
const outcome = await rebac.check({
  subject: "not-an-object-ref" as any,
  object: obj("doc", "spec"),
  relation: "viewer",
});
// outcome === false

const validation = rebac.validateCheck({
  subject: "not-an-object-ref",
  object: obj("doc", "spec"),
  relation: "viewer",
});
// validation.valid === false
// validation.errors has details
```

## Examples

The `examples/` directory includes realistic policy models:

- `examples/saas-workspace`: org, team, project access.
- `examples/healthcare-emr`: care team + consent + emergency access.
- `examples/code-hosting`: org/team/repo with merge restrictions.
- `examples/b2b-data-room`: partner sharing with deny overrides.
- `examples/custom-storage`: custom `TupleStore` implementation with audit logs.

Run one:

```bash
bun run examples/saas-workspace/example.ts
```

## Testing

Run tests:

```bash
bun run test
```

Current test suites include base behavior, complex rewrites, and schema-validation edge cases.

## Project Structure

- `src/schema.ts`: schema definition and validation.
- `src/rewrite.ts`: rewrite AST and helper constructors.
- `src/engine.ts`: check evaluation engine and check validation.
- `src/client.ts`: user-facing client API.
- `src/stores/memory.ts`: in-memory tuple store.
- `tests/`: Jest coverage.
- `examples/`: runnable, documented real-world scenarios.

## License

Apache 2.0 License. See [LICENSE](./LICENSE) for details.
