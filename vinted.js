// vinted.js
import { chromium } from 'playwright';
import fetch from 'node-fetch';

const WEBHOOK_URL = 'https://discord.com/api/webhooks/1418689032728219678/sIkXJ-SgQYBzZX2J3p6jOwMwzdS-atWzpJfOm8_N5AdHDdF3RMgC-t1UhvfWv49WmOUo';
const CHECK_INTERVAL = 30 * 1000; // 30 seconds
const MAX_ITEMS = 5; // track 5 items

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Grab 5 newest items once
    await page.goto('https://www.vinted.co.uk/catalog?search_id=26450535328&page=1&order=newest_first', { waitUntil: 'networkidle' });
    await page.waitForSelector('div[data-testid="grid-item"]', { timeout: 20000 });

    const items = await page.$$('div[data-testid="grid-item"]');
    const trackedItems = [];

    for (const item of items.slice(0, MAX_ITEMS)) {
      const name = await item.$eval('[data-testid$="--description-title"]', el => el.innerText.trim());
      const subtitle = await item.$eval('[data-testid$="--description-subtitle"]', el => el.innerText.trim());
      const price = await item.$eval('[data-testid$="--price-text"]', el => el.innerText.trim());
      const link = await item.$eval('a[data-testid$="--overlay-link"]', el => el.href);
      const image = await item.$eval('img[data-testid$="--image--img"]', el => el.src);

      trackedItems.push({ name, subtitle, price, link, image, sold: false });

      // Send initial listing to Discord
      await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: name,
            url: link,
            description: `${subtitle}\nPrice: **${price}**`,
            color: 0x1abc9c,
            image: { url: image },
            footer: { text: 'Vinted.co.uk' }
          }]
        })
      });
      console.log('Tracking item:', name);
    }

    // Function to check sold status for all tracked items
    const checkSoldStatus = async () => {
      for (const item of trackedItems) {
        if (item.sold) continue; // skip already sold items

        const itemPage = await context.newPage();
        try {
          await itemPage.goto(item.link, { waitUntil: 'networkidle' });
          await itemPage.waitForTimeout(2000);

          const soldElement = await itemPage.$('[data-testid="item-status--content"]');
          let isSold = false;
          if (soldElement) {
            const statusText = await soldElement.innerText();
            if (statusText.toLowerCase().includes('sold')) isSold = true;
          }

          if (isSold) {
            console.log(`Item SOLD: ${item.name}`);
            item.sold = true;

            await fetch(WEBHOOK_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                embeds: [{
                  title: item.name,
                  url: item.link,
                  description: `${item.subtitle}\nPrice: **${item.price}**\nStatus: SOLD`,
                  color: 0xe74c3c,
                  image: { url: item.image },
                  footer: { text: 'Vinted.co.uk' }
                }]
              })
            });
          } else {
            console.log(`${new Date().toLocaleTimeString()}: Item still available: ${item.name}`);
          }
        } catch (err) {
          console.error('Error checking item:', item.name, err);
        } finally {
          await itemPage.close();
        }
      }
    };

    // Run the check every 30 seconds
    setInterval(checkSoldStatus, CHECK_INTERVAL);

  } catch (err) {
    console.error('Error initializing tracked items:', err);
    await browser.close();
  }
})();
