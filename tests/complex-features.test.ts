import { describe, expect, it } from "@jest/globals";
import {
  MemoryTupleStore,
  RebacClient,
  defineSchema,
  derived,
  difference,
  entity,
  followRelation,
  intersection,
  obj,
  relation,
  sameObjectRelation,
  subjectSet,
  union,
} from "../src/index";

describe("complex rewrite features", () => {
  it("resolves subject sets through group membership", async () => {
    const schema = defineSchema({
      user: entity(),
      group: entity({
        relations: {
          member: relation({ allowed: ["user"] }),
        },
      }),
      doc: entity({
        relations: {
          editor: relation({ allowed: ["user", "group#member"] }),
          viewer: derived(sameObjectRelation("editor")),
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
        object: obj("doc", "spec"),
        relation: "editor",
        subject: subjectSet("group", "eng", "member"),
      },
    ]);

    await expect(
      rebac.check({
        subject: obj("user", "alice"),
        object: obj("doc", "spec"),
        relation: "viewer",
      }),
    ).resolves.toBe(true);
  });

  it("supports intersection and difference rewrites", async () => {
    const schema = defineSchema({
      user: entity(),
      doc: entity({
        relations: {
          member: relation({ allowed: ["user"] }),
          banned: relation({ allowed: ["user"] }),
          canAccess: derived(
            intersection(
              sameObjectRelation("member"),
              difference(
                sameObjectRelation("member"),
                sameObjectRelation("banned"),
              ),
            ),
          ),
        },
      }),
    });

    const rebac = new RebacClient({ schema, store: new MemoryTupleStore() });

    await rebac.write([
      {
        object: obj("doc", "spec"),
        relation: "member",
        subject: obj("user", "alice"),
      },
      {
        object: obj("doc", "spec"),
        relation: "member",
        subject: obj("user", "bob"),
      },
      {
        object: obj("doc", "spec"),
        relation: "banned",
        subject: obj("user", "bob"),
      },
    ]);

    await expect(
      rebac.check({
        subject: obj("user", "alice"),
        object: obj("doc", "spec"),
        relation: "canAccess",
      }),
    ).resolves.toBe(true);

    await expect(
      rebac.check({
        subject: obj("user", "bob"),
        object: obj("doc", "spec"),
        relation: "canAccess",
      }),
    ).resolves.toBe(false);
  });

  it("handles recursive followRelation chains and maxDepth", async () => {
    const schema = defineSchema({
      user: entity(),
      folder: entity({
        relations: {
          parent: relation({ allowed: ["folder"] }),
          owner: relation({ allowed: ["user"] }),
          viewer: derived(
            union(
              sameObjectRelation("owner"),
              followRelation({ through: "parent", relation: "viewer" }),
            ),
          ),
        },
      }),
    });

    const store = new MemoryTupleStore();
    const rebac = new RebacClient({ schema, store });

    await rebac.write([
      {
        object: obj("folder", "root"),
        relation: "owner",
        subject: obj("user", "alice"),
      },
      {
        object: obj("folder", "level1"),
        relation: "parent",
        subject: obj("folder", "root"),
      },
      {
        object: obj("folder", "level2"),
        relation: "parent",
        subject: obj("folder", "level1"),
      },
      {
        object: obj("folder", "level3"),
        relation: "parent",
        subject: obj("folder", "level2"),
      },
    ]);

    await expect(
      rebac.check({
        subject: obj("user", "alice"),
        object: obj("folder", "level3"),
        relation: "viewer",
      }),
    ).resolves.toBe(true);

    const shallow = new RebacClient({
      schema,
      store,
      options: { maxDepth: 1 },
    });

    await expect(
      shallow.check({
        subject: obj("user", "alice"),
        object: obj("folder", "level3"),
        relation: "viewer",
      }),
    ).resolves.toBe(false);
  });

  it("returns false for cycles instead of throwing", async () => {
    const schema = defineSchema({
      user: entity(),
      group: entity({
        relations: {
          member: relation({ allowed: ["user", "group#member"] }),
        },
      }),
    });

    const rebac = new RebacClient({ schema, store: new MemoryTupleStore() });

    await rebac.write([
      {
        object: obj("group", "a"),
        relation: "member",
        subject: subjectSet("group", "b", "member"),
      },
      {
        object: obj("group", "b"),
        relation: "member",
        subject: subjectSet("group", "a", "member"),
      },
    ]);

    await expect(
      rebac.check({
        subject: obj("user", "alice"),
        object: obj("group", "a"),
        relation: "member",
      }),
    ).resolves.toBe(false);
  });

  it("rejects writes to derived relations", async () => {
    const schema = defineSchema({
      user: entity(),
      doc: entity({
        relations: {
          editor: relation({ allowed: ["user"] }),
          viewer: derived(sameObjectRelation("editor")),
        },
      }),
    });

    const rebac = new RebacClient({ schema, store: new MemoryTupleStore() });

    await expect(
      rebac.write([
        {
          object: obj("doc", "spec"),
          relation: "viewer",
          subject: obj("user", "alice"),
        } as any,
      ]),
    ).rejects.toThrow("Cannot write tuple for derived relation");
  });
});
