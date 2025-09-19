async function fetchAndTrackItems() {
  let attempt = 1;

  while (true) {
    const proxy = getRandomProxy();
    console.log(`=== Attempt ${attempt} ===`);
    console.log(`Using proxy: ${proxy.host}:${proxy.port}`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      proxy: { server: `http://${proxy.host}:${proxy.port}`, username: proxy.user, password: proxy.pass },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      viewport: { width: 1280, height: 800 }
    });

    const page = await context.newPage();
    let items = [];

    try {
      console.log('Navigating to Vinted catalog...');
      const response = await page.goto(
        'https://www.vinted.co.uk/catalog?search_id=26450535328&page=1&order=newest_first',
        { waitUntil: 'domcontentloaded', timeout: 30000 }
      );
      console.log(`Response status: ${response.status()}`);
      await page.waitForTimeout(2000);

      items = await page.$$('div[data-testid="grid-item"]');
      console.log(`Found ${items.length} items on the page.`);

      const trackedItems = [];
      for (const item of items.slice(0, NUM_ITEMS)) {
        try {
          const name = await item.$eval('[data-testid$="--description-title"]', el => el.innerText.trim());
          const price = await item.$eval('[data-testid$="--price-text"]', el => el.innerText.trim());
          const link = await item.$eval('a[data-testid$="--overlay-link"]', el => el.href);
          trackedItems.push({ name, price, link, sold: false });
          console.log(`Tracking item: ${name} | ${link} | ${price}`);
        } catch (err) {
          console.log('Skipped an item due to error:', err.message);
        }
      }

      let keepChecking = true;

      const interval = setInterval(async () => {
        if (!keepChecking) return;

        for (const item of trackedItems) {
          if (item.sold) continue;
          const itemPage = await context.newPage();
          try {
            await itemPage.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await itemPage.waitForTimeout(1000);
            const soldElement = await itemPage.$('[data-testid="item-status--content"]');
            const isSold = soldElement ? (await soldElement.innerText()).toLowerCase().includes('sold') : false;
            if (isSold) {
              console.log(`✅ Item SOLD: ${item.name} | ${item.link} | ${item.price}`);
              item.sold = true;
            } else {
              console.log(`Item still available: ${item.name} | ${item.link} | ${item.price}`);
            }
          } catch (err) {
            if (keepChecking) console.log('Error checking item:', err.message);
          } finally {
            await itemPage.close();
          }
        }
      }, CHECK_INTERVAL);

      // Wait for batch duration before switching
      await new Promise(resolve => setTimeout(resolve, BATCH_DURATION));
      console.log('Batch duration ended. Switching to new items...');
      keepChecking = false;
      clearInterval(interval);
      await browser.close();

    } catch (err) {
      console.log('Navigation or extraction error:', err.message);
      await browser.close();
    }

    attempt = 1; // reset attempt for next batch
  }
}
