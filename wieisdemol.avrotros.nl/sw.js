importScripts('/typo3conf/ext/avrotros_resources/Resources/Public/JavaScript/vendor/workbox-v4.3.0/workbox-sw.js'); workbox.setConfig({ modulePathPrefix: '/typo3conf/ext/avrotros_resources/Resources/Public/JavaScript/vendor/workbox-v4.3.0' });

if (workbox) {
  const TIMEOUT_PROMISE_MS = 3000;

  // Some core settings
  workbox.core.setCacheNameDetails({
    prefix: 'wieisdemol',
    suffix: 'v1'
  });

  // Workbox precaching placeholder see service-worker gulp task
  workbox.precaching.precacheAndRoute([
  {
    "url": "/offline/",
    "revision": "1fdbf27099d7b3787b666aaac3abad02"
  }
]);

  const FALLBACK_HTML_URL = workbox.precaching.getCacheKeyForURL('/offline/');
  const FALLBACK_IMAGE_URL = workbox.precaching.getCacheKeyForURL(
    '/typo3conf/ext/wieisdemol_resources/Resources/Public/GFX/widm-default-image.jpg'
  );

  const createTimeoutPromise = (promise, ms) => {
    let timeout = new Promise((resolve, reject) => {
      let id = setTimeout(() => {
        clearTimeout(id);
        reject('timeout');
      }, ms);
    });

    return Promise.race([promise, timeout]);
  };

  // Is url from eenvandaag domain
  const domainMatcher = new RegExp(
    '^http(s)?://(localhost|wieisdemol(.test|.dev)?.avrotros.nl)(?!/typo3/|$)'
  );

  const catchHandler = ({ event }) => {
    // Use event, request, and url to figure out how to respond.
    // One approach would be to use request.destination, see
    // https://medium.com/dev-channel/service-worker-caching-strategies-based-on-request-types-57411dd7652c
    switch (event.request.destination) {
      case 'document':
        return caches.match(FALLBACK_HTML_URL);
      case 'image':
        return caches.match(FALLBACK_IMAGE_URL);
      // case 'font':
      //     return caches.match(FALLBACK_FONT_URL);
      default:
        // If we don't have a fallback, just return an error response.
        return Response.error();
    }
  };

  // Cache first for images
  workbox.routing.registerRoute(
    ({ event, url }) =>
      domainMatcher.test(url) && event.request.destination === 'document',
    args =>
      new workbox.strategies.NetworkFirst({
        cacheName: 'at-document',
        networkTimeoutSeconds: 3,
        plugins: [
          new workbox.expiration.Plugin({
            maxEntries: 60,
            maxAgeSeconds: 5 * 60 // 5 min
          })
        ]
      })
        .handle(args)
        .then(response => {
          if (!response) {
            return caches.match(FALLBACK_HTML_URL);
          }

          return response;
        })
        .catch(() => caches.match(FALLBACK_HTML_URL))
  );

  // Cache first for images
  workbox.routing.registerRoute(
    ({ event, url }) =>
      domainMatcher.test(url) &&
      (event.request.destination === 'script' ||
        event.request.destination === 'style' ||
        event.request.destination === 'image'),
    args =>
      createTimeoutPromise(
        new workbox.strategies.CacheFirst({
          cacheName: 'script-style-image',
          plugins: [
            new workbox.expiration.Plugin({
              maxEntries: 120,
              maxAgeSeconds: 30 * 24 * 60 * 60 // 30 Days
            })
          ]
        }).handle(args),
        TIMEOUT_PROMISE_MS
      )
  );

  // Cache first for images
  workbox.routing.registerRoute(
    ({ event }) => event.request.destination === 'font',
    new workbox.strategies.CacheFirst({
      cacheName: 'font',
      plugins: [
        new workbox.expiration.Plugin({
          maxEntries: 20,
          maxAgeSeconds: 365 * 24 * 60 * 60 // 1 year
        })
      ]
    })
  );

  // This "catch" handler is triggered when any of the other routes fail to
  // generate a response.
  workbox.routing.setCatchHandler(catchHandler);
}
