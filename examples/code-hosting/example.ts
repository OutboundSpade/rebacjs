import {
  MemoryTupleStore,
  RebacClient,
  defineSchema,
  derived,
  difference,
  entity,
  followRelation,
  obj,
  relation,
  sameObjectRelation,
  subjectSet,
  union,
} from "../../src/index";

const schema = defineSchema({
  user: entity(),

  org: entity({
    relations: {
      member: relation({ allowed: ["user"] }),
      admin: relation({ allowed: ["user"] }),
    },
  }),

  team: entity({
    relations: {
      parent_org: relation({ allowed: ["org"] }),
      member: relation({ allowed: ["user"] }),
    },
  }),

  repo: entity({
    relations: {
      parent_org: relation({ allowed: ["org"] }),
      maintainer: relation({ allowed: ["user", "team#member"] }),
      blocked: relation({ allowed: ["user"] }),

      read: derived(
        union(
          sameObjectRelation("maintainer"),
          followRelation({ through: "parent_org", relation: "member" }),
          followRelation({ through: "parent_org", relation: "admin" }),
        ),
      ),

      write: derived(
        union(
          sameObjectRelation("maintainer"),
          followRelation({ through: "parent_org", relation: "admin" }),
        ),
      ),

      merge: derived(
        difference(sameObjectRelation("write"), sameObjectRelation("blocked")),
      ),
    },
  }),
});

const store = new MemoryTupleStore();
const rebac = new RebacClient({ schema, store });

await rebac.write([
  {
    object: obj("org", "oss-co"),
    relation: "member",
    subject: obj("user", "alice"),
  },
  {
    object: obj("org", "oss-co"),
    relation: "admin",
    subject: obj("user", "sre"),
  },

  {
    object: obj("team", "core"),
    relation: "parent_org",
    subject: obj("org", "oss-co"),
  },
  {
    object: obj("team", "core"),
    relation: "member",
    subject: obj("user", "bob"),
  },

  {
    object: obj("repo", "rebacjs"),
    relation: "parent_org",
    subject: obj("org", "oss-co"),
  },
  {
    object: obj("repo", "rebacjs"),
    relation: "maintainer",
    subject: obj("user", "carol"),
  },
  {
    object: obj("repo", "rebacjs"),
    relation: "maintainer",
    subject: subjectSet("team", "core", "member"),
  },
  {
    object: obj("repo", "rebacjs"),
    relation: "blocked",
    subject: obj("user", "bob"),
  },
]);

const checks = [
  {
    label: "alice can read via org membership",
    req: {
      subject: obj("user", "alice"),
      object: obj("repo", "rebacjs"),
      relation: "read" as const,
    },
  },
  {
    label: "carol can merge as maintainer",
    req: {
      subject: obj("user", "carol"),
      object: obj("repo", "rebacjs"),
      relation: "merge" as const,
    },
  },
  {
    label: "bob cannot merge because blocked",
    req: {
      subject: obj("user", "bob"),
      object: obj("repo", "rebacjs"),
      relation: "merge" as const,
    },
  },
  {
    label: "sre can write as org admin",
    req: {
      subject: obj("user", "sre"),
      object: obj("repo", "rebacjs"),
      relation: "write" as const,
    },
  },
];

for (const c of checks) {
  const ok = await rebac.check(c.req);
  console.log(`${c.label}: ${ok}`);
}
