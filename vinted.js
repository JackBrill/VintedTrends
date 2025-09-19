import { chromium } from 'playwright';

(async () => {
  // Launch browser
  const browser = await chromium.launch({ headless: true });
  
  // Fresh context for guest access
  const context = await browser.newContext();

  // Open a new page
  const page = await context.newPage();

  // Go to Vinted UK
  await page.goto('https://www.vinted.co.uk', { waitUntil: 'networkidle' });

  // Wait for the main items to load
  await page.waitForSelector('a[data-testid="catalog-item-link"]');

  // Get the first item
  const firstItem = await page.$('a[data-testid="catalog-item-link"]');

  // Extract name and price
  const name = await firstItem.$eval('[data-testid="catalog-item-title"]', el => el.innerText.trim());
  const price = await firstItem.$eval('[data-testid="catalog-item-price"]', el => el.innerText.trim());

  console.log('First item name:', name);
  console.log('First item price:', price);

  // Close browser
  await browser.close();
})();
