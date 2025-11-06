// Use local API proxy for connection pooling
// In production: /api/query (Vercel serverless function)
// In dev: proxied through Vite to /api/query
const apiUrl = '/api/query';

export async function executeQuery(query, format = 'arrow') {
    const url = format === 'json' ? `${apiUrl}?format=json` : apiUrl;
    
    const response = await fetch(url, {
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

    if (format === 'json') {
      const jsonData = await response.json();
      return { data: jsonData, format: 'json' };
    }

    const rows = await response.arrayBuffer();
    return {rows, has_rows: rows.byteLength > 842};
}

