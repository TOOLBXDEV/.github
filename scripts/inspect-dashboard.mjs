import { chromium } from "playwright";

const DASHBOARD_URL =
  "https://app.hubspot.com/reports-dashboard/49044619/view/19122249";

async function main() {
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
  await page.goto(DASHBOARD_URL, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(5000);

  console.log("Page title:", await page.title());
  console.log("Page URL:", page.url());

  await page.screenshot({
    path: "/Users/normankuan/Documents/toolbx-sales-hub/scripts/screenshots/dashboard-loaded.png",
    fullPage: true,
  });

  const tileInfo = await page.evaluate(() => {
    const allElements = document.querySelectorAll("*");
    const widgetClasses = new Set();
    for (const el of allElements) {
      const classes = el.className;
      if (typeof classes === "string" && classes.toLowerCase().includes("widget")) {
        for (const cls of classes.split(/\s+/)) {
          if (cls.toLowerCase().includes("widget")) widgetClasses.add(cls);
        }
      }
    }

    const tiles = document.querySelectorAll('[data-test-id="dashboard-widget"]');
    const tileDetails = [];

    for (let i = 0; i < Math.min(tiles.length, 3); i++) {
      const tile = tiles[i];

      const buttons = tile.querySelectorAll("button");
      const buttonInfo = [];
      for (const btn of buttons) {
        buttonInfo.push({
          text: btn.textContent?.trim().substring(0, 40),
          ariaLabel: btn.getAttribute("aria-label"),
          testId: btn.getAttribute("data-test-id"),
          seleniumTest: btn.getAttribute("data-selenium-test"),
          classes: btn.className?.substring(0, 100),
        });
      }

      const links = tile.querySelectorAll("a[href]");
      const linkInfo = [];
      for (const a of links) {
        linkInfo.push({
          href: a.href,
          text: a.textContent?.trim().substring(0, 40),
        });
      }

      const titleEl = tile.querySelector(
        '[data-test-id="widget-title"], h3, h4, [class*="Title"], [class*="title"]'
      );

      tileDetails.push({
        index: i,
        title: titleEl?.textContent?.trim().substring(0, 80),
        outerHTMLSnippet: tile.outerHTML.substring(0, 500),
        buttonCount: buttons.length,
        buttons: buttonInfo,
        linkCount: links.length,
        links: linkInfo,
      });
    }

    return {
      widgetClasses: Array.from(widgetClasses),
      tileCount: tiles.length,
      tiles: tileDetails,
    };
  });

  console.log("\n=== WIDGET CLASSES IN PAGE ===");
  console.log(tileInfo.widgetClasses.join(", "));

  console.log(`\n=== TILE COUNT: ${tileInfo.tileCount} ===`);

  for (const tile of tileInfo.tiles) {
    console.log(`\n--- Tile ${tile.index}: "${tile.title}" ---`);
    console.log(`  Buttons (${tile.buttonCount}):`);
    for (const btn of tile.buttons) {
      console.log(
        `    text="${btn.text}" aria="${btn.ariaLabel}" testId="${btn.testId}" selenium="${btn.seleniumTest}" class="${btn.classes}"`
      );
    }
    console.log(`  Links (${tile.linkCount}):`);
    for (const link of tile.links) {
      console.log(`    "${link.text}" -> ${link.href}`);
    }
    console.log(`  HTML snippet: ${tile.outerHTMLSnippet.substring(0, 300)}`);
  }

  // Now try hovering over tile 0 to see if menu appears
  const firstTile = await page.$('[data-test-id="dashboard-widget"]');
  if (firstTile) {
    console.log("\n=== HOVERING TILE 0 ===");
    await firstTile.hover();
    await page.waitForTimeout(1500);

    const postHoverButtons = await firstTile.$$eval("button", (btns) =>
      btns.map((b) => ({
        text: b.textContent?.trim().substring(0, 40),
        ariaLabel: b.getAttribute("aria-label"),
        testId: b.getAttribute("data-test-id"),
        seleniumTest: b.getAttribute("data-selenium-test"),
        visible: b.offsetParent !== null,
        classes: b.className?.substring(0, 80),
      }))
    );

    console.log(`  Buttons after hover (${postHoverButtons.length}):`);
    for (const btn of postHoverButtons) {
      console.log(
        `    text="${btn.text}" aria="${btn.ariaLabel}" testId="${btn.testId}" visible=${btn.visible} class="${btn.classes}"`
      );
    }

    // Click the first button that looks like a menu
    const menuCandidates = postHoverButtons.filter(
      (b) =>
        b.visible &&
        (b.ariaLabel?.toLowerCase().includes("more") ||
          b.ariaLabel?.toLowerCase().includes("action") ||
          b.ariaLabel?.toLowerCase().includes("menu") ||
          b.ariaLabel?.toLowerCase().includes("option") ||
          b.text === "" ||
          b.text === "..." ||
          b.testId?.includes("more") ||
          b.testId?.includes("action") ||
          b.testId?.includes("menu"))
    );

    console.log(`  Menu candidates: ${menuCandidates.length}`);
    for (const c of menuCandidates) {
      console.log(`    "${c.text}" aria="${c.ariaLabel}" testId="${c.testId}"`);
    }

    // Also check for any popover/dropdown that appeared
    const allVisibleButtons = await page.$$eval(
      'button:visible, [role="menuitem"]:visible, [role="option"]:visible',
      (els) =>
        els.slice(0, 20).map((e) => ({
          tag: e.tagName,
          text: e.textContent?.trim().substring(0, 40),
          href: e.getAttribute("href"),
          ariaLabel: e.getAttribute("aria-label"),
        }))
    );
    console.log(`\n  All visible interactive elements (top 20):`);
    for (const el of allVisibleButtons) {
      console.log(`    <${el.tag}> "${el.text}" href="${el.href}" aria="${el.ariaLabel}"`);
    }
  }

  await page.screenshot({
    path: "/Users/normankuan/Documents/toolbx-sales-hub/scripts/screenshots/dashboard-hovered.png",
    fullPage: false,
  });

  console.log("\nDone. Browser closing in 30 seconds...");
  await page.waitForTimeout(30_000);
  await browser.close();
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
