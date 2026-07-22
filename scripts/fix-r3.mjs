import { chromium } from "playwright";

const PORTAL_ID = "49044619";

async function ss(page, label) {
  await page.screenshot({
    path: `/Users/normankuan/Documents/toolbx-sales-hub/scripts/screenshots/${label}.png`,
    fullPage: false,
  });
}

async function main() {
  console.log("=== Fix Report 3: Key Pipeline Metrics ===\n");

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

  await page.goto(
    `https://app.hubspot.com/report-builder/${PORTAL_ID}/report/161692258`,
    { waitUntil: "domcontentloaded", timeout: 30_000 }
  );
  await page.waitForTimeout(10_000);

  await ss(page, "r3-fix-initial");

  // Step 1: Remove (Count) Deals from Displaying using × click at offset
  console.log("[1] Removing (Count) Deals from Displaying...");

  const countDealsInDisplaying = await page.$('[data-test-id="draggable-field-0-3-count"]');
  if (countDealsInDisplaying) {
    const box = await countDealsInDisplaying.boundingBox();
    if (box) {
      console.log(`  (Count) Deals at y=${box.y}`);

      // The × is at the right edge of the pill. Probe to find it.
      const xRight = box.x + box.width - 10;
      const yMid = box.y + box.height / 2;

      // Probe what's at the right edge
      const probe = await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        if (!el) return null;
        return {
          tag: el.tagName,
          class: el.className?.toString().substring(0, 60),
          text: el.textContent?.trim().substring(0, 20),
        };
      }, { x: xRight, y: yMid });

      console.log(`  Probe at right edge: ${JSON.stringify(probe)}`);

      // Click the × at offset (same pattern that worked for other reports)
      const textEl = await page.$('[data-test-id="draggable-field-0-3-count"] span:not(:empty)');
      if (textEl) {
        const textBox = await textEl.boundingBox();
        if (textBox) {
          await page.mouse.click(textBox.x + textBox.width + 12, textBox.y + textBox.height / 2);
          await page.waitForTimeout(2000);
          console.log("  Clicked × offset.");
        }
      } else {
        // Just click at right edge of the draggable field
        await page.mouse.click(xRight, yMid);
        await page.waitForTimeout(2000);
        console.log("  Clicked right edge.");
      }
    }
  }

  await ss(page, "r3-fix-after-remove");

  // Check current state
  const currentState = await page.evaluate(() => {
    const aggBtns = document.querySelectorAll('[data-test-id*="aggregation-selector"]');
    const results = [];
    for (const btn of aggBtns) {
      results.push(btn.getAttribute("data-test-id"));
    }

    const dropZone = !!document.querySelector('[class*="Drag"][class*="drop"]') ||
      Array.from(document.querySelectorAll("*")).some(
        (el) => el.textContent?.trim() === "Drag & drop to display" && el.children.length === 0
      );

    return { aggregationSelectors: results, hasDropZone: dropZone };
  });

  console.log(`  State: ${JSON.stringify(currentState)}`);

  // Step 2: Scroll sidebar to make ARR visible, then drag
  console.log("\n[2] Scrolling sidebar and dragging ARR...");

  // Scroll the sidebar container to bring ARR into view
  await page.evaluate(() => {
    const el = document.querySelector('[data-test-id="draggable-field-0-3-annual_recurring_revenue_w_est"]');
    if (el) el.scrollIntoView({ behavior: "instant", block: "center" });
  });
  await page.waitForTimeout(1000);

  const arrField = await page.$('[data-test-id="draggable-field-0-3-annual_recurring_revenue_w_est"]');
  const dropTarget = await page.$('text="Drag & drop to display"');

  if (!arrField) {
    console.log("  ARR field not found by data-test-id.");
    // Try text match
    const arrByText = page.locator('text="Annual Recurring Revenue (ARR)"').first();
    if (await arrByText.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log("  Found by text. Trying dragTo...");

      const displayingLabel = page.locator('text="Displaying:"').first();
      await arrByText.dragTo(displayingLabel);
      await page.waitForTimeout(3000);
    }
  } else {
    const arrBox = await arrField.boundingBox();
    console.log(`  ARR field at y=${arrBox?.y}`);

    if (dropTarget) {
      const dropBox = await dropTarget.boundingBox();
      console.log(`  Drop zone at y=${dropBox?.y}`);

      if (arrBox && dropBox) {
        // Method 1: Playwright dragTo
        const arrHandle = await page.$('[data-test-id="draggable-field-0-3-annual_recurring_revenue_w_est"]');
        const dropHandle = await page.$('text="Drag & drop to display"');
        if (arrHandle && dropHandle) {
          console.log("  Attempting dragTo...");
          // Use the drag handle (the ⠿ icon) inside the field
          const dragHandle = await arrField.$('button[data-test-id*="drag"]');
          const draggable = dragHandle || arrField;

          const srcBox = await draggable.boundingBox();
          const tgtBox = await dropHandle.boundingBox();

          if (srcBox && tgtBox) {
            const srcX = srcBox.x + srcBox.width / 2;
            const srcY = srcBox.y + srcBox.height / 2;
            const tgtX = tgtBox.x + tgtBox.width / 2;
            const tgtY = tgtBox.y + tgtBox.height / 2;

            console.log(`  Manual drag: (${Math.round(srcX)},${Math.round(srcY)}) -> (${Math.round(tgtX)},${Math.round(tgtY)})`);

            // Slow manual mouse drag
            await page.mouse.move(srcX, srcY);
            await page.waitForTimeout(500);
            await page.mouse.down();
            await page.waitForTimeout(500);

            // Move in many small steps
            const steps = 30;
            for (let i = 1; i <= steps; i++) {
              const x = srcX + ((tgtX - srcX) * i) / steps;
              const y = srcY + ((tgtY - srcY) * i) / steps;
              await page.mouse.move(x, y);
              await page.waitForTimeout(30);
            }

            // Hold at target for a moment
            await page.waitForTimeout(500);
            await page.mouse.up();
            await page.waitForTimeout(3000);
          }
        }
      }
    } else {
      // No drop zone text found - try dropping on Displaying label
      console.log("  No 'Drag & drop' text found. Using Displaying label...");
      const displayingEl = await page.$('text="Displaying:"');
      if (displayingEl && arrBox) {
        const tgtBox = await displayingEl.boundingBox();
        if (tgtBox) {
          const srcX = arrBox.x + arrBox.width / 2;
          const srcY = arrBox.y + arrBox.height / 2;
          const tgtX = tgtBox.x + tgtBox.width / 2;
          const tgtY = tgtBox.y + tgtBox.height / 2 + 30;

          await page.mouse.move(srcX, srcY);
          await page.waitForTimeout(500);
          await page.mouse.down();
          await page.waitForTimeout(500);

          const steps = 30;
          for (let i = 1; i <= steps; i++) {
            await page.mouse.move(
              srcX + ((tgtX - srcX) * i) / steps,
              srcY + ((tgtY - srcY) * i) / steps
            );
            await page.waitForTimeout(30);
          }

          await page.waitForTimeout(500);
          await page.mouse.up();
          await page.waitForTimeout(3000);
        }
      }
    }
  }

  // Check result
  const newAgg = await page.$('[data-test-id*="aggregation-selector"][data-test-id*="annual_recurring_revenue_w_est"]');
  console.log(`\n  Result: ARR in Displaying = ${!!newAgg}`);

  if (!newAgg) {
    // Try dispatching HTML5 drag events programmatically
    console.log("  Trying HTML5 drag events...");

    const dragResult = await page.evaluate(() => {
      const source = document.querySelector('[data-test-id="draggable-field-0-3-annual_recurring_revenue_w_est"]');
      const targetTexts = document.querySelectorAll("*");
      let target = null;
      for (const el of targetTexts) {
        const direct = Array.from(el.childNodes)
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => n.textContent.trim())
          .join("");
        if (direct === "Displaying:" || direct === "Drag & drop to display") {
          target = el;
          break;
        }
      }

      if (!source || !target) return `source=${!!source} target=${!!target}`;

      const dataTransfer = new DataTransfer();
      const srcRect = source.getBoundingClientRect();
      const tgtRect = target.getBoundingClientRect();

      source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer, clientX: srcRect.x, clientY: srcRect.y }));
      target.dispatchEvent(new DragEvent("dragenter", { bubbles: true, dataTransfer, clientX: tgtRect.x, clientY: tgtRect.y }));
      target.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer, clientX: tgtRect.x, clientY: tgtRect.y }));
      target.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer, clientX: tgtRect.x, clientY: tgtRect.y }));
      source.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer }));

      return "dispatched";
    });

    console.log(`  HTML5 drag result: ${dragResult}`);
    await page.waitForTimeout(3000);

    const newAgg2 = await page.$('[data-test-id*="aggregation-selector"][data-test-id*="annual_recurring_revenue_w_est"]');
    console.log(`  After HTML5: ARR in Displaying = ${!!newAgg2}`);
  }

  await ss(page, "r3-fix-final");

  // Save
  const updateBtn = page.locator('button:has-text("Update existing rep")').first();
  if (await updateBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await updateBtn.click();
    await page.waitForTimeout(5000);
    console.log("  Report 3 SAVED!");
  } else {
    console.log("  Update button not visible.");
  }

  await ss(page, "r3-fix-done");

  console.log("\n=== Done! ===");
  console.log("Browser open for 30s...");
  await page.waitForTimeout(30_000);
  await browser.close();
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
