import { chromium } from 'playwright';

const WEBHOOK_URL = 'https://discord.com/api/webhooks/1418689032728219678/sIkXJ-SgQYBzZX2J3p6jOwMwzdS-atWzpJfOm8_N5AdHDdF3RMgC-t1UhvfWv49WmOUo';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Catalog URL sorted by newest first
    await page.goto('https://www.vinted.co.uk/catalog?search_id=26450535328&page=1&time=1758312604&order=newest_first', { waitUntil: 'networkidle' });

    // Wait for first item
    await page.waitForSelector('div[data-testid="grid-item"]', { timeout: 20000 });

    const firstItem = await page.$('div[data-testid="grid-item"]');

    if (firstItem) {
      const name = await firstItem.$eval('[data-testid$="--description-title"]', el => el.innerText.trim());
      const subtitle = await firstItem.$eval('[data-testid$="--description-subtitle"]', el => el.innerText.trim());
      const price = await firstItem.$eval('[data-testid$="--price-text"]', el => el.innerText.trim());
      const link = await firstItem.$eval('a[data-testid$="--overlay-link"]', el => el.href);
      const image = await firstItem.$eval('img[data-testid$="--image--img"]', el => el.src);

      console.log('First item:', { name, subtitle, price, link, image });

      // Send embed to Discord
      await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [
            {
              title: name,
              url: link,
              description: `${subtitle}\nPrice: **${price}**`,
              color: 0x1abc9c,
              image: { url: image },
              footer: { text: 'Vinted.co.uk' }
            }
          ]
        })
      });

      console.log('Sent to Discord webhook!');
    } else {
      console.log('No items found.');
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
})();
