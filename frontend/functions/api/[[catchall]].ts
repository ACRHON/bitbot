export async function onRequest({ request, env }) {
  const url = new URL(request.url);

  // Only proxy /api/* requests
  if (!url.pathname.startsWith('/api/')) {
    return fetch(request);
  }

  // Forward to Workers API
  const apiUrl = `https://getapi.de5.net${url.pathname}${url.search}`;

  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  headers.set('Origin', 'https://dev.bitbot-dev.pages.dev');

  const authHeader = request.headers.get('Authorization');
  if (authHeader) {
    headers.set('Authorization', authHeader);
  }

  const response = await fetch(apiUrl, {
    method: request.method,
    headers,
    body: request.method !== 'GET' ? request.text() : undefined,
  });

  return new Response(response.body, {
    status: response.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-feishu-app-id',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    },
  });
}