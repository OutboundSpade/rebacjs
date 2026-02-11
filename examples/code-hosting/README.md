# Code Hosting Permissions

This example mirrors common Git hosting authorization patterns.

## Domain goals

- org members can read repositories
- org admins can administer repositories
- maintainers can write
- blocked users cannot merge even if they can write

## Policy summary

- `repo.read`
  - maintainer OR org member OR org admin
- `repo.write`
  - maintainer OR org admin
- `repo.merge`
  - write AND NOT blocked

## Why this is useful

It demonstrates combining inherited access (`followRelation`) with exclusion lists (`difference`) and composition (`intersection`).

## Run

```bash
bun run examples/code-hosting/example.ts
```
