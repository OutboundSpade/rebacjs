# B2B Data Room Sharing

This example models a secure data room shared between partner organizations.

## Domain goals

- room owners and local analysts can access documents
- partner organizations can receive viewer rights at room level
- document-level deny list can override inherited view access

## Policy summary

- `document.view`
  - owner OR analyst OR room viewer
- `document.download`
  - view AND NOT download_denied

## Why this is realistic

Enterprise sharing flows often combine inheritance and explicit per-document revocation, especially for export controls.

## Run

```bash
bun run examples/b2b-data-room/example.ts
```
