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
  union,
} from "../../src/index";

const schema = defineSchema({
  user: entity(),

  team: entity({
    relations: {
      clinician: relation({ allowed: ["user"] }),
    },
  }),

  patient: entity({
    relations: {
      primary_team: relation({ allowed: ["team"] }),
      consent_viewer: relation({ allowed: ["user"] }),
      clinician: derived(
        followRelation({ through: "primary_team", relation: "clinician" }),
      ),
    },
  }),

  chart: entity({
    relations: {
      patient: relation({ allowed: ["patient"] }),
      attending: relation({ allowed: ["user"] }),
      break_glass: relation({ allowed: ["user"] }),

      view: derived(
        union(
          sameObjectRelation("attending"),
          sameObjectRelation("break_glass"),
          followRelation({ through: "patient", relation: "consent_viewer" }),
          followRelation({ through: "patient", relation: "clinician" }),
        ),
      ),

      edit: derived(
        union(
          sameObjectRelation("attending"),
          followRelation({ through: "patient", relation: "clinician" }),
        ),
      ),
    },
  }),
});

const store = new MemoryTupleStore();
const rebac = new RebacClient({ schema, store });

await rebac.write([
  {
    object: obj("team", "cardiology"),
    relation: "clinician",
    subject: obj("user", "dr_smith"),
  },
  {
    object: obj("patient", "p123"),
    relation: "primary_team",
    subject: obj("team", "cardiology"),
  },
  {
    object: obj("patient", "p123"),
    relation: "consent_viewer",
    subject: obj("user", "nurse_amy"),
  },

  {
    object: obj("chart", "c123"),
    relation: "patient",
    subject: obj("patient", "p123"),
  },
  {
    object: obj("chart", "c123"),
    relation: "attending",
    subject: obj("user", "dr_lee"),
  },
  {
    object: obj("chart", "c123"),
    relation: "break_glass",
    subject: obj("user", "oncall_er"),
  },
]);

const checks = [
  {
    label: "dr_smith can edit via primary team",
    req: {
      subject: obj("user", "dr_smith"),
      object: obj("chart", "c123"),
      relation: "edit" as const,
    },
  },
  {
    label: "nurse_amy can view via consent",
    req: {
      subject: obj("user", "nurse_amy"),
      object: obj("chart", "c123"),
      relation: "view" as const,
    },
  },
  {
    label: "oncall_er can view via break-glass",
    req: {
      subject: obj("user", "oncall_er"),
      object: obj("chart", "c123"),
      relation: "view" as const,
    },
  },
  {
    label: "nurse_amy cannot edit",
    req: {
      subject: obj("user", "nurse_amy"),
      object: obj("chart", "c123"),
      relation: "edit" as const,
    },
  },
];

for (const c of checks) {
  const ok = await rebac.check(c.req);
  console.log(`${c.label}: ${ok}`);
}
