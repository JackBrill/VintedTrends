import { chromium } from 'playwright';

// Your Discord webhook URL
const WEBHOOK_URL = 'https://discord.com/api/webhooks/1418689032728219678/sIkXJ-SgQYBzZX2J3p6jOwMwzdS-atWzpJfOm8_N5AdHDdF3RMgC-t1UhvfWv49WmOUo';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto('https://www.vinted.co.uk', { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="feed-item"]', { timeout: 10000 });

    const firstItem = await page.$('[data-testid="feed-item"]');

    if (firstItem) {
      const name = await firstItem.$eval('[data-testid="feed-item--description-title"]', el => el.innerText.trim());
      const price = await firstItem.$eval('[data-testid="feed-item--price-text"]', el => el.innerText.trim());
      const link = await firstItem.$eval('a[data-testid="feed-item--overlay-link"]', el => el.href);

      console.log('First item:', { name, price, link });

      // Send to Discord webhook
      await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `New Vinted listing:\n**${name}**\nPrice: ${price}\nLink: ${link}`
        })
      });

      console.log('Sent to Discord webhook!');
    } else {
      console.log('No items found.');
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
})();
