import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleCheck,
  FolderKanban,
  LayoutDashboard,
  LayoutGrid,
  List,
  ListTodo,
  Menu,
  Plus,
  Search,
  Settings2,
  Sprout,
  Trash2,
  X,
  Pencil,
  CalendarDays,
  Users,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { readPreference, savePreference } from "./i18n";
import { progress, statuses, type Project, type ProjectInput, type Task, type User } from "./types";
import { UsersPage } from "./components/UsersPage";
import { OwnerPicker } from "./components/OwnerPicker";
const blank: ProjectInput = {
  name: "",
  description: "",
  owner: "",
  ownerId: null,
  ownerIds: [],
  due: "",
  status: "planned",
  priority: "medium",
  color: "#258975",
};
async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch("/api" + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    ...(method !== "GET" && body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!r.ok) throw new Error("request");
  return r.json();
}
export default function App() {
  const { t, i18n } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [assigning, setAssigning] = useState<Task | null>(null);
  const [assignedOwner, setAssignedOwner] = useState<number[]>([]);
  const [projects, setProjects] = useState<Project[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [page, setPage] = useState("overview"),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [sort, setSort] = useState("newest"),
    [view, setView] = useState("grid"),
    [menu, setMenu] = useState(false);
  const [theme, setTheme] = useState(() => readPreference("theme", "system"));
  const [selected, setSelected] = useState<number | null>(null),
    [editor, setEditor] = useState<ProjectInput | null>(null),
    [editId, setEditId] = useState<number | null>(null),
    [deleting, setDeleting] = useState<Project | null>(null),
    [busy, setBusy] = useState(false),
    [taskTitle, setTaskTitle] = useState(""),
    [taskFilter, setTaskFilter] = useState("open"),
    [renaming, setRenaming] = useState<Task | null>(null),
    [renameTitle, setRenameTitle] = useState("");
  const current = projects.find((p) => p.id === selected);
  async function load() {
    try {
      const [nextProjects, nextUsers] = await Promise.all([api("/projects"), api("/users")]);
      setProjects(nextProjects);
      setUsers(nextUsers);
      setError("");
    } catch {
      setError("error");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- load synchronizes the workspace with the API; state updates occur after awaiting network I/O.
    void load();
  }, []);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      document.documentElement.classList.toggle(
        "dark",
        theme === "dark" || (theme === "system" && media.matches),
      );
    apply();
    media.addEventListener("change", apply);
    savePreference("theme", theme);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = i18n.language;
    savePreference("language", i18n.language);
  }, [i18n.language]);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  async function mutate(
    path: string,
    method: string,
    body: unknown,
    message: string,
    after?: () => void,
  ) {
    setBusy(true);
    setError("");
    try {
      await api(path, method, body);
      const [nextProjects, nextUsers] = await Promise.all([api("/projects"), api("/users")]);
      setProjects(nextProjects);
      setUsers(nextUsers);
      setNotice(message);
      after?.();
    } catch {
      setError("error");
    } finally {
      setBusy(false);
    }
  }
  const allTasks = projects.flatMap((p) => p.tasks.map((task) => ({ ...task, project: p }))),
    done = allTasks.filter((task) => task.done).length;
  const filtered = projects
    .filter(
      (p) =>
        (filter === "all" || p.status === filter) &&
        `${p.name} ${p.description} ${p.owner}`
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase()),
    )
    .sort((a, b) =>
      sort === "alphabetical"
        ? a.name.localeCompare(b.name, i18n.language)
        : sort === "dueSoon"
          ? (a.due || "9999").localeCompare(b.due || "9999")
          : b.id - a.id,
    );
  const date = (value: string) =>
    value
      ? new Intl.DateTimeFormat(i18n.language, {
          month: "short",
          day: "numeric",
          year: "numeric",
        }).format(new Date(value + "T12:00:00"))
      : t("noDate");
  const go = (value: string) => {
    setPage(value);
    setMenu(false);
  };
  const newProject = () => {
    setEditId(null);
    setEditor({ ...blank });
  };
  function editProject(p: Project) {
    setEditId(p.id);
    setEditor({ ...p });
  }
  function saveProject(e: FormEvent) {
    e.preventDefault();
    if (editor)
      void mutate(
        editId ? `/projects/${editId}` : "/projects",
        editId ? "PUT" : "POST",
        editor,
        editId ? "saved" : "created",
        () => setEditor(null),
      );
  }
  const taskRow = (task: Task, project?: Project) => (
    <div className="task-row" key={task.id}>
      <input
        type="checkbox"
        aria-label={task.title}
        checked={task.done}
        disabled={busy}
        onChange={() =>
          void mutate(`/tasks/${task.id}`, "PATCH", { done: !task.done }, "taskSaved")
        }
      />
      <div className="task-copy">
        <span className={task.done ? "finished" : ""}>{task.title}</span>
        {project && (
          <button className="task-project" onClick={() => setSelected(project.id)}>
            {project.name}
            <ChevronRight size={12} />
          </button>
        )}
      </div>
      <Button
        className="task-owner"
        variant="ghost"
        aria-label={t("assignTaskOwner", { title: task.title })}
        onClick={() => {
          setAssigning(task);
          setAssignedOwner(task.ownerIds);
        }}
      >
        <UserRound size={14} />
        <span>
          {users
            .filter((u) => task.ownerIds.includes(u.id))
            .map((u) => u.name)
            .join(", ") || t("unassigned")}
        </span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("editTask")}
        onClick={() => {
          setRenaming(task);
          setRenameTitle(task.title);
        }}
      >
        <Pencil size={14} />
      </Button>
      <Button
        disabled={busy}
        variant="ghost"
        size="icon"
        aria-label={t("deleteTask")}
        onClick={() => void mutate(`/tasks/${task.id}`, "DELETE", undefined, "taskDeleted")}
      >
        <Trash2 size={14} />
      </Button>
    </div>
  );
  return (
    <div className="app-shell">
      <aside className={menu ? "sidebar expanded" : "sidebar"}>
        <button
          type="button"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            go("overview");
          }}
        >
          <span className="brand-icon">
            <Sprout size={25} />
          </span>
          stride<span className="brand-dot">.</span>
        </button>
        <div className="workspace-switch">
          <span className="workspace-avatar">S</span>
          <div>
            <strong>{t("workspaceName")}</strong>
            <small>{t("teamPlan")}</small>
          </div>
        </div>
        <p className="nav-label">{t("workspace")}</p>
        <nav>
          {[
            [LayoutDashboard, "overview"],
            [FolderKanban, "projects"],
            [ListTodo, "tasks"],
            [Users, "users"],
          ].map(([Icon, key]) => {
            const NavIcon = Icon as typeof LayoutDashboard;
            return (
              <button
                key={String(key)}
                className={page === key ? "nav-item selected" : "nav-item"}
                onClick={() => go(String(key))}
              >
                <NavIcon size={19} />
                {t(String(key))}
                {key === "projects" && <span className="nav-count">{projects.length}</span>}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-note">
          <div className="note-art">
            <Sprout size={34} />
            <span>✦</span>
          </div>
          <strong>{t("focus")}</strong>
          <p>{t("focusText")}</p>
          <button onClick={() => go("projects")}>
            {t("viewProjects")}
            <ArrowUpRight size={15} />
          </button>
        </div>
        <button
          className={page === "settings" ? "nav-item selected" : "nav-item"}
          onClick={() => go("settings")}
        >
          <Settings2 size={19} />
          {t("settings")}
        </button>
        <div className="profile">
          <span className="avatar">S</span>
          <div>
            <strong>{t("workspaceName")}</strong>
            <small>{t("local")}</small>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button className="mobile-menu" aria-label={t("menu")} onClick={() => setMenu(!menu)}>
              <Menu size={20} />
            </button>
            <span>{t("workspace")}</span>
            <ChevronRight size={14} />
            <strong>{t(page)}</strong>
          </div>
          <div className="top-controls">
            <select
              aria-label={t("language")}
              value={i18n.language}
              onChange={(e) => void i18n.changeLanguage(e.target.value)}
            >
              <option value="en">English</option>
              <option value="zh">简体中文</option>
            </select>
            <select
              aria-label={t("theme")}
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
            >
              {["light", "dark", "system"].map((k) => (
                <option key={k} value={k}>
                  {t(k)}
                </option>
              ))}
            </select>
            <span className="avatar small">S</span>
          </div>
        </header>
        <main>
          {error && (
            <div className="error" role="alert">
              {t(error)}
              <Button variant="outline" onClick={() => void load()}>
                {t("retry")}
              </Button>
              <button aria-label={t("close")} onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {loading ? (
            <div className="empty">{t("loading")}</div>
          ) : page === "users" ? (
            <UsersPage users={users} busy={busy} error={error} mutate={mutate} />
          ) : page === "settings" ? (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">STRIDE / {t("settings")}</p>
                  <h1>{t("settings")}</h1>
                  <p>{t("settingsText")}</p>
                </div>
              </div>
              <section className="settings-panel">
                <h2>{t("theme")}</h2>
                <div className="theme-options">
                  {["light", "dark", "system"].map((k) => (
                    <button
                      className={theme === k ? "theme-option chosen" : "theme-option"}
                      onClick={() => setTheme(k)}
                      key={k}
                    >
                      <span className={"theme-preview " + k}>
                        <i />
                        <i />
                        <i />
                      </span>
                      {t(k)}
                      {theme === k && <Check size={16} />}
                    </button>
                  ))}
                </div>
                <h2>{t("language")}</h2>
                <select
                  aria-label={t("language")}
                  value={i18n.language}
                  onChange={(e) => void i18n.changeLanguage(e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="zh">简体中文</option>
                </select>
              </section>
            </>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">{t("welcome")}</p>
                  <h1>
                    {t(
                      page === "tasks" ? "allTasks" : page === "projects" ? "projects" : "heading",
                    )}
                  </h1>
                  <p>{t(page === "tasks" ? "tasksSubtitle" : "subtitle")}</p>
                </div>
                <Button onClick={newProject} className="primary-button">
                  <Plus size={17} />
                  {t("newProject")}
                </Button>
              </div>
              {page === "overview" && (
                <div className="stats">
                  {[
                    {
                      label: "total",
                      value: projects.length,
                      icon: FolderKanban,
                      foot: t("projectCount", { count: projects.length }),
                    },
                    {
                      label: "active",
                      value: projects.filter((p) => p.status === "active").length,
                      icon: ArrowUpRight,
                      foot: t("focus"),
                    },
                    {
                      label: "completed",
                      value: projects.filter((p) => p.status === "completed").length,
                      icon: CircleCheck,
                      foot: t("taskCount", { done, total: allTasks.length }),
                    },
                    {
                      label: "overall",
                      value:
                        (allTasks.length ? Math.round((done / allTasks.length) * 100) : 0) + "%",
                      icon: Sprout,
                      foot: t("progress"),
                    },
                  ].map(({ label, value, icon: Icon, foot }) => (
                    <section className={"stat " + label} key={label}>
                      <div>
                        <span>{t(label)}</span>
                        <Icon size={18} />
                      </div>
                      <strong>{value}</strong>
                      <small>{foot}</small>
                    </section>
                  ))}
                </div>
              )}
              {page === "tasks" ? (
                <section className="tasks-panel">
                  <div className="filter-tabs">
                    {["open", "done", "all"].map((k) => (
                      <button
                        className={taskFilter === k ? "active" : ""}
                        onClick={() => setTaskFilter(k)}
                        key={k}
                      >
                        {t(k)}
                      </button>
                    ))}
                  </div>
                  {allTasks
                    .filter((task) => taskFilter === "all" || task.done === (taskFilter === "done"))
                    .map((task) => taskRow(task, task.project))}
                  {!allTasks.some(
                    (task) => taskFilter === "all" || task.done === (taskFilter === "done"),
                  ) && <p className="empty">{t("noFilteredTasks")}</p>}
                </section>
              ) : (
                <>
                  <div className="section-title">
                    <h2>
                      {t("projects")}
                      <span>{projects.length}</span>
                    </h2>
                    <div className="view-switch">
                      <button
                        aria-label={t("grid")}
                        aria-pressed={view === "grid"}
                        onClick={() => setView("grid")}
                      >
                        <LayoutGrid size={17} />
                      </button>
                      <button
                        aria-label={t("list")}
                        aria-pressed={view === "list"}
                        onClick={() => setView("list")}
                      >
                        <List size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="toolbar">
                    <div className="filter-tabs">
                      {["all", ...statuses].map((k) => (
                        <button
                          className={filter === k ? "active" : ""}
                          onClick={() => setFilter(k)}
                          key={k}
                        >
                          {t(k)}
                        </button>
                      ))}
                    </div>
                    <div className="search-sort">
                      <label className="search-box">
                        <Search size={16} />
                        <input
                          aria-label={t("search")}
                          placeholder={t("search")}
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                      </label>
                      <select
                        aria-label={t("sort")}
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                      >
                        {["newest", "dueSoon", "alphabetical"].map((k) => (
                          <option key={k} value={k}>
                            {t(k)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className={"project-grid " + (view === "list" ? "list-view" : "")}>
                    {filtered.map((p) => (
                      <button
                        className="project-card"
                        key={p.id}
                        onClick={() => {
                          setSelected(p.id);
                          setTaskTitle("");
                        }}
                      >
                        <div className="card-top">
                          <span
                            className="project-icon"
                            style={{
                              color: p.color,
                              background: p.color + "18",
                            }}
                          >
                            <FolderKanban size={23} />
                          </span>
                          <span className={"status " + p.status}>
                            <i />
                            {t(p.status)}
                          </span>
                          <ArrowUpRight className="card-arrow" size={17} />
                        </div>
                        <h3>{p.name}</h3>
                        <p className="description">{p.description || "—"}</p>
                        <div className="progress-heading">
                          <span>{t("progress")}</span>
                          <strong>{progress(p)}%</strong>
                        </div>
                        <div className="progress-track">
                          <span
                            style={{
                              width: progress(p) + "%",
                              background: p.color,
                            }}
                          />
                        </div>
                        <div className="card-task-count">
                          <ListTodo size={13} />
                          {t("taskCount", {
                            done: p.tasks.filter((task) => task.done).length,
                            total: p.tasks.length,
                          })}
                        </div>
                        <div className="card-footer">
                          <span className="owner">
                            <span
                              className="avatar small"
                              style={{
                                background: p.color + "20",
                                color: p.color,
                              }}
                            >
                              {p.owner
                                ? p.owner
                                    .split(" ")
                                    .map((n) => n[0])
                                    .slice(0, 2)
                                    .join("")
                                : "?"}
                            </span>
                            <span>{p.owner || t("unassigned")}</span>
                          </span>
                          <span className="date">
                            <CalendarDays size={13} />
                            {date(p.due)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                  {filtered.length === 0 && (
                    <div className="empty">
                      <FolderKanban size={38} />
                      <h2>{t(projects.length ? "noResults" : "noProjects")}</h2>
                      <p>{t(projects.length ? "trySearch" : "emptyText")}</p>
                      <Button
                        onClick={
                          projects.length
                            ? () => {
                                setFilter("all");
                                setQuery("");
                              }
                            : newProject
                        }
                      >
                        {t(projects.length ? "clear" : "newProject")}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </main>
        <footer>
          stride. <span>{t("tagline")}</span>
        </footer>
      </div>
      <Dialog
        open={!!current}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="detail-dialog" showCloseButton={false}>
          <DialogHeader>
            <div className="dialog-heading">
              <DialogTitle>{current?.name}</DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("close")}
                onClick={() => setSelected(null)}
              >
                <X />
              </Button>
            </div>
            <DialogDescription>{current?.description || t("details")}</DialogDescription>
          </DialogHeader>
          {current && (
            <>
              {error && (
                <p role="alert" className="danger-text">
                  {t(error)}
                </p>
              )}
              <div className="detail-meta">
                <span className={"status " + current.status}>{t(current.status)}</span>
                <span>
                  {t("priority")}: {t(current.priority)}
                </span>
                <span>{current.owner || t("unassigned")}</span>
                <span>{date(current.due)}</span>
              </div>
              <div className="progress-heading">
                <span>{t("progress")}</span>
                <strong>{progress(current)}%</strong>
              </div>
              <div className="progress-track">
                <span
                  style={{
                    width: progress(current) + "%",
                    background: current.color,
                  }}
                />
              </div>
              <p className="helper">{t("completionNote")}</p>
              <h3>
                {t("taskList")}{" "}
                <span className="muted">
                  {current.tasks.filter((task) => task.done).length}/{current.tasks.length}
                </span>
              </h3>
              <div className="detail-tasks">
                {current.tasks.map((task) => taskRow(task))}
                {!current.tasks.length && <p className="helper">{t("noTasks")}</p>}
              </div>
              <form
                className="task-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (taskTitle.trim())
                    void mutate(
                      `/projects/${current.id}/tasks`,
                      "POST",
                      { title: taskTitle },
                      "taskAdded",
                      () => setTaskTitle(""),
                    );
                }}
              >
                <input
                  aria-label={t("taskName")}
                  placeholder={t("addTask")}
                  maxLength={200}
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  required
                />
                <Button disabled={busy || !taskTitle.trim()} type="submit">
                  <Plus size={16} />
                  {t("add")}
                </Button>
              </form>
              <div className="dialog-actions">
                <Button variant="outline" onClick={() => editProject(current)}>
                  <Pencil size={15} />
                  {t("edit")}
                </Button>
                <Button
                  className="danger-text"
                  variant="ghost"
                  onClick={() => setDeleting(current)}
                >
                  <Trash2 size={15} />
                  {t("delete")}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!editor}
        onOpenChange={(open) => {
          if (!open && !busy) setEditor(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t(editId ? "edit" : "newProject")}</DialogTitle>
            <DialogDescription>{t("details")}</DialogDescription>
          </DialogHeader>
          {editor && (
            <form className="project-form" onSubmit={saveProject}>
              <label>
                {t("name")}
                <input
                  required
                  maxLength={120}
                  value={editor.name}
                  onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                />
              </label>
              <label>
                {t("description")}
                <textarea
                  maxLength={2000}
                  rows={3}
                  value={editor.description}
                  onChange={(e) => setEditor({ ...editor, description: e.target.value })}
                />
              </label>
              <div className="form-grid">
                <OwnerPicker
                  users={users}
                  label={t("owner")}
                  value={editor.ownerIds}
                  onChange={(ownerIds) =>
                    setEditor({
                      ...editor,
                      ownerIds,
                      ownerId: ownerIds[0] ?? null,
                      owner: users
                        .filter((u) => ownerIds.includes(u.id))
                        .map((u) => u.name)
                        .join(", "),
                    })
                  }
                />
                <label>
                  {t("due")}
                  <input
                    type="date"
                    value={editor.due}
                    onChange={(e) => setEditor({ ...editor, due: e.target.value })}
                  />
                </label>
                <label>
                  {t("status")}
                  <select
                    value={editor.status}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        status: e.target.value as Project["status"],
                      })
                    }
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {t(s)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("priority")}
                  <select
                    value={editor.priority}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        priority: e.target.value as Project["priority"],
                      })
                    }
                  >
                    {["low", "medium", "high"].map((s) => (
                      <option key={s} value={s}>
                        {t(s)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="color-field">
                {t("color")}
                <input
                  type="color"
                  value={editor.color}
                  onChange={(e) => setEditor({ ...editor, color: e.target.value })}
                />
              </label>
              {error && (
                <p role="alert" className="danger-text">
                  {t(error)}
                </p>
              )}
              <div className="form-actions">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setEditor(null)}
                >
                  {t("cancel")}
                </Button>
                <Button disabled={busy || !editor.name.trim()} type="submit">
                  {t(busy ? "saving" : editId ? "save" : "create")}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!renaming}
        onOpenChange={(open) => {
          if (!open && !busy) setRenaming(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("editTask")}</DialogTitle>
            <DialogDescription>{t("taskName")}</DialogDescription>
          </DialogHeader>
          <form
            className="project-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (renaming)
                void mutate(
                  `/tasks/${renaming.id}`,
                  "PATCH",
                  { title: renameTitle },
                  "taskSaved",
                  () => setRenaming(null),
                );
            }}
          >
            <input
              aria-label={t("taskName")}
              required
              maxLength={200}
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
            />
            {error && <p role="alert">{t(error)}</p>}
            <div className="form-actions">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setRenaming(null)}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={busy || !renameTitle.trim()}>
                {t("save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!assigning}
        onOpenChange={(open) => {
          if (!open && !busy) setAssigning(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("taskOwner")}</DialogTitle>
            <DialogDescription>{assigning?.title}</DialogDescription>
          </DialogHeader>
          <form
            className="project-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (assigning)
                void mutate(
                  `/tasks/${assigning.id}`,
                  "PATCH",
                  { ownerIds: assignedOwner },
                  "taskSaved",
                  () => setAssigning(null),
                );
            }}
          >
            <OwnerPicker
              users={users}
              label={t("taskOwner")}
              value={assignedOwner}
              onChange={setAssignedOwner}
              disabled={busy}
            />
            {error && (
              <p role="alert" className="danger-text">
                {t(error)}
              </p>
            )}
            <div className="form-actions">
              <Button
                variant="outline"
                type="button"
                disabled={busy}
                onClick={() => setAssigning(null)}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={busy}>
                {t("save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDelete", { name: deleting?.name })}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteWarning")}</AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p role="alert">{t(error)}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("cancel")}</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => {
                if (deleting)
                  void mutate(`/projects/${deleting.id}`, "DELETE", undefined, "deleted", () => {
                    setDeleting(null);
                    setSelected(null);
                  });
              }}
            >
              {t("remove")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {notice && (
        <output className="toast">
          <CircleCheck size={18} />
          {t(notice)}
        </output>
      )}
    </div>
  );
}
