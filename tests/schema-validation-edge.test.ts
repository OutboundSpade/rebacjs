import { describe, expect, it } from "@jest/globals";
import {
  defineSchema,
  derived,
  entity,
  followRelation,
  relation,
  sameObjectRelation,
  validateSchema,
} from "../src/index";

describe("schema validation edge cases", () => {
  it("flags invalid entity and relation names", () => {
    const schema = defineSchema(
      {
        "bad:type": entity({
          relations: {
            "bad#rel": relation({ allowed: ["user"] }),
          },
        }),
        user: entity(),
      },
      { validate: false },
    );

    const result = validateSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("invalid name"))).toBe(true);
    expect(result.errors.some((e) => e.includes("invalid relation name"))).toBe(
      true,
    );
  });

  it("flags malformed and unknown allowed subject-set tokens", () => {
    const schema = defineSchema(
      {
        user: entity(),
        doc: entity({
          relations: {
            viewer: relation({
              allowed: ["group#member#extra", "group#missing"],
            }),
          },
        }),
      },
      { validate: false },
    );

    const result = validateSchema(schema);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes("invalid allowed subject")),
    ).toBe(true);
    expect(
      result.errors.some((e) => e.includes("unknown subject set type 'group'")),
    ).toBe(true);
  });

  it("flags followRelation through a derived relation", () => {
    const schema = defineSchema(
      {
        user: entity(),
        team: entity({
          relations: {
            owner: relation({ allowed: ["user"] }),
            parent: derived(sameObjectRelation("owner")),
            viewer: derived(
              followRelation({ through: "parent", relation: "viewer" }),
            ),
          },
        }),
      },
      { validate: false },
    );

    const result = validateSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("must be direct"))).toBe(true);
  });

  it("flags followRelation through direct relation that allows subject sets", () => {
    const schema = defineSchema(
      {
        user: entity(),
        group: entity({
          relations: {
            member: relation({ allowed: ["user"] }),
          },
        }),
        doc: entity({
          relations: {
            parent: relation({ allowed: ["group#member"] }),
            viewer: derived(
              followRelation({ through: "parent", relation: "viewer" }),
            ),
          },
        }),
      },
      { validate: false },
    );

    const result = validateSchema(schema);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (e) =>
          e.includes("allows subject set") &&
          e.includes("followRelation only follows object refs"),
      ),
    ).toBe(true);
  });

  it("throws from defineSchema by default for invalid followRelation target relation", () => {
    expect(() =>
      defineSchema({
        user: entity(),
        folder: entity({
          relations: {
            parent: relation({ allowed: ["folder"] }),
            viewer: derived(
              followRelation({ through: "parent", relation: "missing" }),
            ),
          },
        }),
      }),
    ).toThrow("Invalid schema");
  });
});
