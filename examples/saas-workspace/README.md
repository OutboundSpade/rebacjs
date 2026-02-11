# SaaS Workspace Authorization

This example models a common B2B SaaS setup:

- users belong to organizations
- users may be org admins
- teams grant project editor access
- org membership grants baseline project visibility

## Why this model is realistic

Many SaaS products need all of these at once:

- tenant-level roles (`org.member`, `org.admin`)
- team-based collaboration (`team.member`)
- direct ownership (`project.owner`)
- inherited access from parent tenant (`project.parent_org -> org.member`)

## Policy summary

- `project.viewer`
  - owner OR editor OR org member OR org admin
- `project.manage`
  - owner OR org admin

## Files

- `example.ts`: runnable setup + checks

## Run

```bash
bun run examples/saas-workspace/example.ts
```

Expected output is a set of boolean checks showing who can view/manage each project.
