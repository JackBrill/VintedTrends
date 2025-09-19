// vinted.js
import { chromium } from 'playwright';

const CHECK_INTERVAL = 10000; // 10 seconds
const BATCH_DURATION = 5 * 60 * 1000; // 5 minutes

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
  let context = await browser.newContext();
  let page = await context.newPage();

  const BATCH_SIZE = 10;
  let retryCount = 0;

  while (retryCount < 5) {
    const proxy = randomProxy();
    console.log(`\n=== Attempt ${retryCount + 1} ===`);
    console.log(`Using proxy: ${proxy.server}:${proxy.port}`);

    try {
      // Recreate context and page for each proxy
      await page.close().catch(() => {});
      await context.close().catch(() => {});
      context = await browser.newContext({
        proxy: {
          server: `http://${proxy.server}:${proxy.port}`,
          username: proxy.username,
          password: proxy.password
        }
      });
      page = await context.newPage();

      console.log('Navigating to Vinted catalog...');
      const response = await page.goto(
        'https://www.vinted.co.uk/catalog?search_id=26450535328&page=1&order=newest_first',
        { waitUntil: 'domcontentloaded', timeout: 30000 }
      );

      console.log(`Response status: ${response?.status()}`);
      console.log('Waiting 2 seconds for page to stabilize...');
      await page.waitForTimeout(2000);

      const items = await page.$$('div.feed-grid__item');
      console.log(`Found ${items.length} items on the page.`);

      if (items.length >= BATCH_SIZE) {
        console.log('Sufficient items loaded.');
        break;
      } else {
        console.log('Not enough items, retrying...');
        retryCount++;
      }
    } catch (err) {
      console.error('Navigation error:', err.message);
      retryCount++;
    }
  }

  if (retryCount >= 5) {
    console.error('Failed to load items after multiple retries. Exiting.');
    await browser.close();
    process.exit(1);
  }

  console.log('=== Successfully loaded items, proceeding with tracking ===');

  // Grab first item as example
  const firstItem = await page.$('div.feed-grid__item');
  if (!firstItem) {
    console.error('No first item found after page load. Exiting.');
    await browser.close();
    process.exit(1);
  }

  const name = await firstItem.$eval('[data-testid$="--description-title"]', el => el.innerText.trim());
  const subtitle = await firstItem.$eval('[data-testid$="--description-subtitle"]', el => el.innerText.trim());
  const price = await firstItem.$eval('[data-testid$="--price-text"]', el => el.innerText.trim());
  const link = await firstItem.$eval('a[data-testid$="--overlay-link"]', el => el.href);
  const image = await firstItem.$eval('img[data-testid$="--image--img"]', el => el.src);

  console.log('First item loaded:', { name, subtitle, price, link, image });

  const batchStart = Date.now();
  const interval = setInterval(async () => {
    console.log('Checking sold status...');
    try {
      const itemPage = await context.newPage();
      await itemPage.goto(link, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await itemPage.waitForTimeout(1000);

      const soldEl = await itemPage.$('[data-testid="item-status--content"]');
      const isSold = soldEl ? (await soldEl.innerText()).toLowerCase().includes('sold') : false;

      console.log(`Sold status: ${isSold ? 'SOLD' : 'Available'}`);

      if (isSold) {
        console.log(`💰 ITEM SOLD: ${name} | Price: ${price} | Link: ${link}`);
        clearInterval(interval);
        await browser.close();
      }

      await itemPage.close();
    } catch (err) {
      console.error('Error checking sold status:', err.message);
    }

    if (Date.now() - batchStart > BATCH_DURATION) {
      console.log('Batch duration finished. Exiting interval.');
      clearInterval(interval);
    }
  }, CHECK_INTERVAL);

})();
