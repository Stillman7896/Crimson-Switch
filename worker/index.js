addEventListener('fetch', event => {
  event.respondWith(handle(event.request));
});

const RAW_FEED_URL = 'https://raw.githubusercontent.com/Stillman7896/Crimson-Switch/main/feed.xml';
// If using R2 with a binding named FEEDS_BUCKET, replace fetch logic with R2 getObject (example commented below).

async function handle(req) {
  try {
    const res = await fetch(RAW_FEED_URL, { cf: { cacheEverything: true } });
    if (!res.ok) return new Response('Feed not found', { status: 404 });
    const body = await res.text();
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        // Let the worker edge cache hold it; origin update cadence controlled by your GH Action schedule.
        'Cache-Control': 'public, max-age=300, s-maxage=300'
      }
    });
  } catch (err) {
    return new Response('Error fetching feed', { status: 502 });
  }
}
