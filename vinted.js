import { chromium } from 'playwright';
import fetch from 'node-fetch';

const LISTING_URL = 'https://www.vinted.co.uk/items/7124184580-next-shirt-size-14';
const WEBHOOK_URL = 'https://discord.com/api/webhooks/1418689032728219678/sIkXJ-SgQYBzZX2J3p6jOwMwzdS-atWzpJfOm8_N5AdHDdF3RMgC-t1UhvfWv49WmOUo';

async function checkSoldStatus(page) {
  try {
    await page.goto(LISTING_URL, { waitUntil: 'networkidle' });

    const soldElement = await page.$('[data-testid="item-status--content"]');
    if (soldElement) {
      const statusText = await soldElement.innerText();
      if (statusText.toLowerCase() === 'sold') {
        console.log('Item is sold!');
        await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `🚨 The item has been sold! ${LISTING_URL}`
          })
        });
        return true; // Stop checking if sold
      }
    }

    console.log('Item is still available.');
    return false;

  } catch (err) {
    console.error('Error checking sold status:', err);
    return false;
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const interval = setInterval(async () => {
    const sold = await checkSoldStatus(page);
    if (sold) clearInterval(interval);
  }, 10000); // check every 10 seconds
})();
