# Examples

This folder contains realistic, end-to-end ReBAC modeling examples.

Each example includes:

- a runnable `example.ts`
- a `README.md` with domain context, policy mapping, and expected outcomes

## Included scenarios

1. `saas-workspace`
   - Multi-tenant SaaS with org admins, teams, and projects.
2. `healthcare-emr`
   - Electronic medical record access with care teams and patient consent.
3. `code-hosting`
   - Git hosting style org/team/repo permissions, including merge restrictions.
4. `b2b-data-room`
   - Partner data room with cross-org sharing and explicit deny rules.
5. `custom-storage`
   - Implement a custom `TupleStore` with audit logging and indexing.

## Running an example

From repository root:

```bash
bun run examples/saas-workspace/example.ts
```

Swap the path for any other example in this directory.
