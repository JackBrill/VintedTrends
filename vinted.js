import { chromium } from 'playwright';

(async () => {
  // Launch browser
  const browser = await chromium.launch({ headless: true }); // headless is fine for VPS
  const context = await browser.newContext();
  const page = await context.newPage();

  // Go to Vinted UK homepage
  await page.goto('https://www.vinted.co.uk/', { waitUntil: 'networkidle' });

  // Wait for items to load
  await page.waitForSelector('.feed-grid__item'); // container for items

  // Grab first item
  const firstItem = await page.$('.feed-grid__item');

  // Get name and price
  const name = await firstItem.$eval('.feed-item__title', el => el.textContent.trim());
  const price = await firstItem.$eval('.feed-item__price', el => el.textContent.trim());

  console.log('First item:', { name, price });

  await browser.close();
})();
