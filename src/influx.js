/**
 * ThinFilmLab — InfluxDB v2 Client Module
 * Singleton klienta z batched writes, query i health check.
 * Fail-silent: dashboard działa bez InfluxDB.
 */
import { InfluxDB, Point } from "@influxdata/influxdb-client-browser";

// ── Konfiguracja (hardcoded dla projektu lab — brak .env w przeglądarce) ──
const INFLUX_URL = "http://localhost:8086";
const INFLUX_TOKEN = "tfl-dev-token-2026";
const INFLUX_ORG = "ThinFilmLab";
const INFLUX_BUCKET = "measurements";

// ── Singleton ──
let _client = null;
let _writeApi = null;

function getClient() {
  if (!_client) {
    _client = new InfluxDB({ url: INFLUX_URL, token: INFLUX_TOKEN });
  }
  return _client;
}

function getWriteApi() {
  if (!_writeApi) {
    _writeApi = getClient().getWriteApi(INFLUX_ORG, INFLUX_BUCKET, "s", {
      batchSize: 10,
      flushInterval: 5000,
      maxRetries: 3,
    });
    _writeApi.useDefaultTags({ lab: "ThinFilmLab" });
  }
  return _writeApi;
}

// ── Zapis punktu pomiarowego ──
export function writeDataPoint(data) {
  try {
    const pt = new Point("process_data")
      .floatField("pv1", data.pv1 ?? 0)
      .floatField("pv2", data.pv2 ?? 0)
      .floatField("sp1", data.sp1 ?? 0)
      .floatField("mv", data.mv ?? 0)
      .floatField("outAnalog", data.outA ?? 0)
      .floatField("ch3", data.ch3 ?? 0)
      .tag("source", data._source || "demo");

    for (let i = 1; i <= 4; i++) {
      const key = `mfc${i}`;
      if (data[key] !== undefined) pt.floatField(key, data[key]);
    }

    getWriteApi().writePoint(pt);
  } catch (e) {
    console.warn("[influx] write error:", e.message);
  }
}

// ── Zapytanie historyczne ──
export async function queryHistory(range = "-1h") {
  try {
    const queryApi = getClient().getQueryApi(INFLUX_ORG);

    // Aggregacja zależna od zakresu (unikamy tysięcy punktów)
    const aggMap = { "-1h": null, "-6h": "30s", "-24h": "2m", "-7d": "10m" };
    const agg = aggMap[range] || null;

    let flux = `from(bucket: "${INFLUX_BUCKET}")
  |> range(start: ${range})
  |> filter(fn: (r) => r._measurement == "process_data")`;

    if (agg) {
      flux += `\n  |> aggregateWindow(every: ${agg}, fn: mean, createEmpty: false)`;
    }

    flux += `\n  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> sort(columns: ["_time"])`;

    const isLong = range === "-7d";
    const rows = [];

    return new Promise((resolve, reject) => {
      queryApi.queryRows(flux, {
        next(row, tableMeta) {
          const o = tableMeta.toObject(row);
          const d = new Date(o._time);
          const hh = d.getHours().toString().padStart(2, "0");
          const mm = d.getMinutes().toString().padStart(2, "0");
          const ss = d.getSeconds().toString().padStart(2, "0");
          const t = isLong
            ? `${d.getDate().toString().padStart(2,"0")}/${(d.getMonth()+1).toString().padStart(2,"0")} ${hh}:${mm}`
            : `${hh}:${mm}:${ss}`;

          rows.push({
            t,
            _ts: d.getTime(),
            pv1: o.pv1 ?? 0,
            pv2: o.pv2 ?? 0,
            sp1: o.sp1 ?? 0,
            profSP: o.sp1 ?? 0,
            ch3: o.ch3 ?? 0,
            mv: o.mv ?? 0,
            outA: o.outAnalog ?? 0,
            mfc1: o.mfc1 ?? 0,
            mfc2: o.mfc2 ?? 0,
            mfc3: o.mfc3 ?? 0,
            mfc4: o.mfc4 ?? 0,
          });
        },
        error(err) {
          console.warn("[influx] query error:", err.message);
          resolve([]);
        },
        complete() {
          resolve(rows);
        },
      });
    });
  } catch (e) {
    console.warn("[influx] query error:", e.message);
    return [];
  }
}

// ── Health check ──
export async function influxHealth() {
  try {
    const r = await fetch(`${INFLUX_URL}/health`, { signal: AbortSignal.timeout(3000) });
    const j = await r.json();
    return j.status === "pass";
  } catch {
    return false;
  }
}

// ── Flush przy zamykaniu taba ──
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    try { _writeApi?.flush(); } catch {}
  });
}
