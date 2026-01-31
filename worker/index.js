addEventListener('fetch', event => {
  event.respondWith(handle(event.request));
});

const RAW_FEED_URL = 'https://raw.githubusercontent.com/Stillman7896/Crimson-Switch/refs/heads/main/feed.xml';
 
async function handle(req) {
  try {
    const res = await fetch(RAW_FEED_URL, { cf: { cacheEverything: true } });
    if (!res.ok) return new Response('Feed not found', { status: 404 });
    const body = await res.text();
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=300'
      }
    });
  } catch (err) {
    return new Response('Error fetching feed', { status: 502 });
  }
}
