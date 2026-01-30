const fs = require('fs');
const puppeteer = require('puppeteer');
const RSS = require('rss');

(async()=>{
  const url = 'https://example.com';
  const browser = await puppeteer.launch({
    args: ['--no-sandbox','--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto(url, {waitUntil:'networkidle2'});
  await page.waitForSelector('.item'); // adjust
  const items = await page.evaluate(()=>Array.from(document.querySelectorAll('.item')).map(el=>({
    title: el.querySelector('h2')?.innerText || '',
    url: el.querySelector('a')?.href || '',
    date: el.querySelector('.date')?.getAttribute('datetime') || new Date().toISOString(),
    content: el.querySelector('.excerpt')?.innerHTML || ''
  })));
  await browser.close();

  const feed = new RSS({title:'My Feed',site_url:url,feed_url:'https://yourdomain.com/feed.xml'});
  items.forEach(i=>feed.item({
    title: i.title,
    description: i.content,
    url: i.url,
    date: i.date
  }));
  const xml = feed.xml({indent:true});
  fs.writeFileSync('feed.xml', xml);
})(
 
);
