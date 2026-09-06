import { test, expect } from "@playwright/test";
test("tagged users can own projects and tasks, and be found and renamed", async ({ page }) => {
  const name = "Owner " + Date.now();
  const projectName = "Assigned " + Date.now();
  await page.goto("/");
  await page.getByRole("button", { name: "Users", exact: true }).click();
  await page.getByRole("button", { name: "Add user", exact: true }).click();
  await page.getByRole("textbox", { name: "User name", exact: true }).fill(name);
  await page.getByRole("textbox", { name: "Tags", exact: true }).fill("Design, 中文");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search users by name or tag…", exact: true })
    .fill("中文");
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search users by name or tag…", exact: true })
    .fill("no-matching-user");
  await expect(page.getByRole("heading", { name: "No matching users" })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await page.getByRole("combobox", { name: "Filter by tag", exact: true }).selectOption("Design");
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Projects", exact: false }).first().click();
  await page.getByRole("button", { name: "New project", exact: true }).first().click();
  await page.getByRole("textbox", { name: "Project name", exact: true }).fill(projectName);
  await page.getByRole("combobox", { name: "Project owner", exact: true }).fill("中文");
  await page.getByRole("option", { name: new RegExp(name) }).click();
  await page.getByRole("button", { name: "Create project", exact: true }).click();
  await page
    .getByRole("button")
    .filter({ has: page.getByRole("heading", { name: projectName, exact: true }) })
    .click();
  await expect(page.getByRole("dialog").getByText(name, { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Task name", exact: true }).fill("Assigned item");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByRole("button", { name: "Assign owner for Assigned item", exact: true }).click();
  await page.getByRole("combobox", { name: "Task owner", exact: true }).fill(name);
  await page.getByRole("combobox", { name: "Task owner", exact: true }).press("Enter");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Assign owner for Assigned item", exact: true }),
  ).toContainText(name);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Users", exact: true }).click();
  await page.getByRole("button", { name: `Edit ${name}`, exact: true }).click();
  await page.getByRole("textbox", { name: "User name", exact: true }).fill(name + " updated");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("heading", { name: name + " updated", exact: true })).toBeVisible();
  await page.reload();
  await page
    .getByRole("button")
    .filter({ has: page.getByRole("heading", { name: projectName, exact: true }) })
    .click();
  await expect(
    page.getByRole("button", { name: "Assign owner for Assigned item", exact: true }),
  ).toContainText(name + " updated");
  await page.getByRole("button", { name: "Assign owner for Assigned item", exact: true }).click();
  await page.getByRole("button", { name: `Remove ${name} updated`, exact: true }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Assign owner for Assigned item", exact: true }),
  ).toContainText("Unassigned");
  await page.getByRole("button", { name: "Delete project", exact: true }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
});

test("email-style picker saves multiple owners and supports keyboard removal", async ({ page }) => {
  const suffix = Date.now();
  const first = "Alice " + suffix,
    second = "Bob " + suffix;
  const userA = await (
    await page.request.post("/api/users", { data: { name: first, tags: ["Design"] } })
  ).json();
  const userB = await (
    await page.request.post("/api/users", { data: { name: second, tags: ["Engineering"] } })
  ).json();
  const projectName = "Multi " + suffix;
  await page.goto("/");
  await page.getByRole("button", { name: "New project", exact: true }).first().click();
  await page.getByRole("textbox", { name: "Project name", exact: true }).fill(projectName);
  const picker = page.getByRole("combobox", { name: "Project owner", exact: true });
  await picker.fill(first);
  await picker.press("Enter");
  await expect(page.getByRole("button", { name: `Remove ${first}`, exact: true })).toBeVisible();
  await picker.fill(second);
  await picker.press("Enter");
  await expect(page.getByRole("button", { name: `Remove ${second}`, exact: true })).toBeVisible();
  await picker.fill(first);
  await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(0);
  await picker.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await page.getByRole("button", { name: "Create project", exact: true }).click();
  const rows = await (await page.request.get("/api/projects")).json();
  const project = rows.find((p: { name: string }) => p.name === projectName);
  expect(project.ownerIds).toEqual([userA.id, userB.id]);
  await page.request.post(`/api/projects/${project.id}/tasks`, {
    data: { title: "Multiple owners", ownerIds: [userA.id, userB.id] },
  });
  await page.reload();
  await page
    .getByRole("button")
    .filter({ has: page.getByRole("heading", { name: projectName, exact: true }) })
    .click();
  await page.getByRole("button", { name: "Assign owner for Multiple owners", exact: true }).click();
  await expect(page.getByRole("button", { name: `Remove ${first}`, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: `Remove ${second}`, exact: true })).toBeVisible();
  const taskPicker = page.getByRole("combobox", { name: "Task owner", exact: true });
  await taskPicker.focus();
  await taskPicker.press("Backspace");
  await expect(page.getByRole("button", { name: `Remove ${second}`, exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Assign owner for Multiple owners", exact: true }),
  ).toContainText(first);
  const saved = await (await page.request.get("/api/projects")).json();
  expect(saved.find((p: { id: number }) => p.id === project.id).tasks[0].ownerIds).toEqual([
    userA.id,
  ]);
  await page.request.delete(`/api/projects/${project.id}`);
});
