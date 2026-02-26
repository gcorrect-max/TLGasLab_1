# Endpointy i interfejsy API — ThinFilmLab Dashboard

## Przegląd

ThinFilmLab korzysta z kilku interfejsów komunikacyjnych. Żaden z nich nie jest klasycznym REST API — dashboard to aplikacja SPA (Single Page Application) komunikująca się przez WebSocket, statyczne pliki i bezpośrednie zapytania do InfluxDB.

```
┌──────────────────────────────────────────────────────────────────────┐
│  React Dashboard (http://localhost:3000)                             │
│                                                                      │
│  ├── WebSocket ←→ LabVIEW      ws://192.168.1.100:8080/ws          │
│  ├── InfluxDB REST API          http://localhost:8086                │
│  ├── Pliki statyczne (Vite)     http://localhost:3000/*             │
│  └── MySQL API (opcjonalnie)    http://localhost:3001/api/*         │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 1. Pliki statyczne (Vite Dev Server / Build)

Serwowane przez Vite w development lub nginx/Apache w production.

| Ścieżka | Plik | Typ | Opis |
|----------|------|-----|------|
| `/` | `index.html` | HTML | Punkt wejścia SPA |
| `/help.json` | `public/help.json` | JSON | Dane FAQ w PL/EN dla strony Pomoc (P9) |
| `/impedance.html` | `public/impedance.html` | HTML | Moduł impedancji (iframe w P8) |
| `/assets/*.js` | build output | JS | Bundled React app (Vite build) |
| `/assets/*.css` | build output | CSS | Style (jeśli wyodrębnione) |

### 1.1 `/help.json`

**Metoda:** `GET`
**Odpowiedź:** `200 OK` z `Content-Type: application/json`

Struktura:
```json
{
  "pl": {
    "meta": { "title": "Centrum pomocy", "search": "Szukaj...", "contact": "Kontakt" },
    "sections": [
      {
        "id": "general",
        "title": "Ogólne",
        "icon": "ℹ️",
        "items": [
          { "q": "Pytanie?", "a": "Odpowiedź." }
        ]
      }
    ]
  },
  "en": { "meta": {}, "sections": [] }
}
```

**Sekcje:** general, monitoring, settings, sample, config, reports, impedance, influxdb, troubleshooting

**Błędy:**
- `404` — plik nie istnieje (brak `public/help.json`)
- Błąd JSON parse — uszkodzony plik

### 1.2 `/impedance.html`

Standalone HTML z wykresami impedancji (Bode, Nyquist). Ładowany w `<iframe>` w P8.

**Komunikacja z dashboardem:** `window.postMessage()` (nie HTTP)

| Kierunek | Typ | Opis |
|----------|-----|------|
| iframe → parent | `impedance_request` | Żądanie pomiaru |
| parent → iframe | `impedance_data` | Dane z LabVIEW |

---

## 2. WebSocket — LabVIEW Bridge

**URL:** konfigurowalny w P4 → zakładka "WebSocket"
**Domyślnie:** `ws://192.168.1.100:8080/ws` (lub `ws://localhost:8080`)
**Protokół:** JSON over WebSocket (text frames)

Pełna dokumentacja: **[ws_protocol.md](ws_protocol.md)**

### 2.1 Połączenie

```javascript
const ws = new WebSocket(url);
```

Dashboard jest **klientem** WebSocket. LabVIEW uruchamia **serwer**.

### 2.2 Envelope (format TX)

Każdy komunikat wysyłany z dashboardu:

```json
{
  "type": "<command_type>",
  "ts": "2026-02-10T14:30:00.000Z",
  "user": { "username": "operator", "role": "user", "name": "Operator" },
  "data": { }
}
```

### 2.3 Typy komunikatów TX (Dashboard → LabVIEW)

| # | Typ | Źródło UI | Opis |
|---|-----|-----------|------|
| 1 | `hello` | Auto (onopen) | Identyfikacja klienta |
| 2 | `config_request` | Auto (onopen) | Żądanie konfiguracji |
| 3 | `setpoint_command` | P2 | Zmiana SP1/SP2/SP3 |
| 4 | `mode_command` | P2 | MAN/AUTO, START/STOP |
| 5 | `manual_mv` | P2 | Moc ręczna 0-100% |
| 6 | `pid_command` | P2 | Parametry PID (Pb, Ti, Td) |
| 7 | `alarm_clear` | P2 | Kasowanie LATCH |
| 8 | `profile_command` | P2 | Start/Stop profilu z segmentami + MFC |
| 9 | `sample_info` | P3 | Dane próbki |
| 10 | `report_create` | P7 | Nowy raport |
| 11 | `report_update` | P7 | Edycja raportu |
| 12 | `mfc_config` | P4 | Konfiguracja 4 MFC |
| 13 | `mfc_setpoint` | P4 | Nastawa per MFC (id + sp) |
| 14 | `impedance_request` | P8 (iframe) | Pomiar impedancji |

### 2.4 Typy komunikatów RX (LabVIEW → Dashboard)

| # | Typ | Handler | Częstotliwość |
|---|-----|---------|---------------|
| 1 | `measurement_update` | `setMb` + `setHist` + `writeDataPoint` | Co ~1s |
| 2 | `status_update` | `setMb` (merge) | Okresowo |
| 3 | `alarm_event` | `setMb` + `sAlog` | Na zdarzenie |
| 4 | `state_snapshot` | `setMb` (merge) | Na reconnect |
| 5 | `profile_status` | [PLANNED — brak handlera] | Okresowo |
| 6 | `impedance_data` | `setImpData` → postMessage do iframe | Na żądanie |
| 7 | `config_data` | `setMb` + `setUsers` + localStorage | Na config_request |

### 2.5 Konsola WS (P5)

Dashboard przechowuje w pamięci:
- **TX log:** 80 ostatnich wysłanych komunikatów
- **RX log:** 80 ostatnich odebranych komunikatów
- Format: `{ time, type, json }` — wyświetlane w P5

### 2.6 Funkcja `sendCmd(type, data)`

```javascript
const sendCmd = useCallback((type, data = {}) => {
  const payload = {
    type,
    ts: nowISO(),
    user: user ? { username, role, name } : null,
    data
  };
  // Zapisz do TX log
  setWsCon(s => ({ ...s, tx: [{ time, type, json }, ...s.tx].slice(0, 80) }));
  addLog(`TX: ${type}`, "ws");
  // Wyślij jeśli WS otwarty
  if (ws && ws.readyState === 1) {
    try { ws.send(JSON.stringify(payload)) }
    catch (e) { addLog(`TX fail: ${String(e)}`, "ws") }
  }
}, [addLog, user]);
```

**Uwaga:** Komenda jest zawsze zapisywana do TX log, nawet gdy WS jest rozłączony. Pozwala to na śledzenie intencji użytkownika.

---

## 3. InfluxDB v2 REST API

**URL:** `http://localhost:8086`
**Biblioteka:** `@influxdata/influxdb-client-browser`
**Moduł:** `src/influx.js`

Dashboard korzysta z InfluxDB przez klienta JS, nie przez bezpośrednie REST. Poniżej opisano zarówno API klienta jak i underlying REST endpoints.

### 3.1 Konfiguracja

| Parametr | Wartość |
|----------|---------|
| URL | `http://localhost:8086` |
| Token | `tfl-dev-token-2026` |
| Organizacja | `ThinFilmLab` |
| Bucket | `measurements` |
| Retencja | 720h (30 dni) |

### 3.2 Eksportowane funkcje (`src/influx.js`)

#### `writeDataPoint(data)`

Zapisuje punkt pomiarowy do InfluxDB.

**Parametr `data`:**
```javascript
{
  pv1: 156.3,      // Temperatura 1 (°C)
  pv2: 45.2,       // Temperatura 2 (°C)
  sp1: 200.0,      // Setpoint 1 (°C)
  mv: 67.4,        // Moc regulatora (%)
  outA: 12.8,      // Wyjście analogowe (mA)
  ch3: 100.7,      // Kanał 3
  mfc1: 120.5,     // Przepływ MFC-1 (sccm)
  mfc2: 85.0,      // Przepływ MFC-2 (sccm)
  mfc3: 0,         // Przepływ MFC-3 (sccm)
  mfc4: 0,         // Przepływ MFC-4 (sccm)
  _source: "ws"    // Tag: "ws" lub "demo"
}
```

**InfluxDB measurement:** `process_data`
**Tag:** `source` = "ws" | "demo", `lab` = "ThinFilmLab"
**Batching:** 10 punktów lub co 5 sekund
**REST underneath:** `POST /api/v2/write?org=ThinFilmLab&bucket=measurements`

#### `queryHistory(range)`

Pobiera historię pomiarów z automatycznym downsamplingiem.

**Parametr `range`:** `"-1h"` | `"-6h"` | `"-24h"` | `"-7d"`

**Downsampling:**

| Zakres | Aggregacja | Szacowana liczba punktów |
|--------|------------|--------------------------|
| `-1h` | brak (raw) | ~3 600 |
| `-6h` | `30s` mean | ~720 |
| `-24h` | `2m` mean | ~720 |
| `-7d` | `10m` mean | ~1 008 |

**Zwraca:** `Array<{ t, _ts, pv1, pv2, sp1, profSP, ch3, mv, outA, mfc1, mfc2, mfc3, mfc4 }>`

- `t` — sformatowany czas (`HH:MM:SS` lub `DD/MM HH:MM` dla 7d)
- `_ts` — timestamp w ms (do sortowania)

**REST underneath:** `POST /api/v2/query?org=ThinFilmLab` z Flux query

#### `influxHealth()`

Health check kontenera Docker.

**REST:** `GET /health`
**Odpowiedź OK:** `{ "name": "influxdb", "status": "pass" }`
**Timeout:** 3 000 ms
**Zwraca:** `boolean`

### 3.3 Flux Query (wewnętrzne)

```flux
from(bucket: "measurements")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "process_data")
  |> aggregateWindow(every: 30s, fn: mean, createEmpty: false)  // opcjonalnie
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> sort(columns: ["_time"])
```

### 3.4 Użycie w dashboardzie

| Miejsce | Funkcja | Kiedy |
|---------|---------|-------|
| `applyLvMessage` (measurement_update) | `writeDataPoint({...hp, _source: "ws"})` | Każda wiadomość WS |
| Demo PID sim | `writeDataPoint({...hp, _source: "demo"})` | Co 1s gdy brak WS |
| P1 selektor zakresu | `queryHistory(range)` | Na zmianę zakresu + co 15s |
| P5 eksport CSV | `queryHistory(range)` | Na kliknięcie eksport |
| Header LED DB | `influxHealth()` | Co 30s |
| P4 zakładka "Baza" | `influxHealth()` | Na kliknięcie "Test" |

---

## 4. MySQL API (opcjonalny backend, P3)

Zewnętrzny serwer Node.js/Express (nie jest częścią tego repo).

**Base URL:** konfigurowany w P3 (domyślnie `http://localhost:3001/api`)

### 4.1 Endpointy

| Metoda | Ścieżka | Opis | Body/Query |
|--------|---------|------|------------|
| `GET` | `/health` | Status połączenia | — |
| `POST` | `/samples` | Insert próbki | `{ sampleId, material, ... }` |
| `GET` | `/samples` | Lista wszystkich | — |
| `GET` | `/samples?field=X&q=Y` | Wyszukiwanie | `field`, `q` |
| `DELETE` | `/samples/:id` | Usuwanie próbki | — |

### 4.2 Format odpowiedzi

**Sukces:**
```json
{ "ok": true, "id": 42, "data": [...], "count": 5 }
```

**Błąd:**
```json
{ "ok": false, "error": "Opis błędu" }
```

### 4.3 Obsługa w dashboardzie

- Każde zapytanie w `try/catch`
- Toast z komunikatem sukcesu/błędu
- `dbStatus` state: `"ok"` | `"err"` | `null`
- Brak MySQL nie blokuje P3 — formularz próbki działa normalnie

---

## 5. Komunikacja iframe (impedancja, P8)

Nie jest to klasyczny endpoint, ale interfejs API między komponentami.

### 5.1 Dashboard → iframe

```javascript
ifrRef.current?.contentWindow?.postMessage(
  { type: "impedance_data", data: impData },
  "*"
);
```

### 5.2 iframe → Dashboard

```javascript
// W impedance.html:
window.parent.postMessage({
  type: "impedance_request",
  data: { f_min: 0.01, f_max: 1000000, n_points: 60, mode: "sweep" }
}, "*");
```

### 5.3 Przepływ

```
iframe (impedance.html)
    │ postMessage: impedance_request
    ▼
App.jsx (P8 useEffect listener)
    │ sendCmd("impedance_request", data)
    ▼
WebSocket → LabVIEW
    │ pomiar
    ▼
LabVIEW → WebSocket: impedance_data
    │ applyLvMessage → setImpData
    ▼
App.jsx (P8 useEffect)
    │ postMessage: impedance_data
    ▼
iframe (impedance.html) → wykresy
```

---

## 6. LocalStorage API (wewnętrzne)

Dashboard używa localStorage do persystencji ustawień:

| Klucz | Typ | Opis |
|-------|-----|------|
| `tfl_config` | JSON | Cache konfiguracji z LabVIEW (MFC, sieć, users) |
| `tfl_help_lang` | String | Język pomocy: `"pl"` lub `"en"` |

**Wzorzec zapisu:**
```javascript
try { localStorage.setItem(key, value) } catch {}
```

**Wzorzec odczytu:**
```javascript
try { return localStorage.getItem(key) || default } catch { return default }
```

---

## 7. Podsumowanie

| Interfejs | Protokół | Kierunek | Krytyczność |
|-----------|----------|----------|-------------|
| WebSocket (LabVIEW) | WS + JSON | Bidirectional | Wysoka (dane live) |
| InfluxDB | HTTP REST (Flux) | Dashboard → DB | Średnia (historia) |
| Pliki statyczne | HTTP GET | Browser → Vite | Niska |
| MySQL API | HTTP REST | Dashboard → Backend | Opcjonalna |
| iframe postMessage | JS API | Dashboard ↔ iframe | Niska (impedancja) |
| LocalStorage | JS API | Lokalna | Niska (cache) |
