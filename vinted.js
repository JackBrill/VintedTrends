// vinted.js
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto('https://www.vinted.co.uk', { waitUntil: 'networkidle' });

    // Wait for listings to appear (10s timeout)
    await page.waitForSelector('[data-testid="feed-item"]', { timeout: 10000 });

    const firstItem = await page.$('[data-testid="feed-item"]');

    if (firstItem) {
      const name = await firstItem.$eval('[data-testid="feed-item--description-title"]', el => el.innerText.trim());
      const price = await firstItem.$eval('[data-testid="feed-item--price-text"]', el => el.innerText.trim());

      console.log('First item:');
      console.log('Name:', name);
      console.log('Price:', price);
    } else {
      console.log('No items found.');
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
})();
