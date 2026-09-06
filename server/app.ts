import express from "express";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { statuses } from "../src/types.ts";
export function createApp(filename: string, seed = false) {
  if (filename !== ":memory:") mkdirSync(dirname(resolve(filename)), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, owner TEXT NOT NULL, due TEXT NOT NULL, status TEXT NOT NULL, priority TEXT NOT NULL, color TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY, projectId INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE, title TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY);`);
  if (seed && !db.prepare("SELECT key FROM metadata WHERE key='seeded'").get()) {
    db.exec("BEGIN");
    const rows = [
      [
        "Website redesign",
        "A fresh digital home. Reimagine the experience from first impression to final click.",
        "Alex Morgan",
        "2026-10-15",
        "active",
        "high",
        "#258975",
      ],
      [
        "Mobile experience",
        "Bring the workspace to everyone, wherever great ideas happen.",
        "Jamie Chen",
        "2026-11-02",
        "active",
        "high",
        "#7682ce",
      ],
      [
        "Design system",
        "One shared language for a more consistent product.",
        "Sam Rivera",
        "2026-10-22",
        "active",
        "medium",
        "#c58c4b",
      ],
      [
        "Customer insights",
        "Turn conversations into a clear direction for what comes next.",
        "Taylor Kim",
        "2026-11-12",
        "planned",
        "medium",
        "#bf7997",
      ],
      [
        "API integration",
        "Connect the tools our team uses every day.",
        "Alex Morgan",
        "2026-10-30",
        "paused",
        "low",
        "#6590b7",
      ],
      [
        "Brand foundations",
        "Define the story, identity, and principles behind our next chapter.",
        "Jamie Chen",
        "2026-08-28",
        "completed",
        "medium",
        "#9277ba",
      ],
    ];
    rows.forEach((row, index) => {
      const result = db
        .prepare(
          "INSERT INTO projects (name,description,owner,due,status,priority,color) VALUES (?,?,?,?,?,?,?)",
        )
        .run(...row);
      [
        "Research and discovery",
        "Define requirements",
        "Explore concepts",
        "Review with team",
        "Implementation",
        "Quality assurance",
        "Final review",
        "Launch",
      ].forEach((title, i) =>
        db
          .prepare("INSERT INTO tasks (projectId,title,done) VALUES (?,?,?)")
          .run(result.lastInsertRowid, title, Number(i < [5, 3, 6, 0, 2, 8][index])),
      );
    });
    db.prepare("INSERT INTO metadata VALUES ('seeded')").run();
    db.exec("COMMIT");
  }
  db.exec(
    `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, tags TEXT NOT NULL DEFAULT '[]');`,
  );
  db.exec("BEGIN");
  try {
    for (const table of ["projects", "tasks"]) {
      if (
        !db
          .prepare(`PRAGMA table_info(${table})`)
          .all()
          .some((c) => c.name === "ownerId")
      )
        db.exec(
          `ALTER TABLE ${table} ADD COLUMN ownerId INTEGER REFERENCES users(id) ON DELETE SET NULL`,
        );
      db.exec(`CREATE INDEX IF NOT EXISTS ${table}_owner_idx ON ${table}(ownerId)`);
    }
    if (!db.prepare("SELECT key FROM metadata WHERE key='user-owners-v1'").get()) {
      for (const p of db.prepare("SELECT id, owner FROM projects WHERE trim(owner) != ''").all()) {
        const name = String(p.owner).trim();
        const user = db.prepare("SELECT id FROM users WHERE name=?").get(name);
        const id =
          user?.id ?? db.prepare("INSERT INTO users (name) VALUES (?)").run(name).lastInsertRowid;
        db.prepare("UPDATE projects SET ownerId=? WHERE id=?").run(id, p.id);
      }
      db.prepare("INSERT INTO metadata VALUES ('user-owners-v1')").run();
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    db.close();
    throw error;
  }
  db.exec("BEGIN");
  try {
    for (const table of ["projects", "tasks"]) {
      db.exec(
        `CREATE TABLE IF NOT EXISTS ${table}_owners (entityId INTEGER NOT NULL REFERENCES ${table}(id) ON DELETE CASCADE, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, position INTEGER NOT NULL, PRIMARY KEY(entityId,userId))`,
      );
    }
    if (!db.prepare("SELECT key FROM metadata WHERE key='multi-owners-v1'").get()) {
      for (const table of ["projects", "tasks"])
        db.exec(
          `INSERT INTO ${table}_owners SELECT id, ownerId, 0 FROM ${table} WHERE ownerId IS NOT NULL`,
        );
      db.prepare("INSERT INTO metadata VALUES ('multi-owners-v1')").run();
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    db.close();
    throw error;
  }
  function owners(table: "projects" | "tasks", id: number) {
    return db
      .prepare(`SELECT userId FROM ${table}_owners WHERE entityId=? ORDER BY position`)
      .all(id)
      .map((r) => Number(r.userId));
  }
  function setOwners(table: "projects" | "tasks", id: number, ids: number[]) {
    db.exec("SAVEPOINT assign_owners");
    try {
      db.prepare(`DELETE FROM ${table}_owners WHERE entityId=?`).run(id);
      ids.forEach((userId, position) =>
        db.prepare(`INSERT INTO ${table}_owners VALUES (?,?,?)`).run(id, userId, position),
      );
      db.prepare(`UPDATE ${table} SET ownerId=? WHERE id=?`).run(ids[0] ?? null, id);
      db.exec("RELEASE assign_owners");
    } catch (error) {
      db.exec("ROLLBACK TO assign_owners; RELEASE assign_owners");
      throw error;
    }
  }
  const validOwner = (id: unknown) =>
    id === null ||
    (typeof id === "number" &&
      Number.isSafeInteger(id) &&
      !!db.prepare("SELECT id FROM users WHERE id=?").get(id));
  const validOwners = (ids: unknown) =>
    Array.isArray(ids) &&
    ids.length <= 100 &&
    new Set(ids).size === ids.length &&
    ids.every((id) => id !== null && validOwner(id));
  function projectOwner(b: { ownerIds?: number[]; ownerId?: number | null; owner: string }) {
    if (b.ownerIds !== undefined) return b.ownerIds[0] ?? null;
    if (b.ownerId !== undefined) return b.ownerId;
    const name = b.owner.trim();
    if (!name) return null;
    return (
      db.prepare("SELECT id FROM users WHERE name=?").get(name)?.id ??
      db.prepare("INSERT INTO users (name) VALUES (?)").run(name).lastInsertRowid
    );
  }
  const app = express();
  app.use(express.json({ limit: "32kb" }));
  // Local application: reject cross-origin browser mutations.
  app.use("/api", (req, res, next) => {
    if (!["GET", "HEAD"].includes(req.method) && req.headers.origin) {
      try {
        if (new URL(req.headers.origin).host !== req.headers.host)
          return res.status(403).json({ error: "origin" });
      } catch {
        return res.status(403).json({ error: "origin" });
      }
    }
    next();
  });
  const exists = (id: string) =>
    /^\d+$/.test(id) && db.prepare("SELECT id FROM projects WHERE id=?").get(id);
  const validUser = (b: any) =>
    b &&
    typeof b.name === "string" &&
    b.name.trim().length > 0 &&
    b.name.length <= 100 &&
    Array.isArray(b.tags) &&
    b.tags.length <= 20 &&
    b.tags.every(
      (tag: unknown) => typeof tag === "string" && tag.trim().length > 0 && tag.length <= 40,
    );
  const normalizeTags = (tags: string[]) => [
    ...new Map(tags.map((tag) => [tag.trim().toLocaleLowerCase(), tag.trim()])).values(),
  ];
  app.get("/api/users", (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim().toLocaleLowerCase() : "";
    const tag = typeof req.query.tag === "string" ? req.query.tag.toLocaleLowerCase() : "";
    res.json(
      db
        .prepare("SELECT * FROM users ORDER BY name COLLATE NOCASE, id")
        .all()
        .map((u) => ({
          id: Number(u.id),
          name: String(u.name),
          tags: JSON.parse(String(u.tags)) as string[],
        }))
        .filter(
          (u) =>
            `${u.name} ${u.tags.join(" ")}`.toLocaleLowerCase().includes(q) &&
            (!tag || u.tags.some((t) => t.toLocaleLowerCase() === tag)),
        ),
    );
  });
  app.post("/api/users", (req, res) => {
    if (!validUser(req.body)) return res.status(400).json({ error: "validation" });
    const r = db
      .prepare("INSERT INTO users (name,tags) VALUES (?,?)")
      .run(req.body.name.trim(), JSON.stringify(normalizeTags(req.body.tags)));
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  });
  app.put("/api/users/:id", (req, res) => {
    if (!validUser(req.body)) return res.status(400).json({ error: "validation" });
    const r = db
      .prepare("UPDATE users SET name=?,tags=? WHERE id=?")
      .run(req.body.name.trim(), JSON.stringify(normalizeTags(req.body.tags)), req.params.id);
    res.status(r.changes ? 200 : 404).json(r.changes ? { ok: true } : { error: "missing" });
  });
  app.get("/api/projects", (_req, res) => {
    const tasks = db.prepare("SELECT * FROM tasks ORDER BY id").all();
    res.json(
      db
        .prepare(
          "SELECT projects.*, COALESCE(users.name, '') AS owner FROM projects LEFT JOIN users ON projects.ownerId=users.id ORDER BY projects.id DESC",
        )
        .all()
        .map((p) => ({
          ...p,
          ownerIds: owners("projects", Number(p.id)),
          owner: db
            .prepare(
              "SELECT users.name FROM projects_owners JOIN users ON users.id=projects_owners.userId WHERE entityId=? ORDER BY position",
            )
            .all(p.id)
            .map((u) => u.name)
            .join(", "),
          tasks: tasks
            .filter((t) => t.projectId === p.id)
            .map((t) => ({ ...t, ownerIds: owners("tasks", Number(t.id)), done: Boolean(t.done) })),
        })),
    );
  });
  function validProject(b: any) {
    return (
      b &&
      ["name", "description", "owner", "due", "status", "priority", "color"].every(
        (k) => typeof b[k] === "string",
      ) &&
      (b.ownerId === undefined || validOwner(b.ownerId)) &&
      (b.ownerIds === undefined || validOwners(b.ownerIds)) &&
      b.name.trim().length > 0 &&
      b.name.length <= 120 &&
      b.description.length <= 2000 &&
      (b.ownerIds !== undefined || b.owner.length <= 100) &&
      (b.due === "" ||
        (/^\d{4}-\d{2}-\d{2}$/.test(b.due) &&
          !Number.isNaN(Date.parse(b.due)) &&
          new Date(b.due).toISOString().slice(0, 10) === b.due)) &&
      statuses.includes(b.status) &&
      ["low", "medium", "high"].includes(b.priority) &&
      /^#[0-9a-f]{6}$/i.test(b.color)
    );
  }
  app.post("/api/projects", (req, res) => {
    const b = req.body;
    if (!validProject(b)) return res.status(400).json({ error: "validation" });
    const r = db
      .prepare(
        "INSERT INTO projects (name,description,owner,due,status,priority,color,ownerId) VALUES (?,?,?,?,?,?,?,?)",
      )
      .run(
        b.name.trim(),
        b.description,
        b.owner,
        b.due,
        b.status,
        b.priority,
        b.color,
        projectOwner(b),
      );
    setOwners(
      "projects",
      Number(r.lastInsertRowid),
      b.ownerIds ?? (projectOwner(b) == null ? [] : [Number(projectOwner(b))]),
    );
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  });
  app.put("/api/projects/:id", (req, res) => {
    if (!exists(req.params.id)) return res.status(404).json({ error: "missing" });
    const b = req.body;
    if (!validProject(b)) return res.status(400).json({ error: "validation" });
    db.prepare(
      "UPDATE projects SET name=?,description=?,owner=?,due=?,status=?,priority=?,color=?,ownerId=? WHERE id=?",
    ).run(
      b.name.trim(),
      b.description,
      b.owner,
      b.due,
      b.status,
      b.priority,
      b.color,
      projectOwner(b),
      req.params.id,
    );
    setOwners(
      "projects",
      Number(req.params.id),
      b.ownerIds ?? (projectOwner(b) == null ? [] : [Number(projectOwner(b))]),
    );
    res.json({ ok: true });
  });
  app.delete("/api/projects/:id", (req, res) => {
    if (!exists(req.params.id)) return res.status(404).json({ error: "missing" });
    db.prepare("DELETE FROM projects WHERE id=?").run(req.params.id);
    res.json({ ok: true });
  });
  app.post("/api/projects/:id/tasks", (req, res) => {
    if (!exists(req.params.id)) return res.status(404).json({ error: "missing" });
    if (
      typeof req.body?.title !== "string" ||
      !req.body.title.trim() ||
      req.body.title.length > 200 ||
      (req.body.ownerId !== undefined && !validOwner(req.body.ownerId)) ||
      (req.body.ownerIds !== undefined && !validOwners(req.body.ownerIds))
    )
      return res.status(400).json({ error: "validation" });
    const r = db
      .prepare("INSERT INTO tasks (projectId,title,ownerId) VALUES (?,?,?)")
      .run(req.params.id, req.body.title.trim(), req.body.ownerId ?? null);
    setOwners(
      "tasks",
      Number(r.lastInsertRowid),
      req.body.ownerIds ?? (req.body.ownerId == null ? [] : [req.body.ownerId]),
    );
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  });
  app.patch("/api/tasks/:id", (req, res) => {
    if (
      typeof req.body?.done !== "boolean" &&
      typeof req.body?.title !== "string" &&
      req.body?.ownerId === undefined &&
      req.body?.ownerIds === undefined
    )
      return res.status(400).json({ error: "validation" });
    if (
      req.body.title !== undefined &&
      (typeof req.body.title !== "string" || !req.body.title.trim() || req.body.title.length > 200)
    )
      return res.status(400).json({ error: "validation" });
    if (req.body.done !== undefined && typeof req.body.done !== "boolean")
      return res.status(400).json({ error: "validation" });
    if (req.body.ownerId !== undefined && !validOwner(req.body.ownerId))
      return res.status(400).json({ error: "validation" });
    if (req.body.ownerIds !== undefined && !validOwners(req.body.ownerIds))
      return res.status(400).json({ error: "validation" });
    const task = db.prepare("SELECT * FROM tasks WHERE id=?").get(req.params.id);
    if (!task) return res.status(404).json({ error: "missing" });
    db.prepare("UPDATE tasks SET done=?,title=?,ownerId=? WHERE id=?").run(
      req.body.done === undefined ? task.done : Number(req.body.done),
      req.body.title?.trim() ?? task.title,
      req.body.ownerId === undefined ? task.ownerId : req.body.ownerId,
      req.params.id,
    );
    if (req.body.ownerIds !== undefined || req.body.ownerId !== undefined)
      setOwners(
        "tasks",
        Number(req.params.id),
        req.body.ownerIds ?? (req.body.ownerId === null ? [] : [req.body.ownerId]),
      );
    res.json({ ok: true });
  });
  app.delete("/api/tasks/:id", (req, res) => {
    const r = db.prepare("DELETE FROM tasks WHERE id=?").run(req.params.id);
    res.status(r.changes ? 200 : 404).json(r.changes ? { ok: true } : { error: "missing" });
  });
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "missing" });
  });
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res
      .status(err.status === 400 ? 400 : 500)
      .json({ error: err.status === 400 ? "validation" : "server" });
  });
  return { app, db };
}
