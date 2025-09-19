// vinted.js
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Go to Vinted UK home page
    await page.goto('https://www.vinted.co.uk', { waitUntil: 'domcontentloaded' });

    // Handle cookie/consent banner if present
    const consentButton = page.locator('button:has-text("Accept all cookies")');
    if (await consentButton.count() > 0) {
      await consentButton.click();
    }

    // Wait for the main feed to load
    await page.waitForSelector('article > div > a', { timeout: 30000 });

    // Grab the first item
    const firstItem = page.locator('article > div > a').first();
    const name = await firstItem.locator('h3').textContent();
    const price = await firstItem.locator('div[data-testid="price"]').textContent();

    console.log('First item:');
    console.log('Name:', name?.trim() || 'N/A');
    console.log('Price:', price?.trim() || 'N/A');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
})();
