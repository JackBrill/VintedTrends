// vinted.js
import { chromium } from 'playwright';
import fetch from 'node-fetch'; // make sure node-fetch is installed
const WEBHOOK_URL = 'https://discord.com/api/webhooks/1418689032728219678/sIkXJ-SgQYzZX2J3p6jOwMwzdS-atWzpJfOm8_N5AdHDdF3RMgC-t1UhvfWv49WmOUo';

// Webshare proxies
const PROXIES = [
  '142.111.48.253:7030:mtqikwov:autmrqhdcnfn',
  '198.23.239.134:6540:mtqikwov:autmrqhdcnfn',
  '45.38.107.97:6014:mtqikwov:autmrqhdcnfn',
  '107.172.163.27:6543:mtqikwov:autmrqhdcnfn',
  '64.137.96.74:6641:mtqikwov:autmrqhdcnfn',
  '154.203.43.247:5536:mtqikwov:autmrqhdcnfn',
  '84.247.60.125:6095:mtqikwov:autmrqhdcnfn',
  '216.10.27.159:6837:mtqikwov:autmrqhdcnfn',
  '142.111.67.146:5611:mtqikwov:autmrqhdcnfn',
  '142.147.128.93:6593:mtqikwov:autmrqhdcnfn'
];

// Pick a random proxy and return credentials
function getRandomProxy() {
  const proxy = PROXIES[Math.floor(Math.random() * PROXIES.length)];
  const [ip, port, username, password] = proxy.split(':');
  return { ip, port, username, password };
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // Pick a random proxy for the context
  const { ip, port, username, password } = getRandomProxy();
  const context = await browser.newContext({
    proxy: {
      server: `http://${ip}:${port}`,
      username,
      password
    }
  });

  const page = await context.newPage();

  try {
    // Open catalog page sorted by newest first
    await page.goto('https://www.vinted.co.uk/catalog?search_id=26450535328&page=1&time=1758312604&order=newest_first', { waitUntil: 'networkidle' });
    await page.waitForSelector('div[data-testid="grid-item"]', { timeout: 20000 });

    // Grab the first listing
    const firstItem = await page.$('div[data-testid="grid-item"]');
    if (!firstItem) throw new Error('No items found.');

    const name = await firstItem.$eval('[data-testid$="--description-title"]', el => el.innerText.trim());
    const subtitle = await firstItem.$eval('[data-testid$="--description-subtitle"]', el => el.innerText.trim());
    const price = await firstItem.$eval('[data-testid$="--price-text"]', el => el.innerText.trim());
    const link = await firstItem.$eval('a[data-testid$="--overlay-link"]', el => el.href);
    const image = await firstItem.$eval('img[data-testid$="--image--img"]', el => el.src);

    console.log('First item found:', { name, subtitle, price, link, image });

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
    console.log('Sent initial listing to Discord!');

    // Function to check if item is sold
    const checkSoldStatus = async () => {
      try {
        // Rotate proxy for each sold check
        const { ip, port, username, password } = getRandomProxy();
        const itemContext = await browser.newContext({
          proxy: {
            server: `http://${ip}:${port}`,
            username,
            password
          }
        });
        const itemPage = await itemContext.newPage();

        await itemPage.goto(link, { waitUntil: 'networkidle' });
        await itemPage.waitForTimeout(2000);

        const soldElement = await itemPage.$('[data-testid="item-status--content"]');
        if (soldElement) {
          const statusText = await soldElement.innerText();
          if (statusText.toLowerCase().includes('sold')) {
            console.log(`Item is SOLD! Sending to Discord...`);
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
            console.log('Sold notification sent! Exiting.');
            clearInterval(interval);
            await browser.close();
          } else {
            console.log('Item is still available.');
          }
        } else {
          console.log('Sold status element not found, item still available.');
        }

        await itemPage.close();
        await itemContext.close();

      } catch (err) {
        console.error('Error checking sold status:', err);
      }
    };

    // Check every 10 seconds
    const interval = setInterval(checkSoldStatus, 10000);

  } catch (err) {
    console.error('Error:', err);
    await browser.close();
  }
})();
