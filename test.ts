import {
  defineSchema,
  entity,
  relation,
  derived,
  union,
  intersection,
  difference,
  sameObjectRelation,
  followRelation,
  MemoryTupleStore,
  RebacClient,
  obj,
  subjectSet,
} from "./src/index";

const user = (id: string) => obj("user", id);

const schema = defineSchema({
  user: entity(),

  group: entity({
    relations: {
      member: relation({
        // group:eng#member can directly contain user:alice
        allowed: ["user"],
      }),
    },
  }),

  folder: entity({
    relations: {
      parent: relation({ allowed: ["folder"] }),
      owner: relation({ allowed: ["user"] }),
      editor: relation({ allowed: ["user", "group#member"] }),

      // viewer = owner OR editor OR (parent->viewer)
      viewer: derived(
        union(
          sameObjectRelation("owner"),
          sameObjectRelation("editor"),
          followRelation({ through: "parent", relation: "viewer" }),
        ),
      ),
    },
  }),

  doc: entity({
    relations: {
      parent: relation({ allowed: ["folder"] }),
      owner: relation({ allowed: ["user"] }),
      editor: relation({ allowed: ["user"] }),
      viewer: derived(
        // viewer = owner OR (parent->viewer) OR (parent->viewer AND NOT editor)
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

// Write tuples (object, relation, subject)
await rebac.write([
  { object: obj("folder", "root"), relation: "owner", subject: user("alice") },
  { object: obj("group", "eng"), relation: "member", subject: user("bob") },
  {
    object: obj("folder", "root"),
    relation: "editor",
    subject: subjectSet("group", "eng", "member"),
  },
  {
    object: obj("doc", "spec"),
    relation: "parent",
    subject: obj("folder", "root"),
  },
]);

// Check: does bob have viewer on doc:spec ?
// bob is member of group:eng, group:eng#member is editor of folder:root,
// viewer(doc:spec) => parent->viewer(folder:root) => viewer => group:eng#member contains bob
const ok = await rebac.check({
  user: user("bob"),
  relation: "viewer",
  object: obj("doc", "spec"),
});

console.log(ok); // true

const invalid = await rebac.check({
  user: user("bob"),
  relation: "not_a_relation" as any,
  object: obj("doc", "spec"),
});

console.log(invalid); // false

const checkValidation = rebac.validateCheck({
  user: user("bob"),
  relation: "not_a_relation",
  object: obj("doc", "spec"),
});

console.log(checkValidation.valid); // false

const validCheck = rebac.validateCheck({
  user: user("bob"),
  relation: "viewer",
  object: obj("doc", "spec"),
});
