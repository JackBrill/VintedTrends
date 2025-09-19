import { chromium } from 'playwright';
import fetch from 'node-fetch';

const WEBHOOK_URL = 'https://discord.com/api/webhooks/1418689032728219678/sIkXJ-SgQYBzZX2J3p6jOwMwzdS-atWzpJfOm8_N5AdHDdF3RMgC-t1UhvfWv49WmOUo';

async function checkSoldStatus(page, link) {
  try {
    await page.goto(link, { waitUntil: 'networkidle' });

    const soldElement = await page.$('[data-testid="item-status--content"]');
    let sold = false;
    if (soldElement) {
      const statusText = await soldElement.innerText();
      sold = statusText.toLowerCase() === 'sold';
    }

    // Get item info
    const name = await page.$eval('[data-testid$="--description-title"]', el => el.innerText.trim());
    const subtitle = await page.$eval('[data-testid$="--description-subtitle"]', el => el.innerText.trim());
    const price = await page.$eval('[data-testid$="--price-text"]', el => el.innerText.trim());
    const image = await page.$eval('img[data-testid$="--image--img"]', el => el.src);

    console.log(`Item: ${name} | Price: ${price} | Sold: ${sold ? 'Yes' : 'No'}`);

    if (sold) {
      await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [
            {
              title: name,
              url: link,
              description: `${subtitle}\nPrice: **${price}**\nStatus: Sold ✅`,
              color: 0xff0000,
              image: { url: image },
              footer: { text: 'Vinted.co.uk' }
            }
          ]
        })
      });
      return true; // stop interval
    }

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

  try {
    // Get newest item from catalog
    await page.goto('https://www.vinted.co.uk/catalog?search_id=26450535328&page=1&time=1758312604&order=newest_first', { waitUntil: 'networkidle' });
    await page.waitForSelector('div[data-testid="grid-item"]', { timeout: 10000 });

    const firstItem = await page.$('div[data-testid="grid-item"]');
    if (!firstItem) throw new Error('No items found.');

    const link = await firstItem.$eval('a[data-testid$="--overlay-link"]', el => el.href);
    console.log('Monitoring first item:', link);

    // Check every 10 seconds
    const interval = setInterval(async () => {
      const sold = await checkSoldStatus(page, link);
      if (sold) clearInterval(interval);
    }, 10000);

  } catch (err) {
    console.error('Error fetching first item:', err);
  }
})();
