import { progress, statuses, type Project } from "../types.ts";

export type SortKey =
  | "newest"
  | "alphabetical"
  | "dueSoon"
  | "status"
  | "owner"
  | "priority"
  | "progress";

export function compareProjects(
  a: Project,
  b: Project,
  key: SortKey,
  direction: "asc" | "desc",
  locale: string,
) {
  // Unscheduled projects stay last in either direction.
  if (key === "dueSoon" && (!a.due || !b.due)) {
    if (Boolean(a.due) !== Boolean(b.due)) return a.due ? -1 : 1;
  }
  const priorities = { low: 0, medium: 1, high: 2 };
  let result = 0;
  switch (key) {
    case "alphabetical":
      result = a.name.localeCompare(b.name, locale, { numeric: true });
      break;
    case "dueSoon":
      result = a.due.localeCompare(b.due);
      break;
    case "status":
      result = statuses.indexOf(a.status) - statuses.indexOf(b.status);
      break;
    case "owner":
      result = a.owner.localeCompare(b.owner, locale, { numeric: true });
      break;
    case "priority":
      result = priorities[a.priority] - priorities[b.priority];
      break;
    case "progress":
      result = progress(a) - progress(b);
      break;
    case "newest":
      result = b.id - a.id;
      break;
  }
  return (direction === "asc" ? result : -result) || a.id - b.id;
}
