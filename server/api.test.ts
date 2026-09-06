import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./app.ts";
test("project and task CRUD, validation, SQLite persistence and cascading deletion", async () => {
  const dir = mkdtempSync(join(tmpdir(), "stride-"));
  const filename = join(dir, "test.sqlite");
  let { app, db } = createApp(filename);
  let server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  let port = (server.address() as { port: number }).port;
  const request = async (path: string, method = "GET", body?: unknown) =>
    fetch(`http://127.0.0.1:${port}/api${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(method !== "GET" && body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  const close = () =>
    new Promise<void>((resolve, reject) =>
      server.close((e) => {
        db.close();
        if (e) reject(e);
        else resolve();
      }),
    );
  try {
    const project = {
      name: "Persistence test",
      description: "中文",
      owner: "Test owner",
      due: "2026-10-01",
      status: "active",
      priority: "high",
      color: "#258975",
    };
    assert.equal((await request("/projects", "POST", { ...project, name: " " })).status, 400);
    assert.equal(
      (await request("/projects", "POST", { ...project, due: "2026-02-31" })).status,
      400,
    );
    const created = await request("/projects", "POST", project);
    assert.equal(created.status, 201);
    const { id } = await created.json();
    assert.equal(
      (await request(`/projects/${id}`, "PUT", { ...project, name: "Renamed" })).status,
      200,
    );
    const task = await (await request(`/projects/${id}/tasks`, "POST", { title: "A task" })).json();
    assert.equal((await request(`/tasks/${task.id}`, "PATCH", { done: "yes" })).status, 400);
    assert.equal(
      (
        await request(`/tasks/${task.id}`, "PATCH", {
          done: true,
          title: "Finished task",
        })
      ).status,
      200,
    );
    await close();
    ({ app, db } = createApp(filename));
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((r) => server.once("listening", r));
    port = (server.address() as { port: number }).port;
    const rows = await (await request("/projects")).json();
    assert.equal(rows[0].name, "Renamed");
    assert.equal(rows[0].tasks[0].done, true);
    assert.equal(rows[0].tasks[0].title, "Finished task");
    const forbidden = await fetch(`http://127.0.0.1:${port}/api/projects`, {
      method: "POST",
      headers: {
        Origin: "https://example.com",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(project),
    });
    assert.equal(forbidden.status, 403);
    assert.equal((await request("/projects/999/tasks", "POST", { title: "Orphan" })).status, 404);
    await request(`/projects/${id}`, "DELETE");
    assert.deepEqual(await (await request("/projects")).json(), []);
    assert.equal(db.prepare("SELECT COUNT(*) as count FROM tasks").get()!.count, 0);
  } finally {
    await close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("users, tag search, owner assignment, rename and unassignment persist", async () => {
  const dir = mkdtempSync(join(tmpdir(), "stride-users-"));
  const filename = join(dir, "db.sqlite");
  const { app, db } = createApp(filename);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const port = (server.address() as { port: number }).port;
  const request = (path: string, method: string, body?: unknown) =>
    fetch(`http://127.0.0.1:${port}/api${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  try {
    assert.equal((await request("/users", "POST", { name: " ", tags: [] })).status, 400);
    assert.equal((await request("/users", "POST", { name: "Invalid", tags: [42] })).status, 400);
    const user = await (
      await request("/users", "POST", { name: "Ada Chen", tags: ["Design", "design", "中文"] })
    ).json();
    const other = await (
      await request("/users", "POST", { name: "Grace", tags: ["Engineering"] })
    ).json();
    const matches = await (await request("/users?q=DESIGN", "GET")).json();
    assert.equal(matches.length, 1);
    assert.deepEqual(matches[0].tags, ["design", "中文"]);
    assert.equal((await (await request("/users?tag=Engineering", "GET")).json())[0].id, other.id);
    const p = {
      name: "Owned project",
      description: "",
      owner: "",
      ownerId: user.id,
      due: "",
      status: "active",
      priority: "high",
      color: "#258975",
    };
    assert.equal((await request("/projects", "POST", { ...p, ownerId: 99999 })).status, 400);
    const project = await (await request("/projects", "POST", p)).json();
    const task = await (
      await request(`/projects/${project.id}/tasks`, "POST", {
        title: "Owned task",
        ownerId: other.id,
      })
    ).json();
    assert.equal((await request(`/tasks/${task.id}`, "PATCH", { ownerId: "invalid" })).status, 400);
    await request(`/tasks/${task.id}`, "PATCH", { ownerId: user.id });
    await request(`/users/${user.id}`, "PUT", { name: "Ada Updated", tags: ["Lead"] });
    const rows = await (await request("/projects", "GET")).json();
    assert.equal(rows[0].owner, "Ada Updated");
    assert.equal(rows[0].ownerId, user.id);
    assert.equal(rows[0].tasks[0].ownerId, user.id);
    assert.equal(
      (await request(`/tasks/${task.id}`, "PATCH", { ownerIds: [user.id, user.id] })).status,
      400,
    );
    assert.equal((await request(`/tasks/${task.id}`, "PATCH", { ownerIds: [null] })).status, 400);
    assert.equal(
      (await request(`/projects/${project.id}`, "PUT", { ...p, ownerIds: [999999] })).status,
      400,
    );
    await request(`/projects/${project.id}`, "PUT", { ...p, ownerIds: [user.id, other.id] });
    await request(`/tasks/${task.id}`, "PATCH", { ownerIds: [other.id, user.id] });
    const multi = await (await request("/projects", "GET")).json();
    assert.deepEqual(multi[0].ownerIds, [user.id, other.id]);
    assert.equal(multi[0].owner, "Ada Updated, Grace");
    assert.deepEqual(multi[0].tasks[0].ownerIds, [other.id, user.id]);
    const reopened = createApp(filename);
    assert.equal(
      reopened.db.prepare("SELECT ownerId FROM tasks WHERE id=?").get(task.id)!.ownerId,
      other.id,
    );
    assert.deepEqual(
      reopened.db
        .prepare("SELECT userId FROM tasks_owners WHERE entityId=? ORDER BY position")
        .all(task.id)
        .map((r) => r.userId),
      [other.id, user.id],
    );
    assert.equal(
      reopened.db.prepare("SELECT name FROM users WHERE id=?").get(user.id)!.name,
      "Ada Updated",
    );
    reopened.db.close();
    await request(`/projects/${project.id}`, "PUT", { ...p, ownerId: null });
    await request(`/tasks/${task.id}`, "PATCH", { ownerId: null });
    const unassigned = await (await request("/projects", "GET")).json();
    assert.equal(unassigned[0].ownerId, null);
    assert.equal(unassigned[0].owner, "");
    assert.equal(unassigned[0].tasks[0].ownerId, null);
  } finally {
    await new Promise<void>((r, j) =>
      server.close((e) => {
        db.close();
        if (e) j(e);
        else r();
      }),
    );
    rmSync(dir, { recursive: true, force: true });
  }
});

test("legacy project owner names migrate once without losing tasks", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const dir = mkdtempSync(join(tmpdir(), "stride-legacy-"));
  const filename = join(dir, "db.sqlite");
  const legacy = new DatabaseSync(filename);
  legacy.exec(
    `CREATE TABLE projects (id INTEGER PRIMARY KEY,name TEXT,description TEXT,owner TEXT,due TEXT,status TEXT,priority TEXT,color TEXT); CREATE TABLE tasks (id INTEGER PRIMARY KEY, projectId INTEGER REFERENCES projects(id) ON DELETE CASCADE,title TEXT,done INTEGER);INSERT INTO projects VALUES(1,'Existing','','Legacy Owner','','active','high','#258975');INSERT INTO projects VALUES(2,'Second','','Legacy Owner','','planned','low','#258975');INSERT INTO tasks VALUES(1,1,'Existing task',1);`,
  );
  legacy.close();
  try {
    for (let i = 0; i < 2; i++) {
      const { db } = createApp(filename);
      assert.equal(db.prepare("SELECT COUNT(*) AS count FROM users").get()!.count, 1);
      assert.equal(
        db.prepare("SELECT ownerId FROM projects WHERE id=1").get()!.ownerId,
        db.prepare("SELECT ownerId FROM projects WHERE id=2").get()!.ownerId,
      );
      assert.equal(db.prepare("SELECT done FROM tasks WHERE id=1").get()!.done, 1);
      assert.equal(db.prepare("SELECT ownerId FROM tasks WHERE id=1").get()!.ownerId, null);
      db.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
