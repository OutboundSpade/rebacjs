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
  user,
  subjectSet,
} from "./src/index";

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
      viewer: derived(
        // viewer = owner OR (parent->viewer)
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
  object: obj("doc", "spec"),
  relation: "viewer",
});

console.log(ok); // true
