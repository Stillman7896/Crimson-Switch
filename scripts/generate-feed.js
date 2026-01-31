// scripts/generate-feed.js
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const RSS = require('rss');
const fetch = globalThis.fetch || require('node-fetch');

(async () => {
  const URL = 'https://www.crimsonwitch.com/codes/Genshin_Impact';
  const SELECTOR = '.code-card, .code-card.special';
  const OUTFILE = path.join(process.cwd(), 'feed.xml');
  const ICON_RAW_URL = 'https://github.com/Stillman7896/Crimson-Switch/raw/refs/heads/main/src/icon-encoded.txt';

  // Fetch icon base64 text and build data: URI (default to PNG; change MIME if needed)
  let iconDataUri = null;
  try {
    const res = await fetch(ICON_RAW_URL);
    if (res.ok) {
      const b64text = (await res.text()).trim();
      if (b64text) iconDataUri = `data:image/png;base64,${b64text}`;
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

  // Evaluate in page context: extract items and convert relative src/href/style url(...) to absolute
  const items = await page.evaluate((sel, pageUrl) => {
    function absoluifyDocumentFragment(html, base) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Make src/href absolute for common tags
      const SRC_TAGS = ['img','script','iframe','source','audio','video','track','embed'];
      SRC_TAGS.forEach(tag => {
        doc.querySelectorAll(tag).forEach(el => {
          if (el.hasAttribute('src')) {
            try { el.src = new URL(el.getAttribute('src'), base).href; } catch(e) {}
          }
        });
      });

      // hrefs (anchors, link)
      ['a','link'].forEach(tag => {
        doc.querySelectorAll(tag).forEach(el => {
          if (el.hasAttribute('href')) {
            try { el.href = new URL(el.getAttribute('href'), base).href; } catch(e) {}
          }
        });
      });

      // Inline styles with url(...)
      doc.querySelectorAll('[style]').forEach(el => {
        try {
          el.style.cssText = el.style.cssText.replace(/url\((['"]?)(.*?)\1\)/g, (_,q,p) => {
            try { return `url("${new URL(p, base).href}")`; } catch (e) { return `url("${p}")`; }
          });
        } catch (e) {}
      });

      // <style> blocks (CSS rules)
      doc.querySelectorAll('style').forEach(styleEl => {
        try {
          styleEl.textContent = styleEl.textContent.replace(/url\((['"]?)(.*?)\1\)/g, (_,q,p) => {
            try { return `url("${new URL(p, base).href}")`; } catch (e) { return `url("${p}")`; }
          });
        } catch (e) {}
      });

      return doc.body.innerHTML;
    }

    const base = (new URL(pageUrl)).origin;
    const nodes = Array.from(document.querySelectorAll(sel));
    return nodes.map(node => {
      // Title: .code inside .code-header > h4 > span (fallbacks included)
      let title = '';
      const header = node.querySelector('.code-header');
      if (header) {
        const h4span = header.querySelector('h4 span.code, h4 .code, h4 span, span.code');
        if (h4span) title = h4span.innerText.trim();
      }
      if (!title) {
        const anyCode = node.querySelector('.code');
        title = anyCode ? anyCode.innerText.trim() : (node.innerText.split('\n')[0] || '').trim();
      }

      // Link: first anchor href within card
      const a = node.querySelector('a[href]');
      const url = a ? (new URL(a.getAttribute('href'), pageUrl).href) : pageUrl;

      const dateEl = node.querySelector('time[datetime], .date, .posted-date');
      const date = dateEl ? (dateEl.getAttribute('datetime') || dateEl.innerText) : null;

      // Extract innerHTML and convert relative URLs to absolute
      const rawHtml = node.innerHTML;
      const content = absoluifyDocumentFragment(rawHtml, pageUrl);

      return { title, url, date, content };
    });
  }, SELECTOR, URL);

  await browser.close();

  // Build RSS feed
  const feed = new RSS({
    title: 'CrimsonWitch — Genshin Impact Codes',
    description: 'Generated feed from crimsonwitch.com/codes/Genshin_Impact',
    feed_url: 'http://crimson-switch.orange-butterfly-2bf3.workers.dev/',
    site_url: URL,
    language: 'en',
    ...(iconDataUri ? { image_url: iconDataUri } : {})
  });

  items.forEach(it => {
    feed.item({
      title: it.title || 'Untitled',
      description: it.content || '',
      url: it.url,
      date: it.date || undefined
    });
  });

  fs.writeFileSync(OUTFILE, feed.xml({ indent: true }), 'utf8');
  console.log(`Wrote ${items.length} items to $
        {OUTFILE}`);
})();
