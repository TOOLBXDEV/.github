import { chromium } from "playwright";

const PORTAL_ID = "49044619";

async function ss(page, label) {
  await page.screenshot({
    path: `/Users/normankuan/Documents/toolbx-sales-hub/scripts/screenshots/${label}.png`,
  });
}

async function main() {
  console.log("=== Fix Reports 2 & 3 ===\n");

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

  // ===== FIX REPORT 2: Avg Deal Size QTD - Change aggregation from Sum to Average =====
  console.log("=== Report 2: Avg Deal Size QTD (163425434) ===");
  console.log("  Need to change aggregation from Sum to Average");

  await page.goto(
    `https://app.hubspot.com/report-builder/${PORTAL_ID}/report/163425434`,
    { waitUntil: "domcontentloaded", timeout: 30_000 }
  );
  await page.waitForTimeout(10_000);

  // Click the "Sum" aggregation button to open dropdown
  const aggBtn = page.locator('[data-test-id*="aggregation-selector"][data-test-id*="annual_recurring_revenue_w_est"]');
  if (await aggBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log("  Found aggregation selector. Clicking...");
    await aggBtn.click();
    await page.waitForTimeout(1500);

    // Find and click "Average" in the dropdown
    const avgOption = page.locator('text="Average"').first();
    if (await avgOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await avgOption.click();
      await page.waitForTimeout(2000);
      console.log("  Changed to Average.");
    } else {
      console.log("  Average option not visible. Checking dropdown...");
      await ss(page, "fix-r2-dropdown");
    }
  } else {
    console.log("  Aggregation selector not found.");
    await ss(page, "fix-r2-no-agg");
  }

  await ss(page, "fix-r2-after");

  // Save
  const updateBtn2 = page.locator('button:has-text("Update existing rep")').first();
  if (await updateBtn2.isVisible({ timeout: 3000 }).catch(() => false)) {
    await updateBtn2.click();
    await page.waitForTimeout(5000);
    console.log("  Report 2 SAVED!");
  }

  // ===== FIX REPORT 3: Key Pipeline Metrics (161692258) =====
  console.log("\n=== Report 3: Key Pipeline Metrics (161692258) ===");
  console.log("  Need to: remove (Count) Deals, drag Annual Recurring Revenue (ARR) to Displaying");

  await page.goto(
    `https://app.hubspot.com/report-builder/${PORTAL_ID}/report/161692258`,
    { waitUntil: "domcontentloaded", timeout: 30_000 }
  );
  await page.waitForTimeout(10_000);

  await ss(page, "fix-r3-initial");

  // First diagnose what's in Displaying
  const r3State = await page.evaluate(() => {
    const results = [];
    // Find all aggregation-selector buttons (these indicate displayed fields)
    const aggBtns = document.querySelectorAll('[data-test-id*="aggregation-selector"]');
    for (const btn of aggBtns) {
      results.push(`Displayed: ${btn.getAttribute("data-test-id")} text="${btn.textContent?.trim()}"`);
    }

    // Find all draggable fields
    const draggables = document.querySelectorAll('[data-test-id*="draggable-field"]');
    for (const d of draggables) {
      const rect = d.getBoundingClientRect();
      results.push(`Draggable: ${d.getAttribute("data-test-id")} text="${d.textContent?.trim().substring(0, 40)}" y=${Math.round(rect.y)}`);
    }

    return results;
  });

  for (const line of r3State) {
    console.log(`  ${line}`);
  }

  // Remove the current "(Count) Deals" from Displaying using × click
  const countDealsText = await page.$('text="(Count) Deals"');
  if (countDealsText) {
    // Check if it's in the Displaying area (y-position should be around 260-310)
    const box = await countDealsText.boundingBox();
    if (box && box.y < 400) {
      console.log("  Removing (Count) Deals from Displaying...");
      // Click × to the right
      const xPos = box.x + box.width + 12;
      const yPos = box.y + box.height / 2;
      await page.mouse.click(xPos, yPos);
      await page.waitForTimeout(2000);
    }
  }

  await ss(page, "fix-r3-after-remove");

  // Now drag "Annual Recurring Revenue (ARR)" to the Displaying section
  const sourceEl = page.locator('text="Annual Recurring Revenue (ARR)"').first();
  const dropZone = page.locator('text="Drag & drop to display"').first();
  const displayingLabel = page.locator('text="Displaying:"').first();

  let dragTarget;
  if (await dropZone.isVisible({ timeout: 3000 }).catch(() => false)) {
    dragTarget = dropZone;
    console.log("  Found empty drop zone.");
  } else if (await displayingLabel.isVisible({ timeout: 3000 }).catch(() => false)) {
    dragTarget = displayingLabel;
    console.log("  Using Displaying label as target.");
  }

  if (await sourceEl.isVisible({ timeout: 3000 }).catch(() => false)) {
    if (dragTarget) {
      console.log("  Dragging Annual Recurring Revenue (ARR) to Displaying...");
      
      const sourceBox = await sourceEl.boundingBox();
      const targetBox = await dragTarget.boundingBox();

      if (sourceBox && targetBox) {
        const srcX = sourceBox.x + sourceBox.width / 2;
        const srcY = sourceBox.y + sourceBox.height / 2;
        const tgtX = targetBox.x + targetBox.width / 2;
        const tgtY = targetBox.y + targetBox.height / 2;

        console.log(`  Drag: (${Math.round(srcX)}, ${Math.round(srcY)}) -> (${Math.round(tgtX)}, ${Math.round(tgtY)})`);

        // Try Playwright dragTo first
        await sourceEl.dragTo(dragTarget);
        await page.waitForTimeout(3000);

        // Check if it worked
        const newAgg = await page.$('[data-test-id*="aggregation-selector"][data-test-id*="annual_recurring_revenue_w_est"]');
        if (newAgg) {
          console.log("  Drag successful! New field in Displaying.");
        } else {
          console.log("  dragTo didn't work. Trying manual mouse drag...");

          // Manual drag with steps
          await page.mouse.move(srcX, srcY);
          await page.waitForTimeout(300);
          await page.mouse.down();
          await page.waitForTimeout(300);

          const steps = 15;
          for (let i = 1; i <= steps; i++) {
            await page.mouse.move(
              srcX + ((tgtX - srcX) * i) / steps,
              srcY + ((tgtY - srcY) * i) / steps
            );
            await page.waitForTimeout(50);
          }

          await page.waitForTimeout(300);
          await page.mouse.up();
          await page.waitForTimeout(3000);

          const newAgg2 = await page.$('[data-test-id*="aggregation-selector"][data-test-id*="annual_recurring_revenue_w_est"]');
          console.log(`  Manual drag result: ${newAgg2 ? "SUCCESS" : "FAILED"}`);
        }
      }
    }
  } else {
    console.log("  Annual Recurring Revenue (ARR) not visible in Available.");
  }

  await ss(page, "fix-r3-after-drag");

  // Save
  const updateBtn3 = page.locator('button:has-text("Update existing rep")').first();
  if (await updateBtn3.isVisible({ timeout: 3000 }).catch(() => false)) {
    await updateBtn3.click();
    await page.waitForTimeout(5000);
    console.log("  Report 3 SAVED!");
  } else {
    console.log("  Update button not visible.");
  }

  await ss(page, "fix-r3-final");

  console.log("\n=== Done! ===");
  console.log("Browser open for 30s...");
  await page.waitForTimeout(30_000);
  await browser.close();
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
