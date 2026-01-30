addEventListener('fetch', event => {
  event.respondWith(handle(event.request));
});

const FEED_URL = 'https://raw.githubusercontent.com/youruser/yourrepo/main/feed.xml';

async function handle(req) {
  const res = await fetch(FEED_URL);
  if (!res.ok) return new Response('Not found', {status: 404});
  const body = await res.text();
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300' // 5 minutes
    }
  });
}
