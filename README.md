# StockHouse - Real-time Market Analytics with ClickHouse

StockHouse combines live market data from polygon.io, storage and analytics powered by ClickHouse, and real-time visualization with Perspective.

It’s a complete demo of how to build a high-performance streaming analytics app.

Available at stockhouse.clickhouse.com

## Overview

StockHouse ingests real-time market data — both stock and crypto — directly from Polygon.io WebSocket APIs, storing it in ClickHouse for fast querying and serving through a live dashboard built with perspective.finos.

This setup demonstrates how to handle streaming financial data, store it efficiently, and visualize it with millisecond updates.

This [blog](https://clickhouse.com/blog/build-a-real-time-market-data-app-with-clickhouse-and-polygonio) explains in detail the concepts behind building this application. 

## Motivation

Financial data moves fast and traditional systems can’t always keep up.

StockHouse shows how to build a scalable analytics system that can handle millions of updates per second, while still offering:
	•	Low-latency, high-concurrency queries
	•	Efficient ingestion of streaming data
	•	Smooth, real-time visualizations

This is a practical demo for engineers and analysts interested in building real-time dashboards, trading monitors, or financial observability tools.

## Architecture

StockHouse consists of three main components:
	1.	Data Source – Polygon.io WebSocket streams for stocks (Q.*) and crypto (XQ.*) tickers
	2.	Database – ClickHouse tables optimized for time-series ingestion and aggregation
	3.	UI – Perspective dashboard displaying real-time prices, volumes, and trends

## Deployment

You can explore the public demo at stockhouse.clickhouse.com or deploy it locally.

Requirements
	•	node >= 18
	•	npm >= 9
	•	Python >= 3.8 (for ingestion scripts)
	•	ClickHouse >= 24.3
	•	Polygon.io API key

### Configuration

Copy `.env.example` to `.env.local` and set your credentials:

```
POLYGON_API_KEY=<your_api_key>
CLICKHOUSE_HOST=https://your-clickhouse-host
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=
CLICKHOUSE_DB=stockhouse
```

### Running Locally

Install dependencies:

```
npm install
```

Start the ingestion service: 

```
TODO
```

Start the dashboard:

```
npm run dev
```

Open http://localhost:5173 to view the dashboard.


