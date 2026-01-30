// scripts/generate-feed.js
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const RSS = require('rss');

(async () => {
  const URL = 'https://www.crimsonwitch.com/codes/Genshin_Impact';
  const SELECTOR = '.code-card, .code-card.special';
  const OUTFILE = path.join(process.cwd(), 'feed.xml');

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: 'networkidle2' });

  // Wait for at least one card to appear
  await page.waitForSelector(SELECTOR, { timeout: 15000 }).catch(() => {});

  const items = await page.evaluate((sel) => {
    const nodes = Array.from(document.querySelectorAll(sel));
    return nodes.map(node => {
      // Try to extract reasonable fields; adjust selectors inside each card if needed
      const titleEl = node.querySelector('h2, .title, .code-title') || node.querySelector('a');
      const linkEl = node.querySelector('a[href]') || titleEl;
      const dateEl = node.querySelector('time[datetime], .date, .posted-date');
      const descEl = node.querySelector('.description, .excerpt, .content') || node;

      const title = titleEl ? titleEl.innerText.trim() : (node.innerText.split('\n')[0] || '').trim();
      const url = linkEl && linkEl.href ? (new URL(linkEl.getAttribute('href'), location.href)).href : URL;
      const date = dateEl ? (dateEl.getAttribute('datetime') || dateEl.innerText) : null;
      const content = descEl ? descEl.innerHTML.trim() : node.innerHTML.trim();

      return { title, url, date, content };
    });
  }, SELECTOR);

  await browser.close();

  // Build RSS
  const feed = new RSS({
    title: 'CrimsonWitch — Genshin Impact Codes',
    description: 'Generated feed from crimsonwitch.com/codes/Genshin_Impact',
    feed_url: 'https://example.com/feed.xml',
    site_url: URL,
    language: 'en'
  });

  items.forEach((it) => {
    // Normalize/parse date if possible; RSS library accepts date strings
    const item = {
      title: it.title || 'Untitled',
      description: it.content || '',
      url: it.url || URL,
      date: it.date || undefined
    };
    feed.item(item);
  });

  fs.writeFileSync(OUTFILE, feed.xml({ indent: true }), 'utf8');
  console.log(`Wrote ${items.length} items to ${OUTFILE}`);
})();
