import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto('https://www.vinted.co.uk', { waitUntil: 'domcontentloaded' });

    // Wait for first feed item (10s timeout)
    const firstItem = await page.waitForSelector('div.feed-grid__item', { timeout: 10000 });

    if (firstItem) {
      const name = await firstItem.$eval('h3', el => el.innerText.trim()).catch(() => 'N/A');
      const price = await firstItem.$eval('span[data-testid="price"]', el => el.innerText.trim()).catch(() => 'N/A');

      console.log('First item:');
      console.log('Name:', name);
      console.log('Price:', price);
    } else {
      console.log('No items found on the home page.');
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
})();
