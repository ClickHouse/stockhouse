# StockHouse - Real-time market analytics with ClickHouse

StockHouse combines live market data from [Massive](https://massive.com), storage and analytics powered by ClickHouse, and real-time visualization with [Perspective](https://perspective.finos.org).

It’s a complete demo of how to build a high-performance streaming analytics app.

Available at https://stockhouse.clickhouse.com

## Overview

StockHouse ingests real-time market data — both stock and crypto — directly from [Massive WebSocket APIs](https://massive.com/docs/websocket/quickstart), storing it in ClickHouse for fast querying and serving through a live dashboard built with Perspective.

This setup demonstrates how to handle streaming financial data, store it efficiently, and visualize it with millisecond updates.

This [blog](https://clickhouse.com/blog/build-a-real-time-market-data-app-with-clickhouse-and-polygonio) explains in detail the concepts behind building this application. 

## Motivation

Financial data moves fast and traditional systems can’t always keep up.

StockHouse shows how to build a scalable analytics system that can handle millions of updates per second, while still offering:
- Low-latency, high-concurrency queries
- Efficient ingestion of streaming data
- Smooth, real-time visualizations

This is a practical demo for engineers and analysts interested in building real-time dashboards, trading monitors, or financial observability tools.

## Features

- **Real-time data ingestion** from Massive WebSocket APIs for stocks and cryptocurrencies
- **High-performance storage** with ClickHouse optimized for time-series data
- **Live visualizations** using Perspective with millisecond-level updates
- **Scalable architecture** handling millions of updates per second

## Architecture

StockHouse consists of five main components:

1. **Data Source** – Massive WebSocket APIs streaming real-time market data
2. **Ingester** – Go-based service that consumes WebSocket data and writes to ClickHouse
3. **Database** – ClickHouse tables optimized for time-series ingestion and aggregation
4. **Backend** – Node.js API server for querying ClickHouse
5. **Frontend** – Vue.js dashboard with Perspective for real-time visualization

## Prerequisites

Before you begin, ensure you have:

- **Node.js** >= 18
- **npm** >= 9
- **Docker** (for running the ingester)
- **ClickHouse** >= 24.3 ([ClickHouse Cloud](https://clickhouse.com/cloud) or self-hosted)
- **Massive API key** ([Sign up here](https://massive.com))

## Getting started

You can explore the public demo at [https://stockhouse.clickhouse.com](https://stockhouse.clickhouse.com) or deploy it locally by following these steps.

### 1. Set up ClickHouse

Run the schema script to set up all required tables and materialized views:

```bash
clickhouse-client --query "CREATE DATABASE stockhouse"
clickhouse-client --database stockhouse < scripts/schema.sql
```

The schema includes:
- **Base tables**: `trades`, `quotes`, `crypto_trades`, `crypto_quotes`, `stock_fmv`
- **Aggregate tables**: Daily aggregations for quotes and trades
- **Materialized views**: Automatic real-time aggregation of trading data

### 2. Run the ingester

The ingester is a Go-based service that connects to Massive WebSocket APIs and streams data into ClickHouse.

**Build the Docker image** from the `ingester-go` directory:

```bash
cd ingester-go
docker build -t massive-ingester:latest .
```

**Run the ingester** with your credentials:

```bash
docker run --rm \
  -e CLICKHOUSE_HOST=your-instance.clickhouse.cloud:9440 \
  -e CLICKHOUSE_USER=default \
  -e CLICKHOUSE_PASSWORD='your_password' \
  -e CLICKHOUSE_DB=stockhouse \
  -e MASSIVE_API_KEY=your_api_key \
  massive-ingester:latest
```

**Environment variables:**
- `CLICKHOUSE_HOST` - ClickHouse host and native port (e.g., `your-instance.clickhouse.cloud:9440` or `host.docker.internal:9000` if running the server locally)
- `CLICKHOUSE_USER` - ClickHouse username (usually `default`)
- `CLICKHOUSE_PASSWORD` - ClickHouse password
- `CLICKHOUSE_DB` - Database name (`stockhouse`)
- `MASSIVE_API_KEY` - Your Massive API key

The ingester will start streaming data immediately. You should see log messages indicating successful connections and data ingestion.

### 3. Run the application

**Install dependencies:**

```bash
npm install
```

**Configure environment variables:**

Copy `.env.example` to `.env.local` and set your credentials:

```bash
CLICKHOUSE_URL=https://your-instance.clickhouse.cloud:8443
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=your_password
CLICKHOUSE_DB=stockhouse
```

> **Note**: The application uses the HTTP(S) interface (port 8443 for ClickHouse Cloud, 8123 for self-hosted).

**Start the backend API server:**

```bash
npm run dev
```

The backend server will start on `http://localhost:3000`.

**Start the frontend dashboard:**

In a new terminal:

```bash
npm run frontend
```

**Access the dashboard:**

Open [http://localhost:5173](http://localhost:5173) in your browser to view the live dashboard.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.


