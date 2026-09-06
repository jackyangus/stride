import { test, expect } from "@playwright/test";
test("project lifecycle, task progress, filters, preferences and responsive layout", async ({
  page,
}) => {
  await page.goto("/");
  const name = "E2E " + Date.now();
  await page.getByRole("button", { name: "New project", exact: true }).first().click();
  await page.getByLabel("Project name", { exact: true }).fill(name);
  await page.getByLabel("Description", { exact: true }).fill("Browser-tested project");

  await page.getByRole("button", { name: "Create project", exact: true }).click();
  await page
    .getByRole("button")
    .filter({ has: page.getByRole("heading", { name, exact: true }) })
    .click();
  await page.getByRole("textbox", { name: "Task name", exact: true }).fill("Build the feature");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByRole("checkbox", { name: "Build the feature" }).click();
  await expect(page.getByRole("dialog").getByText("100%", { exact: true })).toBeVisible();
  await page.reload();
  await page
    .getByRole("button")
    .filter({ has: page.getByRole("heading", { name, exact: true }) })
    .click();
  await expect(page.getByRole("checkbox", { name: "Build the feature" })).toBeChecked();
  await page.getByRole("button", { name: "Rename task", exact: true }).click();
  await page.getByRole("textbox", { name: "Task name", exact: true }).fill("Ship the feature");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Ship the feature" })).toBeChecked();
  await page.getByRole("button", { name: "Edit project", exact: true }).click();
  await page.getByRole("combobox", { name: "Status", exact: true }).selectOption("completed");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("textbox", { name: "Search projects…" }).fill("unfindable query");
  await expect(page.getByRole("heading", { name: "No matching projects" })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await page.getByRole("combobox", { name: "Appearance", exact: true }).selectOption("dark");
  await page.getByRole("combobox", { name: "Language", exact: true }).selectOption("zh");
  await page.reload();
  await expect(page.locator("html")).toHaveClass("dark");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh");
  await expect(page.getByRole("heading", { name: "清晰规划，稳步前行。" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-dark-chinese.png",
    fullPage: true,
  });
  await page.getByRole("combobox", { name: "语言", exact: true }).selectOption("en");
  await page.getByRole("combobox", { name: "Appearance", exact: true }).selectOption("light");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  await page
    .getByRole("button")
    .filter({ has: page.getByRole("heading", { name, exact: true }) })
    .click();
  await page.getByRole("button", { name: "Delete task", exact: true }).click();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page.getByRole("button", { name: "Delete project", exact: true }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toHaveCount(0);
});
