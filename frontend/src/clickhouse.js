// Use local API proxy for connection pooling
// In production: /api/query (Vercel serverless function)
// In dev: proxied through Vite to /api/query
const apiUrl = '/api/query';

export async function executeQuery(query) {
    const response = await fetch(apiUrl, {
        method: "POST",
        body: query,
        headers: { 
        'Content-Type': 'text/plain'
        }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Query failed: ${error}`);
    }

    // Log connection reuse info (visible in console)
    const connectionReused = response.headers.get('X-Connection-Reused');
    if (connectionReused) {
      console.log(`[Connection] Reused: ${connectionReused}`);
    }

    const rows = await response.arrayBuffer();

    return {rows, has_rows: rows.byteLength > 842};
}

