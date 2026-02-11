# Custom Storage Backend

This example shows how to implement your own `TupleStore` with filesystem I/O.

## Why this matters

The built-in `MemoryTupleStore` is great for local testing, but production systems usually need:

- persistence
- custom indexing strategy
- audit hooks
- integration with an existing database

`rebacjs` intentionally keeps storage as a small interface so you can plug in your own backend.

## What this example demonstrates

- A custom file-backed backend (`FileTupleStore`) that implements `TupleStore`.
- Basic JSON persistence to `out/custom-storage-tuples.json`.
- Startup load from disk, then write-through updates on `write`/`delete`.
- Optional operation logging (load/write/delete/query) for diagnostics.

## Interface contract

Your backend must implement:

```ts
interface TupleStore {
  write(tuples: Tuple[]): Promise<void>;
  delete(tuples: Tuple[]): Promise<void>;
  query(q: TupleQuery): Promise<Tuple[]>;
}
```

## Run

```bash
bun run examples/custom-storage/example.ts
```

The script prints access checks and an operation log from the custom backend.

After running, inspect:

```bash
cat out/custom-storage-tuples.json
```

to see how tuples are serialized.
