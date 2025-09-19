import { chromium } from 'playwright';
import fetch from 'node-fetch';
import readline from 'readline';

const WEBHOOK_URL = 'https://discord.com/api/webhooks/1418689032728219678/sIkXJ-SgQYBzZX2J3p6jOwMwzdS-atWzpJfOm8_N5AdHDdF3RMgC-t1UhvfWv49WmOUo';
const CHECK_INTERVAL = 30 * 1000; // 30 seconds
const BATCH_DURATION = 5 * 60 * 1000; // 5 minutes

function askQuestion(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(query, ans => { rl.close(); resolve(ans); }));
}

(async () => {
  const numItemsInput = await askQuestion('How many items do you want to track? ');
  const BATCH_SIZE = parseInt(numItemsInput, 10);
  if (isNaN(BATCH_SIZE) || BATCH_SIZE <= 0) {
    console.log('Invalid number. Exiting.');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    while (true) {
      console.log(`Fetching a batch of ${BATCH_SIZE} newest items...`);
      await page.goto('https://www.vinted.co.uk/catalog?search_id=26450535328&page=1&order=newest_first', { waitUntil: 'networkidle' });
      await page.waitForSelector('div[data-testid="grid-item"]', { timeout: 20000 });

      const items = await page.$$('div[data-testid="grid-item"]');
      const trackedItems = [];

      for (const item of items.slice(0, BATCH_SIZE)) {
        const name = await item.$eval('[data-testid$="--description-title"]', el => el.innerText.trim());
        const subtitle = await item.$eval('[data-testid$="--description-subtitle"]', el => el.innerText.trim());
        const price = await item.$eval('[data-testid$="--price-text"]', el => el.innerText.trim());
        const link = await item.$eval('a[data-testid$="--overlay-link"]', el => el.href);
        const image = await item.$eval('img[data-testid$="--image--img"]', el => el.src);

        trackedItems.push({ name, subtitle, price, link, image, sold: false });

        // Send initial Discord embed
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

      const batchStart = Date.now();

      while (Date.now() - batchStart < BATCH_DURATION) {
        // ✅ Parallel sold status checks
        await Promise.all(trackedItems.map(async (item) => {
          if (item.sold) return;

          const itemPage = await context.newPage();
          try {
            await itemPage.goto(item.link, { waitUntil: 'networkidle' });

            const soldElement = await itemPage.$('[data-testid="item-status--content"]');
            const isSold = soldElement ? (await soldElement.innerText()).toLowerCase().includes('sold') : false;

            if (isSold) {
              console.log(`${new Date().toLocaleTimeString()}: Item SOLD: ${item.name}`);
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
        }));

        await new Promise(r => setTimeout(r, CHECK_INTERVAL));
      }

      console.log('Batch duration ended. Moving to next batch...');
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
})();
