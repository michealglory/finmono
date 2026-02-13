import { expect, test } from "@playwright/test";

test("auth redirect and app navigation smoke", async ({ page }) => {
  const email = `pw.${Date.now()}@example.com`;
  const password = "QaPass123!";

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/accounts");
  await page.getByPlaceholder("GTBank Naira").fill("E2E NGN");
  await page.getByPlaceholder("Institution").fill("E2E Bank");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("cell", { name: "E2E NGN" })).toBeVisible();

  const accountsRes = await page.request.get("/api/accounts");
  const accountsData = await accountsRes.json();
  const accountId = accountsData.accounts[0].id as string;

  await page.goto("/categories");
  await page.getByRole("heading", { name: "Create category/subcategory" }).isVisible();

  const majorRes = await page.request.post("/api/categories", {
    data: { name: "E2E Feeding", level: 1 }
  });
  const major = await majorRes.json();

  const subRes = await page.request.post("/api/categories", {
    data: { name: "E2E Rice", level: 2, parentId: major.category.id }
  });
  const sub = await subRes.json();

  const txCreate = await page.request.post("/api/transactions", {
    data: {
      accountId,
      categoryId: sub.category.id,
      direction: "EXPENSE",
      description: "E2E Bought rice",
      merchantName: "E2E Market",
      amountOriginal: 4200,
      originalCurrency: "NGN",
      transactionDate: new Date().toISOString().slice(0, 10)
    }
  });
  expect(txCreate.ok()).toBeTruthy();
  const txCreatePayload = await txCreate.json();
  expect(txCreatePayload.transaction?.id).toBeTruthy();

  await page.goto("/transactions");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Transaction drill-down")).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Per Account Totals")).toBeVisible();
  await expect(page.getByText("Category Breakdown")).toBeVisible();

  await page.goto("/imports");
  await expect(page.getByRole("heading", { name: "AI Import Wizard" })).toBeVisible();

  const deleteRes = await page.request.post("/api/settings/delete-data");
  expect(deleteRes.ok()).toBeTruthy();

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
