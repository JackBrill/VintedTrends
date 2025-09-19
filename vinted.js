import { chromium } from 'playwright';

const WEBHOOK_URL = 'https://discord.com/api/webhooks/1418689032728219678/sIkXJ-SgQYBzZX2J3p6jOwMwzdS-atWzpJfOm8_N5AdHDdF3RMgC-t1UhvfWv49WmOUo';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to the catalog page sorted by newest first
    await page.goto('https://www.vinted.co.uk/catalog?search_id=26450535328&page=1&time=1758312604&order=newest_first', { waitUntil: 'networkidle' });

    // Wait for the first item to be visible
    await page.waitForSelector('[data-testid="feed-item"]', { timeout: 10000 });

    // Extract details of the first item
    const firstItem = await page.$('[data-testid="feed-item"]');

    if (firstItem) {
      const name = await firstItem.$eval('[data-testid="feed-item--description-title"]', el => el.innerText.trim());
      const price = await firstItem.$eval('[data-testid="feed-item--price-text"]', el => el.innerText.trim());
      const link = await firstItem.$eval('a[data-testid="feed-item--overlay-link"]', el => el.href);
      const image = await firstItem.$eval('img[data-testid="feed-item--image--img"]', el => el.src);

      console.log('First item:', { name, price, link, image });

      // Send embed to Discord webhook
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

      console.log('Sent to Discord webhook as an embed!');
    } else {
      console.log('No items found.');
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
})();
