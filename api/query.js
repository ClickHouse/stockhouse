export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const query = req.body;
    
    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'Query must be a string in request body' });
      return;
    }

    // Get format from query parameter (default: arrow)
    const format = (req.query.format || 'arrow').toLowerCase();
    const validFormats = ['arrow', 'json'];
    
    if (!validFormats.includes(format)) {
      res.status(400).json({ error: `Invalid format. Must be one of: ${validFormats.join(', ')}` });
      return;
    }

    // Add FORMAT if not already present
    const formatString = format === 'json' ? 'JSONCompact' : 'Arrow';
    const queryWithFormat = query.trim().toUpperCase().includes('FORMAT') 
      ? query 
      : `${query.trim()} FORMAT ${formatString}`;

    console.log('Query with format:', queryWithFormat);  
    
    // Make HTTP request to ClickHouse
    const response = await fetch(process.env.CLICKHOUSE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'X-ClickHouse-User': process.env.CLICKHOUSE_USER,
        'X-ClickHouse-Key': process.env.CLICKHOUSE_PASSWORD,
      },
      body: queryWithFormat,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ClickHouse error: ${errorText}`);
    }

    if (format === 'json') {
      // Return JSON response
      const jsonData = await response.json();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-ClickHouse-Format', 'JSONCompact');
      res.status(200).json(jsonData);
    } else {
      // Return Arrow binary response
      const buffer = await response.arrayBuffer();
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('X-ClickHouse-Format', 'Arrow');
      res.status(200).send(Buffer.from(buffer));
    }
  } catch (error) {
    console.error('Query error:', error);
    res.status(500).json({ error: error.message });
  }
}
