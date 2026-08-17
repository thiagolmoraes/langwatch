import { expect, test } from "@playwright/test";

// storageState comes from the shared config (e2e/playwright.config.ts).
test.use({
  actionTimeout: 20000,
});

test.setTimeout(90000);

// Same convention as the other happy-path specs: the URL and project slug
// are hardcoded and belong to the local environment auth.json was saved
// against (see e2e/save-auth-state.ts).
const SCENARIOS_URL = "http://localhost:5560/fyes-lT_hZ2/simulations/scenarios";

/**
 * Happy path for the per-scenario turn cap:
 * 1. Create a scenario with Maximum turns 2 and save
 * 2. Reopen it — the cap is still there
 * 3. Clear the cap and save
 * 4. Reopen it — the field is empty (default applies)
 * 5. Cleanup: archive the created scenario (runs even on mid-test failure)
 */
/** @scenario "A turn cap set in the scenario editor survives saving and reopening" */
test("Scenario turn cap survives saving and reopening", async ({ page }) => {
  const scenarioName = `E2E Max Turns ${Date.now()}`;

  await page.goto(SCENARIOS_URL);

  try {
    // Create: New Scenario -> manual path -> blank editor drawer
    await page.getByRole("button", { name: "New Scenario" }).click();
    await page.getByRole("button", { name: "Build it myself" }).click();
    await page.getByRole("button", { name: "Open blank editor" }).click();

    await page
      .getByPlaceholder("e.g., Angry refund request")
      .fill(scenarioName);
    await page
      .getByPlaceholder(
        "e.g., A frustrated premium subscriber who was charged twice...",
      )
      .fill("A user asks the agent a simple question.");
    await page.getByLabel("Maximum turns").fill("2");

    await page.getByRole("button", { name: "Save and Run" }).click();
    await page.getByText("Save without running").click();
    await expect(page.getByText("Scenario created")).toBeVisible();

    // Reopen: the cap survived the save
    await page.getByText(scenarioName).click();
    await expect(page.getByLabel("Maximum turns")).toHaveValue("2");

    // Clear the cap and save
    await page.getByLabel("Maximum turns").fill("");
    await page.getByRole("button", { name: "Save and Run" }).click();
    await page.getByText("Save without running").click();
    await expect(page.getByText("Scenario updated")).toBeVisible();

    // Reopen: the field is empty, so the default applies
    await page.getByText(scenarioName).click();
    await expect(page.getByLabel("Maximum turns")).toHaveValue("");
    await page.getByRole("button", { name: "Cancel" }).click();
  } finally {
    // Archive the scenario this test created, even when an assertion above
    // failed. The goto resets whatever drawer or dialog the failure left
    // open. When the create itself never happened, the actions button never
    // shows up and there is nothing to clean.
    await page.goto(SCENARIOS_URL);
    const actionsButton = page.getByRole("button", {
      name: `Actions for ${scenarioName}`,
    });
    const created = await actionsButton
      .waitFor({ state: "visible", timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    if (created) {
      await actionsButton.click();
      await page.getByRole("menuitem", { name: "Archive" }).click();
      await page.getByRole("button", { name: "Archive", exact: true }).click();
      // The confirm dialog renders the scenario name too and stays mounted
      // during the mutation, so a bare getByText(name) resolves two
      // elements and trips strict mode. The table row is unambiguous.
      await expect(page.getByRole("row", { name: scenarioName })).toBeHidden();
    }
  }
});
