const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const RSS = require('rss');
const cheerio = require('cheerio');
const fetch = globalThis.fetch;   

(async () => {
  const PAGE_URL = 'https://www.crimsonwitch.com/codes/Genshin_Impact';
  const CARD_SELECTOR = '.code-card, .code-card.special';
  const OUTFILE = path.join(process.cwd(), 'feed.xml');
  const ICON_RAW_URL = 'https://github.com/Stillman7896/Crimson-Switch/raw/refs/heads/main/src/icon-encoded.txt';

  let iconDataUri = null;
  try {
    const res = await fetch(ICON_RAW_URL);
    if (res.ok) {
      const b64 = (await res.text()).trim();
      if (b64) iconDataUri = `data:image/webp;base64,${b64}`;
    }
  } catch (_) {}

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto(PAGE_URL, { waitUntil: 'networkidle2' });

  const rawCards = await page.evaluate((sel) => {
    const nodes = Array.from(document.querySelectorAll(sel));
    return nodes.map(node => ({

      title: (node.querySelector('.code-header span.code')?.innerText.trim() ||
              node.querySelector('.code')?.innerText.trim() ||
              node.innerText.split('\n')[0].trim()),

      url: (node.querySelector('a[href]')?.href || location.href),

      html: node.innerHTML
    }));
  }, CARD_SELECTOR);

  await browser.close();

  function absolutifyImages(html, baseUrl) {
    const $ = cheerio.load(html);
    $('img').each((_, img) => {
      const $img = $(img);
      const src = $img.attr('src');
      if (src) {
        try {
          const abs = new URL(src, baseUrl).href;
          $img.attr('src', abs);
        } catch (_) {

        }
      }
    });
    return $.html();
  }

  const cleanedItems = rawCards.map(card => {
    const $ = cheerio.load(card.html);

    $('svg').remove();

    $('img').each((_, img) => {
      const $img = $(img);
      const src = $img.attr('src');
      if (src) {
        try {
          const abs = new URL(src, PAGE_URL).href;
          $img.attr('src', abs);
        } catch (_) {}
      }
    });

    const description = $.html();

    return {
      title: card.title || 'Untitled',
      url: card.url,
      description
    };
  });

  const feed = new RSS({
    title: 'CrimsonWitch — Genshin Impact Codes',
    description: 'Feed generated from crimsonwitch.com/codes/Genshin_Impact',
    feed_url: 'http://crimson-switch.orange-butterfly-2bf3.workers.dev/',
    site_url: PAGE_URL,
    language: 'en',
    ...(iconDataUri ? { image_url: iconDataUri } : {})
  });

  cleanedItems.forEach(item => {
    feed.item({
      title: item.title,
      description: item.description,
      url: item.url
    });
  });

  fs.writeFileSync(OUTFILE, feed.xml({ indent: true }), 'utf8');
  console.log(`✅  ${cleanedItems.length} items written to ${OUTFILE}`);
})();

