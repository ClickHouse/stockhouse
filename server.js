import express from 'express';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3000;

// Parse raw body for SQL queries
app.use(express.text({ type: '*/*', limit: '10mb' }));

// ClickHouse connection details
const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL;
const CLICKHOUSE_USER = process.env.CLICKHOUSE_USER;
const CLICKHOUSE_PASSWORD = process.env.CLICKHOUSE_PASSWORD;

// CORS middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Query endpoint
app.post('/api/query', async (req, res) => {

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
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
  console.log(`ClickHouse URL: ${CLICKHOUSE_URL}`);
  console.log(`Endpoint: POST http://localhost:${PORT}/api/query`);
  console.log('\nIn another terminal, run: npm run frontend');
});
