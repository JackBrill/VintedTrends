// vinted.js
import { chromium } from 'playwright';
import fetch from 'node-fetch';

const WEBHOOK_URL = 'https://discord.com/api/webhooks/1418689032728219678/sIkXJ-SgQYBzZX2J3p6jOwMwzdS-atWzpJfOm8_N5AdHDdF3RMgC-t1UhvfWv49WmOUo';
const CHECK_INTERVAL = 30 * 1000; // 30 seconds
const MAX_ITEMS = 5; // check 5 newest items

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const notifiedItems = new Set();

  const checkItems = async () => {
    try {
      await page.goto('https://www.vinted.co.uk/catalog?search_id=26450535328&page=1&order=newest_first', { waitUntil: 'networkidle' });
      await page.waitForSelector('div[data-testid="grid-item"]', { timeout: 20000 });

      const items = await page.$$('div[data-testid="grid-item"]');
      const newestItems = items.slice(0, MAX_ITEMS);

      for (const item of newestItems) {
        const link = await item.$eval('a[data-testid$="--overlay-link"]', el => el.href);
        if (notifiedItems.has(link)) continue; // skip if already notified

        const name = await item.$eval('[data-testid$="--description-title"]', el => el.innerText.trim());
        const subtitle = await item.$eval('[data-testid$="--description-subtitle"]', el => el.innerText.trim());
        const price = await item.$eval('[data-testid$="--price-text"]', el => el.innerText.trim());
        const image = await item.$eval('img[data-testid$="--image--img"]', el => el.src);

        console.log('Checking item:', name);

        // Open item page to check sold status
        const itemPage = await context.newPage();
        await itemPage.goto(link, { waitUntil: 'networkidle' });
        await itemPage.waitForTimeout(2000); // wait for sold banner

        const soldElement = await itemPage.$('[data-testid="item-status--content"]');
        let sold = false;
        if (soldElement) {
          const statusText = await soldElement.innerText();
          if (statusText.toLowerCase().includes('sold')) sold = true;
        }

        await itemPage.close();

        if (sold) {
          console.log(`Item SOLD: ${name}`);
          await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              embeds: [{
                title: name,
                url: link,
                description: `${subtitle}\nPrice: **${price}**\nStatus: SOLD`,
                color: 0xe74c3c,
                image: { url: image },
                footer: { text: 'Vinted.co.uk' }
              }]
            })
          });
          notifiedItems.add(link);
        } else {
          console.log(`${new Date().toLocaleTimeString()}: Item still available: ${name}`);
        }
      }
    } catch (err) {
      console.error('Error checking items:', err);
    }
  };

  // Initial check
  await checkItems();

  // Repeat every 30 seconds
  setInterval(checkItems, CHECK_INTERVAL);

})();
