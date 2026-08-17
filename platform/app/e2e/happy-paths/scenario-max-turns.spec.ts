import { expect, test } from "@playwright/test";

test.use({
  storageState: "./e2e/auth.json",
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
 * 5. Cleanup: archive the created scenario
 */
/** @scenario "A turn cap set in the scenario editor survives saving and reopening" */
test("Scenario turn cap survives saving and reopening", async ({ page }) => {
  const scenarioName = `E2E Max Turns ${Date.now()}`;

  await page.goto(SCENARIOS_URL);

  // Create: New Scenario -> manual path -> blank editor drawer
  await page.getByRole("button", { name: "New Scenario" }).click();
  await page.getByRole("button", { name: "Build it myself" }).click();
  await page.getByRole("button", { name: "Open blank editor" }).click();

  await page.getByPlaceholder("e.g., Angry refund request").fill(scenarioName);
  await page
    .getByPlaceholder(
      "e.g., A frustrated premium subscriber who was charged twice...",
    )
    .fill("A user asks the agent a simple question.");
  await page.getByLabel("Maximum turns").fill("2");

  await page.getByRole("button", { name: "Save and Run" }).click();
  await page.getByText("Save without running").click();
  await page.getByText("Scenario created").click();

  // Reopen: the cap survived the save
  await page.getByText(scenarioName).click();
  await expect(page.getByLabel("Maximum turns")).toHaveValue("2");

  // Clear the cap and save
  await page.getByLabel("Maximum turns").fill("");
  await page.getByRole("button", { name: "Save and Run" }).click();
  await page.getByText("Save without running").click();
  await page.getByText("Scenario updated").click();

  // Reopen: the field is empty, so the default applies
  await page.getByText(scenarioName).click();
  await expect(page.getByLabel("Maximum turns")).toHaveValue("");
  await page.getByRole("button", { name: "Cancel" }).click();

  // Cleanup: archive the scenario this test created
  await page
    .getByRole("button", { name: `Actions for ${scenarioName}` })
    .click();
  await page.getByRole("menuitem", { name: "Archive" }).click();
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(page.getByText(scenarioName)).toBeHidden();
});
