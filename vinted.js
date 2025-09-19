import { chromium } from 'playwright';
import fetch from 'node-fetch';
import readline from 'readline';

const WEBHOOK_URL = 'https://discord.com/api/webhooks/1418689032728219678/sIkXJ-SgQYzZX2J3p6jOwMwzdS-atWzpJfOm8_N5AdHDdF3RMgC-t1UhvfWv49WmOUo';
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

  // Block images/styles/fonts for faster catalog load
  await page.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (['image', 'stylesheet', 'font'].includes(type)) route.abort();
    else route.continue();
  });

  try {
    while (true) {
      let items = [];
      let retryCount = 0;

      // Retry loop for slow-loading pages
      while (items.length < BATCH_SIZE && retryCount < 5) {
        console.log(`Fetching a batch of ${BATCH_SIZE} newest items (attempt ${retryCount + 1})...`);
        await page.goto('https://www.vinted.co.uk/catalog?search_id=26450535328&page=1&order=newest_first', 
                        { waitUntil: 'domcontentloaded', timeout: 45000 });

        // Scroll to load more if needed
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(2000);

        items = await page.$$('div.homepage-blocks__item');

        if (items.length < BATCH_SIZE) {
          console.log(`Loaded ${items.length} items, waiting for more...`);
          await new Promise(r => setTimeout(r, 3000));
        }
        retryCount++;
      }

      if (!items.length) {
        console.log('No items found after retries. Waiting 10s before retrying...');
        await new Promise(r => setTimeout(r, 10000));
        continue;
      }

      const trackedItems = [];

      for (const item of items.slice(0, BATCH_SIZE)) {
        try {
          const name = await item.$eval('a', el => el.getAttribute('title') || 'No Title');
          const link = await item.$eval('a', el => el.href);
          const image = await item.$eval('img', el => el.src);
          let price = 'Unknown';
          try { price = await item.$eval('span', el => el.innerText.trim()); } catch {}
          let subtitle = '';
          try { subtitle = await item.$eval('p', el => el.innerText.trim()); } catch {}

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
        } catch (err) {
          console.error('Skipped an item due to error:', err.message);
        }
      }

      const batchStart = Date.now();

      while (Date.now() - batchStart < BATCH_DURATION) {
        await Promise.all(trackedItems.map(async (item) => {
          if (item.sold) return;

          const itemPage = await context.newPage();
          await itemPage.route('**/*', (route) => {
            const type = route.request().resourceType();
            if (['image', 'stylesheet', 'font'].includes(type)) route.abort();
            else route.continue();
          });

          try {
            await itemPage.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 15000 });

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
            console.error(`Skipped item (timeout or error): ${item.name}`, err.message);
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
