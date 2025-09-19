import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('https://www.vinted.co.uk/', { waitUntil: 'networkidle' });

    await page.waitForSelector('.feed-grid__item');

    const firstItem = await page.$('.feed-grid__item');

    const name = await firstItem.$eval('.feed-grid__item-title', el => el.innerText);
    const price = await firstItem.$eval('.feed-grid__item-price', el => el.innerText);

    console.log('First item:');
    console.log('Name:', name);
    console.log('Price:', price);

  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
})();
