import { chromium } from 'playwright';
import fetch from 'node-fetch';

// Discord webhook URL
const WEBHOOK_URL = 'https://discord.com/api/webhooks/1418689032728219678/sIkXJ-SgQYBzZX2J3p6jOwMwzdS-atWzpJfOm8_N5AdHDdF3RMgC-t1UhvfWv49WmOUo';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Go to the newest-first catalog URL
    await page.goto('https://www.vinted.co.uk/catalog?search_id=26450535328&page=1&time=1758312604&order=newest_first', { waitUntil: 'networkidle' });

    // Wait for the first listing to load
    await page.waitForSelector('[data-testid^="product-item-id-"]', { timeout: 10000 });

    // Grab the first listing
    const firstItem = await page.$('[data-testid^="product-item-id-"]');

    if (!firstItem) {
      console.log('No items found.');
      await browser.close();
      return;
    }

    const name = await firstItem.$eval('[data-testid$="--description-title"]', el => el.innerText.trim());
    const price = await firstItem.$eval('[data-testid$="--price-text"]', el => el.innerText.trim());
    const link = await firstItem.$eval('a[data-testid$="--overlay-link"]', el => el.href);
    const image = await firstItem.$eval('img[data-testid$="--image--img"]', el => el.src);

    console.log('First item:', { name, price, link, image });

    // Send initial embed to Discord
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [
          {
            title: name,
            url: link,
            description: `Price: **${price}**`,
            color: 0x1abc9c,
            image: { url: image },
            footer: { text: 'Vinted.co.uk' }
          }
        ]
      })
    });
    console.log('Sent initial listing to Discord!');

    // Periodically check every 10 seconds if sold
    const interval = setInterval(async () => {
      try {
        await page.reload({ waitUntil: 'networkidle' });
        const sold = await firstItem.$('[data-testid="item-status--content"]');

        if (sold) {
          const status = await sold.innerText();
          if (status.toLowerCase() === 'sold') {
            console.log(`Item "${name}" has been sold!`);

            await fetch(WEBHOOK_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                embeds: [
                  {
                    title: `${name} - SOLD`,
                    url: link,
                    description: `Price: **${price}**\nStatus: SOLD`,
                    color: 0xe74c3c,
                    image: { url: image },
                    footer: { text: 'Vinted.co.uk' }
                  }
                ]
              })
            });

            clearInterval(interval); // Stop checking once sold
          }
        } else {
          console.log('Item not sold yet.');
        }
      } catch (err) {
        console.error('Error checking sold status:', err);
      }
    }, 10000);

  } catch (err) {
    console.error('Error:', err);
    await browser.close();
  }
})();
