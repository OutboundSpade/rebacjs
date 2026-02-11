import {
  defineSchema,
  entity,
  relation,
  derived,
  union,
  intersection,
  difference,
  computedUserset,
  tupleToUserset,
  MemoryTupleStore,
  RebacClient,
  obj,
  user,
  userset,
} from "./src/index";

const schema = defineSchema({
  user: entity("user"),

  group: entity("group", {
    relations: {
      member: relation({
        // group:eng#member can directly contain user:alice
        allowed: ["user"],
      }),
    },
  }),

  folder: entity("folder", {
    relations: {
      parent: relation({ allowed: ["folder"] }),
      owner: relation({ allowed: ["user"] }),
      editor: relation({ allowed: ["user", "group#member"] }),

      // viewer = owner OR editor OR (parent->viewer)
      viewer: derived(
        union(
          computedUserset("owner"),
          computedUserset("editor"),
          tupleToUserset("parent", "viewer"),
        ),
      ),
    },
  }),

  doc: entity("doc", {
    relations: {
      parent: relation({ allowed: ["folder"] }),
      owner: relation({ allowed: ["user"] }),
      viewer: derived(
        union(computedUserset("owner"), tupleToUserset("parent", "viewer")),
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
    subject: userset("group", "eng", "member"),
  },
  {
    object: obj("doc", "spec"),
    relation: "parent",
    subject: obj("folder", "root"),
  },
]);

// Check: does bob have viewer on doc:spec ?
// bob is member of group:eng, group:eng#member is editor of folder:root,
// viewer(doc:spec) => parent->viewer(folder:root) => editor => group:eng#member contains bob
const ok = await rebac.check({
  user: user("bob"),
  object: obj("doc", "spec"),
  relation: "editor",
});

console.log(ok); // true
