// vinted.js
import { chromium } from 'playwright';

(async () => {
  // Launch browser in headless mode
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Go to Vinted UK home page
    await page.goto('https://www.vinted.co.uk', { waitUntil: 'networkidle' });

    // Wait for listings to load
    await page.waitForSelector('div.feed-grid__item'); // container for items

    // Grab first item
    const firstItem = await page.$('div.feed-grid__item');

    if (firstItem) {
      const name = await firstItem.$eval('a > div > div > div > div > h3', el => el.innerText.trim());
      const price = await firstItem.$eval('a > div > div > div > div > div > span', el => el.innerText.trim());

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
