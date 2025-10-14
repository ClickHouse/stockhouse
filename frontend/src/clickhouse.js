// ClickHouse connection (read-only credentials)
const chUser = import.meta.env.VITE_CH_USER;
const chPassword = import.meta.env.VITE_CH_PASSWORD;
const clickhouse_url = import.meta.env.VITE_CH_URL;
const credentials = btoa(`${chUser}:${chPassword}`);
const authHeader = `Basic ${credentials}`;
if (!clickhouse_url || !chUser || !chPassword) {
  console.error("Missing Vite env vars: VITE_CH_URL, VITE_CH_USER, VITE_CH_PASSWORD");
}

export async function executeQuery(query) {
    const response = await fetch(clickhouse_url, {
    method: "POST",
    body: query,
    headers: { Authorization: authHeader }
    });

    const rows = await response.arrayBuffer();

    return {rows, has_rows: rows.byteLength > 842};
}

