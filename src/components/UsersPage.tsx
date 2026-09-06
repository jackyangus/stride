import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Search, Pencil, Users } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import type { User } from "../types";
type Props = {
  users: User[];
  busy: boolean;
  error: string;
  mutate: (
    path: string,
    method: string,
    body: unknown,
    message: string,
    after?: () => void,
  ) => Promise<void>;
};
export function UsersPage({ users, busy, error, mutate }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState(""),
    [tag, setTag] = useState(""),
    [draft, setDraft] = useState<{
      id?: number;
      name: string;
      tags: string;
    } | null>(null);
  const tags = [...new Set(users.flatMap((u) => u.tags))].sort((a, b) => a.localeCompare(b));
  const filtered = users.filter(
    (u) =>
      (!tag || u.tags.includes(tag)) &&
      `${u.name} ${u.tags.join(" ")}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">STRIDE / {t("workspace")}</p>
          <h1>{t("users")}</h1>
          <p>{t("usersSubtitle")}</p>
        </div>
        <Button onClick={() => setDraft({ name: "", tags: "" })}>
          <Plus size={17} />
          {t("addUser")}
        </Button>
      </div>
      <div className="toolbar">
        <label className="search-box user-search">
          <Search size={16} />
          <input
            aria-label={t("searchUsers")}
            placeholder={t("searchUsers")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select aria-label={t("filterTag")} value={tag} onChange={(e) => setTag(e.target.value)}>
          <option value="">{t("allTags")}</option>
          {tags.map((tag) => (
            <option key={tag}>{tag}</option>
          ))}
        </select>
      </div>
      <div className="user-grid">
        {filtered.map((user) => (
          <article className="user-card" key={user.id}>
            <div className="user-heading">
              <span className="avatar">{user.name.slice(0, 2).toLocaleUpperCase()}</span>
              <h2>{user.name}</h2>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("editUserName", { name: user.name })}
                onClick={() => setDraft({ ...user, tags: user.tags.join(", ") })}
              >
                <Pencil size={15} />
              </Button>
            </div>
            <div className="user-tags">
              {user.tags.map((tag) => (
                <button key={tag} onClick={() => setTag(tag)}>
                  {tag}
                </button>
              ))}
              {!user.tags.length && <small className="helper">{t("noTags")}</small>}
            </div>
          </article>
        ))}
      </div>
      {!filtered.length && (
        <div className="empty">
          <Users size={36} />
          <h2>{t(users.length ? "noUsersMatch" : "noUsers")}</h2>
          <p>{t(users.length ? "tryUserSearch" : "usersSubtitle")}</p>
          {users.length > 0 && (
            <Button
              variant="outline"
              onClick={() => {
                setQuery("");
                setTag("");
              }}
            >
              {t("clear")}
            </Button>
          )}
        </div>
      )}
      <Dialog
        open={!!draft}
        onOpenChange={(open) => {
          if (!open && !busy) setDraft(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t(draft?.id ? "editUser" : "addUser")}</DialogTitle>
            <DialogDescription>{t("userDetails")}</DialogDescription>
          </DialogHeader>
          {draft && (
            <form
              className="project-form"
              onSubmit={(e) => {
                e.preventDefault();
                void mutate(
                  draft.id ? `/users/${draft.id}` : "/users",
                  draft.id ? "PUT" : "POST",
                  {
                    name: draft.name,
                    tags: draft.tags
                      .split(/[,，]/)
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                  "userSaved",
                  () => setDraft(null),
                );
              }}
            >
              <label>
                {t("userName")}
                <input
                  required
                  maxLength={100}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label>
                {t("tags")}
                <input
                  maxLength={820}
                  value={draft.tags}
                  onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
                  aria-describedby="tag-help"
                />
              </label>
              <p id="tag-help" className="helper">
                {t("tagsHint")}
              </p>
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
                  onClick={() => setDraft(null)}
                >
                  {t("cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={
                    busy ||
                    !draft.name.trim() ||
                    draft.tags.split(/[,，]/).filter((s) => s.trim()).length > 20 ||
                    draft.tags.split(/[,，]/).some((s) => s.trim().length > 40)
                  }
                >
                  {t(busy ? "saving" : "save")}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
