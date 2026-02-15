const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const RSS = require('rss');
const cheerio = require('cheerio');
const fetch = globalThis.fetch;

(async () => {
  const URL = 'https://www.crimsonwitch.com/codes/Genshin_Impact';
  const SELECTOR = '.code-card, .code-card.special';
  const OUTFILE = path.join(process.cwd(), 'feed.xml');
  const ICON_RAW_URL = 'https://github.com/me/repo/raw/refs/heads/main/src/icon-encoded.txt';

  let iconDataUri = null;
  try {
    const res = await fetch(ICON_RAW_URL);
    if (res.ok) {
      const b64text = (await res.text()).trim();
      if (b64text) iconDataUri = `data:image/webp;base64,${b64text}`;
    } else {
      console.warn('Could not fetch icon‑encoded.txt:', res.status);
    }
  } catch (err) {
    console.warn('Error fetching icon:', err.message);
  }

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: 'networkidle2' });

  await page.waitForSelector('.reward-img', { timeout: 8000 }).catch(() => {
    console.warn('Reward images did not appear within timeout');
  });

  await page.evaluate(sel => {
    document.querySelectorAll(sel).forEach(el => el.scrollIntoView());
  }, SELECTOR);
  await page.waitForTimeout(1000); 

  const items = await page.evaluate((sel, pageUrl) => {

    function absoluifyDocumentFragment(html, base) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const SRC_TAGS = ['img','script','iframe','source','audio','video','track','embed'];
      SRC_TAGS.forEach(tag => {
        doc.querySelectorAll(tag).forEach(el => {
          if (el.hasAttribute('src')) {
            try { el.src = new URL(el.getAttribute('src'), base).href; } catch (_) {}
          }
        });
      });

      ['a','link'].forEach(tag => {
        doc.querySelectorAll(tag).forEach(el => {
          if (el.hasAttribute('href')) {
            try { el.href = new URL(el.getAttribute('href'), base).href; } catch (_) {}
          }
        });
      });

      doc.querySelectorAll('[style]').forEach(el => {
        try {
          el.style.cssText = el.style.cssText.replace(
            /url\((['"]?)(.*?)\1\)/g,
            (_, q, p) => {
              try { return `url("${new URL(p, base).href}")`; } catch (_) { return `url("${p}")`; }
            }
          );
        } catch (_) {}
      });

      doc.querySelectorAll('style').forEach(styleEl => {
        try {
          styleEl.textContent = styleEl.textContent.replace(
            /url\((['"]?)(.*?)\1\)/g,
            (_, q, p) => {
              try { return `url("${new URL(p, base).href}")`; } catch (_) { return `url("${p}")`; }
            }
          );
        } catch (_) {}
      });

      return doc.body.innerHTML;
    }

    const base = (new URL(pageUrl)).origin;
    const nodes = Array.from(document.querySelectorAll(sel));

    return nodes.map(node => {

      let title = '';
      const header = node.querySelector('.code-header');
      if (header) {
        const span = header.querySelector('h4 span.code, h4 .code, h4 span, span.code');
        if (span) title = span.innerText.trim();
      }
      if (!title) {
        const anyCode = node.querySelector('.code');
        title = anyCode ? anyCode.innerText.trim() : (node.innerText.split('\n')[0] || '').trim();
      }

      const a = node.querySelector('a[href]');
      const url = a ? (new URL(a.getAttribute('href'), pageUrl).href) : pageUrl;

      const dateEl = node.querySelector('time[datetime], .date, .posted-date');
      const date = dateEl ? (dateEl.getAttribute('datetime') || dateEl.innerText) : null;

      const rawHtml = node.innerHTML;
      const content = absoluifyDocumentFragment(rawHtml, pageUrl);

      return { title, url, date, content };
    });
  }, SELECTOR, URL);

  await browser.close();

  function cleanDescription(html) {
    const $ = cheerio.load(html);

    $('svg').remove();

    $('ul.rewards > li').each((_, li) => {
      const $li = $(li);
      const $img = $li.find('img.reward-img').first();

      const txt = $li.text().trim();

      let lineHtml;
      if ($img.length) {

        const alt = $img.attr('alt') ? ` ${$img.attr('alt')}` : '';
        lineHtml = `<div class="reward-line">${$img[0].outerHTML}${alt} ${txt}</div>`;
      } else {

        lineHtml = `<div class="reward-line">${txt}</div>`;
      }

      $li.html(lineHtml);
    });

    $('script').remove();
    $('[onload],[onclick],[onerror],[onmouseover],[onmouseenter]').each((_, el) => {
      const attrs = Object.keys(el.attribs || {});
      attrs.forEach(a => {
        if (/^on/i.test(a)) $(el).removeAttr(a);
      });
    });

    let out = $.html();
    out = out.replace(/\s{2,}/g, ' ').replace(/>\s+</g, '><').trim();
    return out;
  }

  const feed = new RSS({
    title: 'CrimsonWitch — Genshin Impact Codes',
    description: 'Generated feed from crimsonwitch.com/codes/Genshin_Impact',
    feed_url: 'http://crimson-switch.orange-butterfly-2bf3.workers.dev/',
    site_url: URL,
    language: 'en',
    ...(iconDataUri ? { image_url: iconDataUri } : {})
  });

  items.forEach(it => {
    const cleaned = cleanDescription(it.content);
    feed.item({
      title: it.title || 'Untitled',
      description: cleaned,
      url: it.url,
      date: it.date || undefined
    });
  });

  fs.writeFileSync(OUTFILE, feed.xml({ indent: true }), 'utf8');
  console.log(`Wrote ${items.length} items to ${OUTFILE}`);
})();
