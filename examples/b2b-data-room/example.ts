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
  union,
} from "../../src/index";

const schema = defineSchema({
  user: entity(),

  org: entity({
    relations: {
      employee: relation({ allowed: ["user"] }),
    },
  }),

  room: entity({
    relations: {
      owner: relation({ allowed: ["user"] }),
      analyst: relation({ allowed: ["user"] }),
      partner_org: relation({ allowed: ["org"] }),

      viewer: derived(
        union(
          sameObjectRelation("owner"),
          sameObjectRelation("analyst"),
          followRelation({ through: "partner_org", relation: "employee" }),
        ),
      ),
    },
  }),

  document: entity({
    relations: {
      room: relation({ allowed: ["room"] }),
      owner: relation({ allowed: ["user"] }),
      analyst: relation({ allowed: ["user"] }),
      download_denied: relation({ allowed: ["user"] }),

      view: derived(
        union(
          sameObjectRelation("owner"),
          sameObjectRelation("analyst"),
          followRelation({ through: "room", relation: "viewer" }),
        ),
      ),

      download: derived(
        difference(
          sameObjectRelation("view"),
          sameObjectRelation("download_denied"),
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
    relation: "employee",
    subject: obj("user", "alice"),
  },
  {
    object: obj("org", "globex"),
    relation: "employee",
    subject: obj("user", "bob"),
  },

  {
    object: obj("room", "q4_mna"),
    relation: "owner",
    subject: obj("user", "owner_1"),
  },
  {
    object: obj("room", "q4_mna"),
    relation: "analyst",
    subject: obj("user", "analyst_1"),
  },
  {
    object: obj("room", "q4_mna"),
    relation: "partner_org",
    subject: obj("org", "globex"),
  },

  {
    object: obj("document", "teaser"),
    relation: "room",
    subject: obj("room", "q4_mna"),
  },
  {
    object: obj("document", "teaser"),
    relation: "download_denied",
    subject: obj("user", "bob"),
  },
]);

const checks = [
  {
    label: "owner_1 can download",
    req: {
      subject: obj("user", "owner_1"),
      object: obj("document", "teaser"),
      relation: "download" as const,
    },
  },
  {
    label: "analyst_1 can view",
    req: {
      subject: obj("user", "analyst_1"),
      object: obj("document", "teaser"),
      relation: "view" as const,
    },
  },
  {
    label: "bob can view via partner org employee",
    req: {
      subject: obj("user", "bob"),
      object: obj("document", "teaser"),
      relation: "view" as const,
    },
  },
  {
    label: "bob cannot download due to deny",
    req: {
      subject: obj("user", "bob"),
      object: obj("document", "teaser"),
      relation: "download" as const,
    },
  },
  {
    label: "alice cannot view",
    req: {
      subject: obj("user", "alice"),
      object: obj("document", "teaser"),
      relation: "view" as const,
    },
  },
];

for (const c of checks) {
  const ok = await rebac.check(c.req);
  console.log(`${c.label}: ${ok}`);
}
