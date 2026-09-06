/* oxlint-disable jsx-a11y/prefer-tag-over-role -- Custom ARIA combobox supports rich user/tag suggestions and chips that native select cannot render. */
import { useId, useRef, useState } from "react";
import { Popover } from "radix-ui";
import { Check, ChevronDown, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { User } from "../types";

export function OwnerPicker({
  users,
  value,
  onChange,
  label,
  disabled = false,
}: {
  users: User[];
  value: number[];
  onChange: (ids: number[]) => void;
  label: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const matching = users.filter(
    (u) =>
      !value.includes(u.id) &&
      `${u.name} ${u.tags.join(" ")}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  );
  const index = Math.min(active, Math.max(0, matching.length - 1));
  const selected = value
    .map((userId) => users.find((u) => u.id === userId))
    .filter((u): u is User => !!u);
  function add(user: User) {
    if (disabled || value.includes(user.id)) return;
    onChange([...value, user.id]);
    setQuery("");
    setActive(0);
    input.current?.focus();
    setOpen(false);
  }
  function remove(userId: number) {
    onChange(value.filter((id) => id !== userId));
    input.current?.focus();
    setOpen(false);
  }
  return (
    <Popover.Root open={open && !disabled} onOpenChange={setOpen}>
      <div className="owner-picker">
        <label htmlFor={id}>{label}</label>
        <Popover.Anchor asChild>
          <div className={`owner-input ${disabled ? "disabled" : ""}`}>
            {selected.map((user) => (
              <span className="owner-chip" key={user.id}>
                <span className="owner-chip-avatar">{user.name.slice(0, 1)}</span>
                <span className="owner-chip-name">{user.name}</span>
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={t("removeOwner", { name: user.name })}
                  onClick={() => remove(user.id)}
                >
                  <X size={13} />
                </button>
              </span>
            ))}
            <input
              ref={input}
              id={id}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={open}
              aria-controls={`${id}-list`}
              aria-describedby={`${id}-hint`}
              aria-activedescendant={
                open && matching.length ? `${id}-option-${matching[index].id}` : undefined
              }
              autoComplete="off"
              placeholder={t(selected.length ? "addOwners" : "searchUsers")}
              disabled={disabled}
              value={query}
              onFocus={() => setOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  setOpen(true);
                  const next = matching.length
                    ? (index + (e.key === "ArrowDown" ? 1 : -1) + matching.length) % matching.length
                    : 0;
                  setActive(open ? next : 0);
                  document
                    .getElementById(`${id}-option-${matching[open ? next : 0]?.id}`)
                    ?.scrollIntoView({ block: "nearest" });
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (open && matching[index]) add(matching[index]);
                  else setOpen(true);
                } else if (e.key === "Escape" && open) {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                } else if (e.key === "Backspace" && !query && value.length) {
                  onChange(value.slice(0, -1));
                  setOpen(false);
                }
              }}
            />
            <button
              className="owner-toggle"
              type="button"
              disabled={disabled}
              aria-label={t("showOwners")}
              onClick={() => {
                if (open) setOpen(false);
                else {
                  input.current?.focus();
                  setOpen(true);
                }
              }}
            >
              <ChevronDown size={16} />
            </button>
          </div>
        </Popover.Anchor>
        <span id={`${id}-hint`} className="helper">
          {t("ownersHint")}
        </span>
        {open && !disabled && (
          <Popover.Portal>
            <Popover.Content
              role="presentation"
              className="owner-suggestions"
              align="start"
              sideOffset={5}
              collisionPadding={12}
              onOpenAutoFocus={(e) => e.preventDefault()}
              onCloseAutoFocus={(e) => e.preventDefault()}
              onInteractOutside={(e) => {
                if (e.target instanceof Node && input.current?.parentElement?.contains(e.target))
                  e.preventDefault();
              }}
            >
              <div id={`${id}-list`} role="listbox" aria-label={label}>
                {matching.map((user, i) => (
                  <button
                    type="button"
                    tabIndex={-1}
                    key={user.id}
                    role="option"
                    aria-selected={i === index}
                    id={`${id}-option-${user.id}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => add(user)}
                  >
                    <span className="avatar small">{user.name.slice(0, 1)}</span>
                    <span className="owner-suggestion-copy">
                      <strong>{user.name}</strong>
                      {user.tags.length > 0 && <small>{user.tags.join(" · ")}</small>}
                    </span>
                    {i === index && <Check size={14} />}
                  </button>
                ))}
              </div>
              {!matching.length && (
                <output className="helper owner-empty">{t("noUsersMatch")}</output>
              )}
            </Popover.Content>
          </Popover.Portal>
        )}
      </div>
    </Popover.Root>
  );
}
