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
      return res.status(400).json({ error: 'Query must be a string' });
    }

    // Log connection info
    const connectionHeader = req.headers.connection || 'not set';
    const keepAlive = req.socket.remoteAddress;
    const socketReused = req.socket._handle ? 'reused' : 'new';
    
    console.log(`[${new Date().toISOString()}] Query (${query.length} bytes) | Connection: ${connectionHeader} | Socket: ${socketReused}`);
    
    // Add FORMAT Arrow if not already present
    const queryWithFormat = query.trim().toUpperCase().includes('FORMAT') 
      ? query 
      : `${query.trim()} FORMAT Arrow`;
    const start = Date.now();
    // Make HTTP request to ClickHouse
    const response = await fetch(CLICKHOUSE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'X-ClickHouse-User': CLICKHOUSE_USER,
        'X-ClickHouse-Key': CLICKHOUSE_PASSWORD,
      },
      body: queryWithFormat,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ClickHouse error: ${errorText}`);
    }
    const execTime = Date.now() - start;
    console.log(`[${new Date().toISOString()}] Query (${query.length} bytes) | Connection: ${connectionHeader} | Socket: ${socketReused} | Exec time: ${execTime} ms`);
    const buffer = await response.arrayBuffer();
    
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-ClickHouse-Format', 'Arrow');
    res.setHeader('X-Connection-Reused', req.headers.connection === 'keep-alive' ? 'true' : 'false');
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Query error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✓ API server running on http://localhost:${PORT}`);
  console.log(`✓ ClickHouse URL: ${CLICKHOUSE_URL}`);
  console.log(`✓ Endpoint: POST http://localhost:${PORT}/api/query`);
  console.log('\n💡 In another terminal, run: npm run frontend');
});
