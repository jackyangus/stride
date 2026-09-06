export type User = { id: number; name: string; tags: string[] };
export const statuses = ["planned", "active", "paused", "completed"] as const;
export type Status = (typeof statuses)[number];
export type Task = {
  id: number;
  projectId: number;
  ownerId: number | null;
  ownerIds: number[];
  title: string;
  done: boolean;
};
export type Project = {
  id: number;
  name: string;
  description: string;
  owner: string;
  ownerId: number | null;
  ownerIds: number[];
  due: string;
  status: Status;
  priority: "low" | "medium" | "high";
  color: string;
  tasks: Task[];
};
export type ProjectInput = Omit<Project, "id" | "tasks">;
export function progress(project: Project) {
  return project.tasks.length
    ? Math.round((project.tasks.filter((t) => t.done).length / project.tasks.length) * 100)
    : 0;
}
