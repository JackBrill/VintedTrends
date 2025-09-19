// vinted.js
import { chromium } from 'playwright';
import fetch from 'node-fetch';

const WEBHOOK_URL = 'https://discord.com/api/webhooks/1418689032728219678/sIkXJ-SgQYBzZX2J3p6jOwMwzdS-atWzpJfOm8_N5AdHDdF3RMgC-t1UhvfWv49WmOUo';
const CHECK_INTERVAL = 10000; // 10 seconds
const BATCH_DURATION = 5 * 60 * 1000; // 5 minutes

// List of proxies in format ip:port:username:password
const PROXIES = [
  "142.111.48.253:7030:mtqikwov:autmrqhdcnfn",
  "198.23.239.134:6540:mtqikwov:autmrqhdcnfn",
  "45.38.107.97:6014:mtqikwov:autmrqhdcnfn",
  "107.172.163.27:6543:mtqikwov:autmrqhdcnfn",
  "64.137.96.74:6641:mtqikwov:autmrqhdcnfn",
  "154.203.43.247:5536:mtqikwov:autmrqhdcnfn",
  "84.247.60.125:6095:mtqikwov:autmrqhdcnfn",
  "216.10.27.159:6837:mtqikwov:autmrqhdcnfn",
  "142.111.67.146:5611:mtqikwov:autmrqhdcnfn",
  "142.147.128.93:6593:mtqikwov:autmrqhdcnfn"
];

function randomProxy() {
  const p = PROXIES[Math.floor(Math.random() * PROXIES.length)];
  const [server, port, username, password] = p.split(':');
  return { server, port, username, password };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    let retryCount = 0;
    const BATCH_SIZE = 10; // Adjust as needed

    // Retry loop for loading items
    while (retryCount < 5) {
      console.log(`Fetching batch of ${BATCH_SIZE} newest items (attempt ${retryCount + 1})...`);

      // Optional: rotate proxy for each retry
      const proxy = randomProxy();
      console.log(`Using proxy ${proxy.server}:${proxy.port}`);
      await page.close();
      const newContext = await browser.newContext({
        proxy: {
          server: `http://${proxy.server}:${proxy.port}`,
          username: proxy.username,
          password: proxy.password
        }
      });
      const newPage = await newContext.newPage();

      await newPage.goto('https://www.vinted.co.uk/catalog?search_id=26450535328&page=1&order=newest_first', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await newPage.waitForTimeout(2000);

      const items = await newPage.$$('div.feed-grid__item');
      if (!items.length) {
        console.log('No items found, retrying...');
        retryCount++;
        continue;
      }

      const trackedItems = [];
      for (const item of items.slice(0, BATCH_SIZE)) {
        try {
          const name = await item.$eval('[data-testid$="--description-title"]', el => el.innerText.trim());
          const subtitle = await item.$eval('[data-testid$="--description-subtitle"]', el => el.innerText.trim());
          const price = await item.$eval('[data-testid$="--price-text"]', el => el.innerText.trim());
          const link = await item.$eval('a[data-testid$="--overlay-link"]', el => el.href);
          const image = await item.$eval('img[data-testid$="--image--img"]', el => el.src);

          trackedItems.push({ name, subtitle, price, link, image, sold: false });

          // Send to Discord
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
          console.error('Skipped item due to error:', err.message);
        }
      }

      // Sold check loop
      const batchStart = Date.now();
      const interval = setInterval(async () => {
        for (const item of trackedItems) {
          if (item.sold) continue;
          try {
            const itemPage = await context.newPage();
            await itemPage.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await itemPage.waitForTimeout(1000);

            const soldEl = await itemPage.$('[data-testid="item-status--content"]');
            const isSold = soldEl ? (await soldEl.innerText()).toLowerCase().includes('sold') : false;

            if (isSold) {
              console.log(`${new Date().toLocaleTimeString()}: SOLD -> ${item.name}`);
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
              console.log(`${new Date().toLocaleTimeString()}: Available -> ${item.name}`);
            }

            await itemPage.close();
          } catch (err) {
            console.error(`Error checking item ${item.name}:`, err.message);
          }
        }

        if (Date.now() - batchStart > BATCH_DURATION) {
          clearInterval(interval);
          console.log('Batch finished. Moving to next batch...');
        }
      }, CHECK_INTERVAL);

      break; // exit retry loop if items loaded
    }

  } catch (err) {
    console.error('Fatal error:', err);
  } finally {
    // Keep browser open to allow sold checks; close manually if desired
  }
})();
