// scripts/generate-feed.js
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const RSS = require('rss');
const fetch = require('node-fetch');

(async () => {
  const URL = 'https://www.crimsonwitch.com/codes/Genshin_Impact';
  const SELECTOR = '.code-card, .code-card.special';
  const OUTFILE = path.join(process.cwd(), 'feed.xml');

  const ICON_RAW_URL = 'https://github.com/Stillman7896/Crimson-Switch/raw/refs/heads/main/src/icon-encoded.txt';

  let iconDataUri = null;
  try {
    const res = await fetch(ICON_RAW_URL);
    if (res.ok) {
      const b64text = (await res.text()).trim();
      iconDataUri = `data:image/webp;base64,${b64text}`;
    } else {
      console.warn('Could not fetch icon-encoded.txt:', res.status);
    }
  } catch (err) {
    console.warn('Error fetching icon:', err.message);
  }

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await page.waitForSelector(SELECTOR, { timeout: 15000 }).catch(() => {});

  const items = await page.evaluate((sel) => {
    const nodes = Array.from(document.querySelectorAll(sel));
    return nodes.map(node => {
      let title = '';
      const header = node.querySelector('.code-header');
      if (header) {
        const h4span = header.querySelector('h4 span.code, h4 .code, .code');
        if (h4span) title = h4span.innerText.trim();
      }
      if (!title) {
        const anyCode = node.querySelector('.code');
        title = anyCode ? anyCode.innerText.trim() : (node.innerText.split('\n')[0] || '').trim();
      }

      const a = node.querySelector('a[href]');
      const url = a ? (new URL(a.getAttribute('href'), location.href)).href : location.href;

      const dateEl = node.querySelector('time[datetime], .date, .posted-date');
      const date = dateEl ? (dateEl.getAttribute('datetime') || dateEl.innerText) : null;

      const descEl = node.querySelector('.description, .excerpt, .content');
      const content = descEl ? descEl.innerHTML.trim() : node.innerHTML.trim();

      return { title, url, date, content };
    });
  }, SELECTOR);

  await browser.close();

  const feed = new RSS({
    title: 'CrimsonWitch — Genshin Impact Codes',
    description: 'Generated feed from crimsonwitch.com/codes/Genshin_Impact',
    feed_url: 'http://crimson-switch.orange-butterfly-2bf3.workers.dev/',
    site_url: URL,
    language: 'en',
    ...(iconDataUri ? { image_url: iconDataUri } : {})
  });

  items.forEach((it) => {
    feed.item({
      title: it.title || 'Untitled',
      description: it.content || '',
      url: it.url,
      date: it.date || undefined,
    });
  });

  fs.writeFileSync(OUTFILE, feed.xml({ indent: true }), 'utf8');
  console.log(`Wrote ${items.length} items to ${OUTF
      ILE}`);
})();
