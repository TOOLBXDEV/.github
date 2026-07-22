import { chromium } from "playwright";

const PORTAL_ID = "49044619";

const REPORTS = [
  { id: "163424575", name: "Closed Won ARR QTD" },
  { id: "163425434", name: "Avg Deal Size QTD" },
  { id: "161692258", name: "Key Pipeline Metrics" },
];

async function ss(page, label) {
  await page.screenshot({
    path: `/Users/normankuan/Documents/toolbx-sales-hub/scripts/screenshots/${label}.png`,
  });
}

async function main() {
  console.log("=== HubSpot Report ARR Swap (drag-and-drop) ===\n");

  const browser = await chromium.launchPersistentContext(
    "/tmp/hubspot-playwright-profile",
    {
      headless: false,
      channel: "chrome",
      viewport: { width: 1440, height: 900 },
      args: ["--disable-blink-features=AutomationControlled"],
    }
  );

  const page = browser.pages()[0] || (await browser.newPage());
  await page.goto(`https://app.hubspot.com/reports-dashboard/${PORTAL_ID}/view/19122249`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.waitForTimeout(5000);

  if ((await page.title()).toLowerCase().includes("login")) {
    console.log("Please log in. Waiting...");
    while ((await page.title()).toLowerCase().includes("login")) await page.waitForTimeout(3000);
    await page.waitForTimeout(5000);
  }
  console.log("Session active.\n");

  let updated = 0;

  for (const report of REPORTS) {
    console.log(`\n${"=".repeat(50)}`);
    console.log(`Report: ${report.name} (ID: ${report.id})`);

    try {
      await page.goto(
        `https://app.hubspot.com/report-builder/${PORTAL_ID}/report/${report.id}`,
        { waitUntil: "domcontentloaded", timeout: 30_000 }
      );
      await page.waitForTimeout(10_000);

      // STEP 1: Drag "Annual Recurring Revenue (ARR)" from Available to Displaying
      console.log("  [1] Dragging new field to Displaying...");

      // Find the source element (new field in Available properties)
      const sourceEl = page.locator('text="Annual Recurring Revenue (ARR)"').first();
      
      // Find the target area (Displaying section / drop zone)
      // Look for the "Drag & drop to display" text OR the Displaying area
      const dropZone = page.locator('text="Drag & drop to display"').first();
      const displayingLabel = page.locator('text="Displaying:"').first();

      let dragTarget;
      if (await dropZone.isVisible({ timeout: 3000 }).catch(() => false)) {
        dragTarget = dropZone;
        console.log("  Drop zone found (empty Displaying area).");
      } else if (await displayingLabel.isVisible({ timeout: 3000 }).catch(() => false)) {
        dragTarget = displayingLabel;
        console.log("  Displaying label found as target.");
      } else {
        console.log("  No drop target found.");
        continue;
      }

      if (await sourceEl.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Use Playwright's dragTo
        await sourceEl.dragTo(dragTarget);
        await page.waitForTimeout(3000);
        console.log("  Drag completed.");

        // Check if it worked
        const aggBtn = await page.$('[data-test-id*="aggregation-selector"][data-test-id*="annual_recurring_revenue_w_est"]');
        if (aggBtn) {
          console.log("  New field is now in Displaying!");
        } else {
          console.log("  Drag may not have worked. Trying manual mouse drag...");

          // Manual drag simulation
          const sourceBox = await sourceEl.boundingBox();
          const targetBox = await dragTarget.boundingBox();

          if (sourceBox && targetBox) {
            const srcX = sourceBox.x + sourceBox.width / 2;
            const srcY = sourceBox.y + sourceBox.height / 2;
            const tgtX = targetBox.x + targetBox.width / 2;
            const tgtY = targetBox.y + targetBox.height / 2;

            console.log(`  Dragging from (${srcX}, ${srcY}) to (${tgtX}, ${tgtY})`);

            await page.mouse.move(srcX, srcY);
            await page.waitForTimeout(200);
            await page.mouse.down();
            await page.waitForTimeout(200);

            // Move in steps for drag detection
            const steps = 10;
            for (let i = 1; i <= steps; i++) {
              const x = srcX + ((tgtX - srcX) * i) / steps;
              const y = srcY + ((tgtY - srcY) * i) / steps;
              await page.mouse.move(x, y);
              await page.waitForTimeout(50);
            }

            await page.waitForTimeout(200);
            await page.mouse.up();
            await page.waitForTimeout(2000);
            console.log("  Manual drag completed.");
          }
        }
      } else {
        console.log("  Source field not visible. Checking if already displayed...");
      }

      await ss(page, `after-drag-${report.id}`);

      // Verify the field is displayed
      const displayContent = await page.evaluate(() => {
        const section = Array.from(document.querySelectorAll("*")).find(
          (el) => {
            const direct = Array.from(el.childNodes)
              .filter((n) => n.nodeType === Node.TEXT_NODE)
              .map((n) => n.textContent.trim())
              .join("");
            return direct === "Displaying:";
          }
        );
        if (!section?.parentElement) return "section not found";
        return section.parentElement.textContent?.substring(0, 200);
      });
      console.log(`  Displaying section: ${displayContent}`);

      // STEP 2: Save
      console.log("  [2] Saving...");
      const updateBtn = page.locator('button:has-text("Update existing rep")').first();
      if (await updateBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await updateBtn.click();
        await page.waitForTimeout(5000);
        console.log("  SAVED!");
        updated++;
      } else {
        console.log("  Update button not visible.");
        await ss(page, `no-save-${report.id}`);
      }

      await ss(page, `done6-${report.id}`);
    } catch (err) {
      console.log(`  ERROR: ${err.message}`);
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Done! Updated ${updated}/${REPORTS.length} reports.`);
  console.log("Browser open for 30s...");
  await page.waitForTimeout(30_000);
  await browser.close();
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
