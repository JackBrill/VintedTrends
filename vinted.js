import { chromium } from 'playwright';

(async () => {
  try {
    console.log("Launching browser...");
    const browser = await chromium.launch({ headless: false }); // non-headless helps see what's happening
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log("Navigating to Vinted UK...");
    await page.goto('https://www.vinted.co.uk/', { waitUntil: 'networkidle' });

    console.log("Waiting for items to load...");
    await page.waitForSelector('.feed-grid__item', { timeout: 15000 }) // 15s timeout
      .catch(() => console.log("Items container not found."));

    // Try to grab the first item
    const firstItem = await page.$('.feed-grid__item');
    if (!firstItem) {
      console.log("No items found on the homepage.");
      await browser.close();
      return;
    }

    // Grab name and price
    const name = await firstItem.$eval('.feed-item__title', el => el.textContent.trim())
      .catch(() => "Name not found");
    const price = await firstItem.$eval('.feed-item__price', el => el.textContent.trim())
      .catch(() => "Price not found");

    console.log('First item:', { name, price });

    await browser.close();
  } catch (err) {
    console.error("Error caught:", err);
  }
})();
