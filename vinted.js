// vinted.js
import { chromium } from 'playwright';
import fetch from 'node-fetch'; // make sure node-fetch is installed
const WEBHOOK_URL = 'https://discord.com/api/webhooks/1418689032728219678/sIkXJ-SgQYBzZX2J3p6jOwMwzdS-atWzpJfOm8_N5AdHDdF3RMgC-t1UhvfWv49WmOUo';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
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
        // Refresh the item page
        await page.goto(link, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000); // wait for the DOM to update

        const soldElement = await page.$('[data-testid="item-status--content"]');
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
            clearInterval(interval); // stop checking
            await browser.close();
          } else {
            console.log(`${new Date().toLocaleTimeString()}: Item still available.`);
          }
        } else {
          console.log(`${new Date().toLocaleTimeString()}: Sold status element not found, item still available.`);
        }
      } catch (err) {
        console.error('Error checking sold status:', err);
      }
    };

    // Start checking every 10 seconds
    const interval = setInterval(() => {
      checkSoldStatus().catch(console.error);
    }, 10000);

  } catch (err) {
    console.error('Error:', err);
    await browser.close();
  }
})();
