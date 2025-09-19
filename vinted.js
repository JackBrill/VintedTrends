// vinted.js
import { chromium } from 'playwright-extra';
import StealthPlugin from 'playwright-extra-plugin-stealth';

chromium.use(StealthPlugin());

(async () => {
  // Launch browser
  const browser = await chromium.launch({ headless: false }); // set headless:true if you want no GUI
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to Vinted UK
    await page.goto('https://www.vinted.co.uk/', { waitUntil: 'networkidle' });

    // Wait for the first item to load
    await page.waitForSelector('.feed-grid__item', { timeout: 15000 });

    // Grab the first item
    const firstItem = await page.$('.feed-grid__item');

    // Extract name and price
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
