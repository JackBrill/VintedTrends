// vinted.js
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true }); // headless=true for VPS
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto('https://www.vinted.co.uk/', { waitUntil: 'networkidle' });

    // Wait for items to appear
    await page.waitForSelector('.feed-grid__item', { timeout: 15000 });

    const firstItem = await page.$('.feed-grid__item');

    const name = await firstItem.$eval('.feed-grid__item-title', el => el.innerText);
    const price = await firstItem.$eval('.feed-grid__item-price', el => el.innerText);

    console.log('First item:');
    console.log('Name:', name);
    console.log('Price:', price);

  } catch (err) {
    console.error('Error scraping Vinted:', err);
  } finally {
    await browser.close();
  }
})();
