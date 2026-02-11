import {
  RebacClient,
  defineSchema,
  derived,
  entity,
  followRelation,
  obj,
  relation,
  sameObjectRelation,
  union,
  type Tuple,
  type TupleQuery,
  type TupleStore,
} from "../../src/index";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

class FileTupleStore implements TupleStore {
  private tuples = new Map<string, Tuple>();
  private logs: string[] = [];
  private ready: Promise<void>;

  constructor(
    private readonly filePath: string,
    private readonly enableLogs = true,
  ) {
    this.ready = this.loadFromDisk();
  }

  async write(tuples: Tuple[]): Promise<void> {
    await this.ready;
    for (const t of tuples) {
      this.tuples.set(this.key(t), { ...t });
      this.log(`write ${t.object}#${t.relation} <- ${t.subject}`);
    }
    await this.persist();
  }

  async delete(tuples: Tuple[]): Promise<void> {
    await this.ready;
    for (const t of tuples) {
      this.tuples.delete(this.key(t));
      this.log(`delete ${t.object}#${t.relation} <- ${t.subject}`);
    }
    await this.persist();
  }

  async query(q: TupleQuery): Promise<Tuple[]> {
    await this.ready;
    this.log(
      `query object=${q.object ?? "*"} relation=${q.relation ?? "*"} subject=${q.subject ?? "*"}`,
    );

    const out: Tuple[] = [];
    for (const t of this.tuples.values()) {
      if (q.object && t.object !== q.object) continue;
      if (q.relation && t.relation !== q.relation) continue;
      if (q.subject && t.subject !== q.subject) continue;
      out.push({ ...t });
    }
    return out;
  }

  getLogEntries(): string[] {
    return [...this.logs];
  }

  private log(message: string): void {
    if (this.enableLogs) this.logs.push(message);
  }

  private key(t: Tuple): string {
    return `${t.object}|${t.relation}|${t.subject}`;
  }

  private async loadFromDisk(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });

    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Tuple[];
      this.tuples.clear();
      for (const t of parsed) {
        this.tuples.set(this.key(t), { ...t });
      }
      this.log(`load ${parsed.length} tuples from ${this.filePath}`);
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code !== "ENOENT") throw err;
      await this.persist();
      this.log(`init empty store at ${this.filePath}`);
    }
  }

  private async persist(): Promise<void> {
    const data = JSON.stringify([...this.tuples.values()], null, 2);
    await writeFile(this.filePath, data + "\n", "utf8");
  }
}

const schema = defineSchema({
  user: entity(),
  org: entity({
    relations: {
      member: relation({ allowed: ["user"] }),
    },
  }),
  repo: entity({
    relations: {
      parent_org: relation({ allowed: ["org"] }),
      maintainer: relation({ allowed: ["user"] }),
      // can read if maintainer or member of parent org
      read: derived(
        union(
          sameObjectRelation("maintainer"),
          followRelation({ through: "parent_org", relation: "member" }),
        ),
      ),
    },
  }),
});

const storeFile = `${process.cwd()}/out/custom-storage-tuples.json`;
const store = new FileTupleStore(storeFile, true);
const rebac = new RebacClient({ schema, store });

await rebac.write([
  {
    object: obj("org", "acme"),
    relation: "member",
    subject: obj("user", "alice"),
  },
  {
    object: obj("repo", "rebacjs"),
    relation: "parent_org",
    subject: obj("org", "acme"),
  },
  {
    object: obj("repo", "rebacjs"),
    relation: "maintainer",
    subject: obj("user", "bob"),
  },
]);

const aliceRead = await rebac.check({
  subject: obj("user", "alice"),
  object: obj("repo", "rebacjs"),
  relation: "read",
});

const bobRead = await rebac.check({
  subject: obj("user", "bob"),
  object: obj("repo", "rebacjs"),
  relation: "read",
});

const eveRead = await rebac.check({
  subject: obj("user", "eve"),
  object: obj("repo", "rebacjs"),
  relation: "read",
});

console.log(`alice can read via org membership: ${aliceRead}`);
console.log(`bob can read via direct maintainer: ${bobRead}`);
console.log(`eve can read: ${eveRead}`);
console.log(`tuples persisted in: ${storeFile}`);

console.log("\nStore audit log:");
for (const line of store.getLogEntries()) {
  console.log(`- ${line}`);
}
