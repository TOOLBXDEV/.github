import { chromium } from "playwright";

const PORTAL_ID = "49044619";
const DASHBOARD_URL = `https://app.hubspot.com/reports-dashboard/${PORTAL_ID}/view/19122249`;

const REPORTS = [
  { id: "163424575", name: "Closed Won ARR QTD", aggregation: "Sum" },
  { id: "163425434", name: "Avg Deal Size QTD", aggregation: "Average" },
  { id: "161692258", name: "Key Pipeline Metrics", aggregation: "Sum" },
];

async function ss(page, label) {
  await page.screenshot({
    path: `/Users/normankuan/Documents/toolbx-sales-hub/scripts/screenshots/${label}.png`,
  });
}

async function main() {
  console.log("=== HubSpot Report ARR Field Swap ===\n");

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

  await page.goto(DASHBOARD_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(5000);
  if ((await page.title()).toLowerCase().includes("login")) {
    console.log("Please log in. Waiting...\n");
    while ((await page.title()).toLowerCase().includes("login")) await page.waitForTimeout(3000);
    await page.waitForTimeout(5000);
  }
  console.log("Session active.\n");

  let updated = 0;

  for (const report of REPORTS) {
    console.log(`\n${"=".repeat(50)}`);
    console.log(`Report: ${report.name} (ID: ${report.id})`);

    try {
      const url = `https://app.hubspot.com/report-builder/${PORTAL_ID}/report/${report.id}`;
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForTimeout(10_000);

      console.log("  Page:", await page.title());

      // 1. Open "Manage properties"
      console.log("  [1/5] Opening Manage properties...");
      const managePropBtn = await page.$('button:has-text("Manage properties")');
      if (!managePropBtn) { console.log("  SKIP: No Manage properties button"); continue; }
      await managePropBtn.click();
      await page.waitForTimeout(3000);

      // 2. Check "Annual Recurring Revenue (ARR)" checkbox using force click
      console.log("  [2/5] Checking new field checkbox...");
      await page.fill('input[placeholder*="Search" i]', "Annual Recurring Revenue");
      await page.waitForTimeout(2000);

      // Use force:true to click through the wrapper div
      const newFieldLabel = await page.$('text="Annual Recurring Revenue (ARR)"');
      if (newFieldLabel) {
        // Click the parent checkbox wrapper with force
        await newFieldLabel.click({ force: true });
        await page.waitForTimeout(1000);
        console.log("  Checked new field.");
      } else {
        console.log("  WARNING: New field not found in property list.");
      }

      // 3. Remove old "Annual recurring revenue" from right side
      console.log("  [3/5] Removing old field from managed properties...");
      // Clear search first
      await page.fill('input[placeholder*="Search" i]', "");
      await page.waitForTimeout(500);

      // Click × next to "Annual recurring revenue" on the right side panel
      const removed = await page.evaluate(() => {
        // Look for items on the right side of the dialog that contain "Annual recurring revenue" (not ARR)
        const items = document.querySelectorAll('[class*="manage"] *, [class*="Manage"] *, [class*="selected"] *, [class*="Selected"] *');
        for (const item of items) {
          const text = item.textContent?.trim();
          if (text === "Annual recurring revenue") {
            // Find the × button near this item
            let parent = item;
            for (let i = 0; i < 5; i++) {
              parent = parent.parentElement;
              if (!parent) break;
              const closeBtn = parent.querySelector('button, [class*="close"], [class*="remove"]');
              if (closeBtn && closeBtn.offsetWidth < 40) {
                closeBtn.click();
                return "removed via close btn";
              }
            }
          }
        }

        // Alternative: find "Annual recurring revenue" text in the right panel and click its ×
        const allDivs = document.querySelectorAll('div');
        for (const div of allDivs) {
          if (div.children.length < 5 && div.textContent?.trim() === "Annual recurring revenue") {
            const sibling = div.nextElementSibling || div.parentElement?.querySelector('button');
            if (sibling && sibling.tagName === "BUTTON") {
              sibling.click();
              return "removed via sibling button";
            }
            const parentBtn = div.parentElement?.querySelector('button');
            if (parentBtn) {
              parentBtn.click();
              return "removed via parent button";
            }
          }
        }

        return "not found";
      });

      console.log(`  Remove result: ${removed}`);
      await page.waitForTimeout(1000);
      await ss(page, `after-manage-${report.id}`);

      // 4. Click "Apply"
      console.log("  [4/5] Clicking Apply...");
      const applyBtn = await page.$('button:has-text("Apply"):visible');
      if (applyBtn) {
        await applyBtn.click();
        await page.waitForTimeout(3000);
        console.log("  Applied changes.");
      } else {
        console.log("  No Apply button found, pressing Escape.");
        await page.keyboard.press("Escape");
        await page.waitForTimeout(1000);
      }

      // Now in the sidebar, click the new field in "Available properties" to move it to "Displaying"
      console.log("  [4b] Moving new field to Displaying...");
      await ss(page, `sidebar-${report.id}`);

      // Click on "Annual Recurring Revenue (ARR)" in the available section
      const newFieldInSidebar = await page.$('text="Annual Recurring Revenue (ARR)"');
      if (newFieldInSidebar) {
        const isVisible = await newFieldInSidebar.isVisible();
        if (isVisible) {
          await newFieldInSidebar.click();
          await page.waitForTimeout(2000);
          console.log("  Moved to Displaying.");
        }
      }

      // Remove old "Annual recurring revenue" from Displaying using its × button
      // The × button is near the text "Annual recurring revenue" (not "(ARR)")
      console.log("  [4c] Removing old field from Displaying...");

      // Find the × button: it's inside the same pill/row as "Annual recurring revenue"
      const removeResult = await page.evaluate(() => {
        const allElements = document.querySelectorAll("span, div, p, label");
        for (const el of allElements) {
          const text = el.textContent?.trim();
          if (
            text === "Annual recurring revenue" &&
            !el.closest("[data-test-id='available-properties']") // skip "Available properties" section
          ) {
            // Walk up to find the pill container, then find the × button
            let container = el.parentElement;
            for (let i = 0; i < 5; i++) {
              if (!container) break;
              const buttons = container.querySelectorAll("button");
              for (const btn of buttons) {
                const btnText = btn.textContent?.trim();
                const ariaLabel = btn.getAttribute("aria-label") || "";
                // × button is usually small with empty text or × character
                if (
                  (btnText === "" || btnText === "×" || btnText === "✕" || btnText.length <= 1) &&
                  btn.offsetWidth > 0 &&
                  btn.offsetWidth < 40
                ) {
                  btn.click();
                  return "clicked × button";
                }
                if (ariaLabel.toLowerCase().includes("remove") || ariaLabel.toLowerCase().includes("close")) {
                  btn.click();
                  return "clicked remove button";
                }
              }
              container = container.parentElement;
            }
          }
        }
        return "not found";
      });

      console.log(`  Remove old from Displaying: ${removeResult}`);
      await page.waitForTimeout(2000);
      await ss(page, `pre-save-${report.id}`);

      // 5. Save - click "Update existing report"
      console.log("  [5/5] Saving...");
      const updateBtn = await page.$('button:has-text("Update existing rep")');
      if (updateBtn) {
        await updateBtn.click();
        await page.waitForTimeout(5000);
        console.log("  SAVED!");
        updated++;
      } else {
        console.log("  Update button not found. Check screenshot.");
      }

      await ss(page, `done-${report.id}`);
    } catch (err) {
      console.log(`  ERROR: ${err.message}`);
      await ss(page, `error-${report.id}`);
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Done! Updated ${updated}/${REPORTS.length} reports.`);
  console.log("Browser staying open for 60s...");
  await page.waitForTimeout(60_000);
  await browser.close();
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
