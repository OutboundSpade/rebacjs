import { describe, expect, it } from "@jest/globals";
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
  validateSchema,
} from "../src/index";

function buildSchema() {
  return defineSchema({
    user: entity(),
    group: entity({
      relations: {
        member: relation({ allowed: ["user"] }),
      },
    }),
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
}

describe("schema validation", () => {
  it("throws on invalid schema by default", () => {
    expect(() =>
      defineSchema({
        user: entity(),
        doc: entity({
          relations: {
            viewer: derived(sameObjectRelation("missing_relation")),
          },
        }),
      }),
    ).toThrow("Invalid schema");
  });

  it("allows disabling validation and exposes validateSchema", () => {
    const schema = defineSchema(
      {
        user: entity(),
        doc: entity({
          relations: {
            viewer: derived(sameObjectRelation("missing_relation")),
          },
        }),
      },
      { validate: false },
    );

    const result = validateSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe("check behavior", () => {
  it("returns true for valid relation graph", async () => {
    const schema = buildSchema();
    const rebac = new RebacClient({ schema, store: new MemoryTupleStore() });

    await rebac.write([
      {
        object: obj("folder", "root"),
        relation: "owner",
        subject: obj("user", "alice"),
      },
      {
        object: obj("folder", "child"),
        relation: "parent",
        subject: obj("folder", "root"),
      },
    ]);

    await expect(
      rebac.check({
        subject: obj("user", "alice"),
        object: obj("folder", "child"),
        relation: "viewer",
      }),
    ).resolves.toBe(true);
  });

  it("never throws and returns false for invalid checks", async () => {
    const schema = buildSchema();
    const rebac = new RebacClient({ schema, store: new MemoryTupleStore() });

    await expect(
      rebac.check({
        subject: obj("user", "alice"),
        object: obj("folder", "root"),
        relation: "not_a_relation" as any,
      }),
    ).resolves.toBe(false);

    await expect(
      rebac.check({
        subject: "not-an-object-ref" as any,
        object: obj("folder", "root"),
        relation: "viewer",
      }),
    ).resolves.toBe(false);
  });

  it("provides optional check validation errors", () => {
    const schema = buildSchema();
    const rebac = new RebacClient({ schema, store: new MemoryTupleStore() });

    const invalidRelation = rebac.validateCheck({
      subject: obj("user", "alice"),
      object: obj("folder", "root"),
      relation: "not_a_relation",
    });

    expect(invalidRelation.valid).toBe(false);
    expect(invalidRelation.errors.length).toBeGreaterThan(0);

    const invalidSubjectSet = rebac.validateCheck({
      subject: subjectSet("group", "eng", "missing"),
      object: obj("folder", "root"),
      relation: "viewer",
    });

    expect(invalidSubjectSet.valid).toBe(false);
    expect(invalidSubjectSet.errors.length).toBeGreaterThan(0);
  });
});
