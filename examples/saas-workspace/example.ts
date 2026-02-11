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

  project: entity({
    relations: {
      parent_org: relation({ allowed: ["org"] }),
      owner: relation({ allowed: ["user"] }),
      editor: relation({ allowed: ["user", "team#member"] }),

      viewer: derived(
        union(
          sameObjectRelation("owner"),
          sameObjectRelation("editor"),
          followRelation({ through: "parent_org", relation: "member" }),
          followRelation({ through: "parent_org", relation: "admin" }),
        ),
      ),

      manage: derived(
        union(
          sameObjectRelation("owner"),
          followRelation({ through: "parent_org", relation: "admin" }),
        ),
      ),
    },
  }),
});

const store = new MemoryTupleStore();
const rebac = new RebacClient({ schema, store });

await rebac.write([
  {
    object: obj("org", "acme"),
    relation: "member",
    subject: obj("user", "alice"),
  },
  {
    object: obj("org", "acme"),
    relation: "admin",
    subject: obj("user", "erin"),
  },

  {
    object: obj("team", "platform"),
    relation: "parent_org",
    subject: obj("org", "acme"),
  },
  {
    object: obj("team", "platform"),
    relation: "member",
    subject: obj("user", "bob"),
  },

  {
    object: obj("project", "billing"),
    relation: "parent_org",
    subject: obj("org", "acme"),
  },
  {
    object: obj("project", "billing"),
    relation: "owner",
    subject: obj("user", "carol"),
  },
  {
    object: obj("project", "billing"),
    relation: "editor",
    subject: subjectSet("team", "platform", "member"),
  },
]);

const checks = [
  {
    label: "bob can view billing via team editor",
    req: {
      subject: obj("user", "bob"),
      object: obj("project", "billing"),
      relation: "viewer" as const,
    },
  },
  {
    label: "alice can view billing via org membership",
    req: {
      subject: obj("user", "alice"),
      object: obj("project", "billing"),
      relation: "viewer" as const,
    },
  },
  {
    label: "erin can manage billing via org admin",
    req: {
      subject: obj("user", "erin"),
      object: obj("project", "billing"),
      relation: "manage" as const,
    },
  },
  {
    label: "bob cannot manage billing",
    req: {
      subject: obj("user", "bob"),
      object: obj("project", "billing"),
      relation: "manage" as const,
    },
  },
];

for (const c of checks) {
  const ok = await rebac.check(c.req);
  console.log(`${c.label}: ${ok}`);
}
