import { test } from "node:test";
import assert from "node:assert/strict";
import { compareProjects, type SortKey } from "./project-sort.ts";
import type { Project } from "../types.ts";
const make = (
  id: number,
  name: string,
  due: string,
  status: Project["status"],
  owner: string,
  priority: Project["priority"],
  done: boolean[],
): Project => ({
  id,
  name,
  due,
  status,
  owner,
  priority,
  description: "",
  color: "#20816b",
  ownerId: null,
  ownerIds: [],
  tasks: done.map((value, index) => ({
    id: index,
    projectId: id,
    title: "Task",
    done: value,
    ownerId: null,
    ownerIds: [],
  })),
});
const rows = [
  make(1, "Project 10", "2026-10-10", "completed", "Zoe", "high", [true, true]),
  make(2, "Project 2", "2026-09-10", "planned", "Amy", "low", []),
  make(3, "Project 3", "", "active", "Bo", "medium", [true, false]),
];
const order = (key: SortKey, direction: "asc" | "desc") =>
  rows.toSorted((a, b) => compareProjects(a, b, key, direction, "en")).map((p) => p.id);
test("column sorts use natural names, workflow status, numeric progress and priority", () => {
  for (const key of ["alphabetical", "status", "owner", "priority", "progress"] as const) {
    assert.deepEqual(order(key, "asc"), [2, 3, 1], key);
    assert.deepEqual(order(key, "desc"), [1, 3, 2], key);
  }
  assert.deepEqual(order("newest", "asc"), [3, 2, 1]);
});
test("missing dates stay last in both directions and sorting preserves input", () => {
  assert.deepEqual(order("dueSoon", "asc"), [2, 1, 3]);
  assert.deepEqual(order("dueSoon", "desc"), [1, 2, 3]);
  assert.deepEqual(
    rows.map((p) => p.id),
    [1, 2, 3],
  );
});
