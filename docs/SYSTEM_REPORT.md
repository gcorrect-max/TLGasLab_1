# RAPORT: Stan aplikacji ThinFilmLab 1 i ThinFilmLab 2

> Wygenerowano: 2026-03-11 | Analiza repozytoriów lokalnych

---

## PORÓWNANIE OGÓLNE

| Parametr | ThinFilmLab 1 (S1) | ThinFilmLab 2 (S2) |
|---|---|---|
| **Lokalizacja** | `/e/Basia/ThinFilmLab/` | `/e/BasiaLab1/` |
| **Tytuł** | ThinFilmLab 1 | ThinFilmLab 2 |
| **Wersja React app** | 3.0.0 | 3.0 |
| **App.jsx rozmiar** | 176 KB | 154 KB |
| **Port dev** | 3004 | 3002 |
| **Backend (Express)** | ✅ server/ (port 3001) | ❌ brak — korzysta z S1 |
| **InfluxDB docker** | ✅ docker-compose.yml | ✅ docker-compose.yml |
| **Build dist/** | ✅ | ✅ |
| **GitHub repo** | `gcorrect-max/ThinFilmLab` | `gcorrect-max/TLGasLab_1` |
| **Identyfikator stanowiska** | `station: "S1"` | `station: "S2"` |
| **APP_NAME** | "Stanowisko 1 badania cienkich warstw dla sensorów gazu" | "Stanowisko 2 badania cienkich warstw dla sensorów gazu" |

---

## ARCHITEKTURA SYSTEMU

```
┌─────────────────────────────────────────────────────────────────┐
│  STANOWISKO 1 (S1)              STANOWISKO 2 (S2)              │
│  /e/Basia/ThinFilmLab/          /e/BasiaLab1/                  │
│  React SPA :3004                React SPA :3002                │
│         │                               │                       │
│         └──────────┬────────────────────┘                       │
│                    │                                            │
│              WebSocket JSON                                     │
│             ws://HOST:8080                                      │
│                    │                                            │
│          ┌─────────┴──────────┐                                 │
│          │     LabVIEW WS     │                                 │
│          │   Server (8080)    │                                 │
│          └─────────┬──────────┘                                 │
│                    │                                            │
│   ┌────────────────┼─────────────────┐                         │
│   │                │                 │                          │
│  MySQL          InfluxDB           AR200.B                      │
│ :3306 (AGH)     :8086 (Docker)    Modbus TCP                   │
│ server.js S1                                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## REST API — STANOWISKO 1 (server/server.js, port 3001)

Stanowisko 2 korzysta z tych samych endpointów z parametrem `station: "S2"`.

### Health

| Metoda | Endpoint | Opis | Odpowiedź |
|---|---|---|---|
| GET | `/api/health` | Status serwera + MySQL | `{ ok: true, ts: "...", db: "sobkow" }` |

### Próbki (`tfl_samples`)

| Metoda | Endpoint | Parametry | Opis |
|---|---|---|---|
| POST | `/api/samples` | body JSON | Zapis nowej próbki |
| GET | `/api/samples` | `?station=S1` | Lista próbek (max 200) |
| GET | `/api/samples/search` | `?field=X&query=Y&station=S1` | Wyszukiwanie (max 100) |
| DELETE | `/api/samples/:id` | `id` | Usuń próbkę |

**Body POST /api/samples:**
```json
{
  "station": "S1",
  "sampleId": "ZnO-001",
  "material": "ZnO",
  "substrate": "Si",
  "method": "PVD",
  "thickness": "150nm",
  "targetGas": "NO₂",
  "processTemp": "400",
  "pressure": "5e-3",
  "atmosphere": "Ar",
  "sourcePower": "100",
  "processTime": "60",
  "gasFlow": "50",
  "operator": "Jan Kowalski",
  "batchNo": "BATCH-001",
  "goal": "Optymalizacja czułości",
  "notes": "",
  "photos": []
}
```

### Eksperymenty (`tfl_experiments`)

| Metoda | Endpoint | Parametry | Opis |
|---|---|---|---|
| POST | `/api/experiments` | body JSON | Start eksperymentu |
| PATCH | `/api/experiments/:id` | body JSON | Zamknij (status=DONE) |
| GET | `/api/experiments` | `?station=S1` | Lista (max 200) |
| DELETE | `/api/experiments/:id` | `id` | Usuń eksperyment |

**Body POST /api/experiments:**
```json
{
  "station": "S1",
  "profileName": "Spiekanie ZnO",
  "sampleId": "ZnO-001",
  "operator": "Jan",
  "status": "RUN",
  "segments": [
    { "name": "E1", "sp": 200, "ramp": 5, "hold": 0, "flow": [100,50,0,0] }
  ],
  "notes": ""
}
```

**Body PATCH /api/experiments/:id:**
```json
{ "status": "DONE", "finishedAt": "2026-03-11T10:00:00.000Z" }
```

### Alarmy (`tfl_alarms`)

| Metoda | Endpoint | Parametry | Opis |
|---|---|---|---|
| POST | `/api/alarms` | body JSON | Zapis alarmu |
| GET | `/api/alarms` | `?limit=N&station=S1` | Lista alarmów (max 500) |

**Body POST /api/alarms:**
```json
{
  "station": "S1",
  "experimentId": 42,
  "severity": "danger",
  "msg": "PV1 > SP1 + 10°C"
}
```

### MySQL — Schemat bazy `sobkow` @ `mysql.agh.edu.pl:3306`

```sql
-- PRÓBKI
CREATE TABLE tfl_samples (
  id INT AUTO_INCREMENT PRIMARY KEY,
  station VARCHAR(10),              -- 'S1' lub 'S2'
  sampleId VARCHAR(100),
  material VARCHAR(100),
  substrate VARCHAR(100),
  method VARCHAR(100),
  thickness VARCHAR(50),
  targetGas VARCHAR(100),
  processTemp VARCHAR(50),
  pressure VARCHAR(50),
  atmosphere VARCHAR(100),
  sourcePower VARCHAR(50),
  processTime VARCHAR(50),
  gasFlow VARCHAR(50),
  operator VARCHAR(100),
  batchNo VARCHAR(100),
  goal TEXT,
  notes TEXT,
  photos TEXT,                      -- JSON array base64
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- EKSPERYMENTY
CREATE TABLE tfl_experiments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  station VARCHAR(10),
  profile_name VARCHAR(200),
  sample_id VARCHAR(100),
  operator VARCHAR(100),
  status VARCHAR(20),               -- 'RUN' / 'DONE'
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME,
  segments_json TEXT,               -- JSON array
  notes TEXT
);

-- ALARMY
CREATE TABLE tfl_alarms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  station VARCHAR(10),
  ts DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  experiment_id INT,
  severity VARCHAR(20),             -- 'warning' / 'danger' / 'info'
  alarm_msg TEXT
);
```

---

## PROTOKÓŁ WEBSOCKET — TYPY WIADOMOŚCI JSON

### Envelope — wspólny dla wszystkich wiadomości TX

```json
{
  "type": "<command_type>",
  "ts": "2026-03-11T10:00:00.000Z",
  "user": { "username": "operator", "role": "user", "name": "Operator" },
  "data": { }
}
```

Dispatcher RX akceptuje też: `"kind"` zamiast `"type"` oraz `"payload"` zamiast `"data"`.

---

### TX: Dashboard → LabVIEW (14 typów)

#### 1. `hello` — handshake (auto po connect)
```json
{
  "type": "hello",
  "ts": "ISO8601",
  "user": { "username": "operator", "role": "user", "name": "Operator" },
  "app": "Stanowisko 1 badania cienkich warstw dla sensorów gazu",
  "ver": "3.0"
}
```

#### 2. `config_request` — żądanie konfiguracji (auto po connect)
```json
{
  "type": "config_request",
  "ts": "ISO8601",
  "user": { "username": "operator", "role": "user" },
  "data": {}
}
```

#### 3. `setpoint_command` — zmiana SP1/SP2/SP3
```json
{
  "type": "setpoint_command",
  "data": { "sp1": 180.0, "sp2": null, "sp3": null }
}
```

#### 4. `mode_command` — MAN/AUTO lub RUN/STOP
```json
{
  "type": "mode_command",
  "data": { "manualMode": true }
}
```
lub
```json
{
  "type": "mode_command",
  "data": { "regStatus": "RUN" }
}
```

#### 5. `manual_mv` — suwak mocy w trybie MANUAL
```json
{
  "type": "manual_mv",
  "data": { "mvManual": 55.0 }
}
```
`mvManual` [float, %]: 0–100

#### 6. `pid_command` — parametry regulatora PID
```json
{
  "type": "pid_command",
  "data": {
    "pidPb": 4.2,
    "pidTi": 95,
    "pidTd": 24,
    "hyst": 1.2,
    "limitPower": 85.0
  }
}
```

#### 7. `alarm_clear` — kasowanie LATCH
```json
{
  "type": "alarm_clear",
  "data": { "latch": true }
}
```

#### 8. `profile_command` — START/STOP profilu segmentowego
**Start:**
```json
{
  "type": "profile_command",
  "data": {
    "action": "start",
    "profileName": "Spiekanie ZnO",
    "segments": [
      { "name": "Rampa", "sp": 200, "ramp": 5, "hold": 0, "flow": [100, 50, 0, 0] },
      { "name": "Wygrzewanie", "sp": 400, "ramp": 3, "hold": 60, "flow": [50, 100, 0, 0] },
      { "name": "Chłodzenie", "sp": 25, "ramp": -10, "hold": 0, "flow": [0, 0, 0, 0] }
    ]
  }
}
```
**Stop:**
```json
{
  "type": "profile_command",
  "data": { "action": "stop", "profileName": "Spiekanie ZnO" }
}
```
Pola segmentu: `sp` [°C], `ramp` [°C/min], `hold` [min], `flow` [sccm, array × 4]

#### 9. `sample_info` — metadane próbki (P3)
```json
{
  "type": "sample_info",
  "data": {
    "sampleId": "ZnO-2026-001",
    "material": "ZnO",
    "substrate": "SiO₂/Si",
    "method": "PVD",
    "thickness": "150",
    "targetGas": "NO₂",
    "processTemp": "400",
    "pressure": "5e-3",
    "atmosphere": "Ar",
    "sourcePower": "100",
    "processTime": "60",
    "gasFlow": "50",
    "operator": "Jan Kowalski",
    "batchNo": "BATCH-2026-01",
    "goal": "Optymalizacja czułości",
    "notes": "",
    "photos": []
  }
}
```

#### 10. `report_create` — nowy raport (P7)
```json
{
  "type": "report_create",
  "data": {
    "id": 1707570600000,
    "date": "2026-02-11",
    "title": "Wygrzewanie ZnO #1",
    "sampleId": "ZnO-2026-001",
    "material": "ZnO",
    "substrate": "SiO₂/Si",
    "method": "PVD",
    "tempMax": "400",
    "result": "Warstwa jednorodna",
    "notes": "Bez odchyłek",
    "photos": [ { "name": "img1.png", "data": "data:image/png;base64,..." } ],
    "profile": "Spiekanie ZnO"
  }
}
```

#### 11. `report_update` — edycja raportu
Identyczna struktura jak `report_create`. Pole `id` identyfikuje raport.

#### 12. `mfc_config` — konfiguracja 4 przepływomierzy (P4)
```json
{
  "type": "mfc_config",
  "data": {
    "mfc": [
      { "id": 1, "name": "MFC-1", "gas": "N₂", "gasComposition": "100% N₂",
        "ip": "192.168.1.101", "port": 502, "slaveAddr": 1,
        "maxFlow": 500, "unit": "sccm", "enabled": false },
      { "id": 2, "name": "MFC-2", "gas": "Ar", "gasComposition": "100% Ar",
        "ip": "192.168.1.102", "port": 502, "slaveAddr": 1,
        "maxFlow": 200, "unit": "sccm", "enabled": false },
      { "id": 3, "name": "MFC-3", "gas": "O₂", "gasComposition": "100% O₂",
        "ip": "192.168.1.103", "port": 502, "slaveAddr": 1,
        "maxFlow": 100, "unit": "sccm", "enabled": false },
      { "id": 4, "name": "MFC-4", "gas": "H₂S", "gasComposition": "10 ppm H₂S/N₂",
        "ip": "192.168.1.104", "port": 502, "slaveAddr": 1,
        "maxFlow": 50, "unit": "sccm", "enabled": false }
    ]
  }
}
```

#### 13. `mfc_setpoint` — nastawa pojedynczego MFC
```json
{
  "type": "mfc_setpoint",
  "data": { "id": 1, "sp": 150.0 }
}
```

#### 14. `impedance_request` — żądanie pomiaru impedancji (P8)
```json
{
  "type": "impedance_request",
  "data": { "f_min": 0.01, "f_max": 1000000, "n_points": 60, "mode": "sweep" }
}
```

---

### RX: LabVIEW → Dashboard (7 typów)

#### 1. `measurement_update` — telemetria ~co 1s
```json
{
  "type": "measurement_update",
  "ts": "2026-03-11T10:00:01.000Z",
  "data": {
    "pv1": 156.3,
    "pv2": 45.2,
    "ch3": 100.8,
    "sp1": 160.0,
    "mv": 67.4,
    "out1": true,
    "manualMode": false,
    "res": 125000.5,
    "tm": 24.8,
    "rhm": 45.2,
    "xlabzre": 51.2,
    "xlabzim": -3.5,
    "xlabr": 12500,
    "mfc": [
      { "id": 1, "pv": 148.5, "sp": 150.0, "enabled": true },
      { "id": 2, "pv": 95.2,  "sp": 100.0, "enabled": true },
      { "id": 3, "pv": 0.0,   "sp": 0.0,   "enabled": false },
      { "id": 4, "pv": 0.0,   "sp": 0.0,   "enabled": false }
    ]
  }
}
```

| Pole | Typ | Jednostka | Opis |
|---|---|---|---|
| `pv1` | float | °C | Temperatura pieca (TC1) |
| `pv2` | float | °C | Temperatura próbki (TC2) |
| `ch3` | float | — | Kanał 3 (opcjonalny) |
| `sp1` | float | °C | Setpoint aktywny |
| `mv` | float | % | Moc wyjściowa regulatora |
| `out1` | boolean | — | Wyjście cyfrowe (grzałka) |
| `manualMode` | boolean | — | Tryb ręczny aktywny |
| `res` | float | Ω | Rezystancja sensora (auto: Ω/kΩ/MΩ) |
| `tm` | float | °C | Temp. mieszaniny (Sensirion) |
| `rhm` | float | %RH | Wilgotność (Sensirion) |
| `xlabzre` | float | Ω | XLab Re(Z) |
| `xlabzim` | float | Ω | XLab Im(Z) |
| `xlabr` | float | Ω | XLab rezystancja DC |
| `mfc[]` | array | — | Przepływomierze (pv, sp, enabled) |

#### 2. `status_update` — stan regulacji
```json
{
  "type": "status_update",
  "data": {
    "regMode": "PID",
    "regStatus": "RUN",
    "manualMode": false,
    "progStatus": "RUN",
    "progStage": 2,
    "progElapsed": 120,
    "limitPower": 85,
    "pidPb": 4.2,
    "pidTi": 95,
    "pidTd": 24
  }
}
```

#### 3. `alarm_event` — zdarzenie alarmowe
```json
{
  "type": "alarm_event",
  "ts": "ISO8601",
  "data": {
    "sev": "danger",
    "msg": "HI: PV1 przekroczone 220.5°C > SP + 10°C",
    "latch": true
  }
}
```
`sev`: `"warning"` / `"danger"` / `"info"`

#### 4. `profile_status` — status profilu segmentowego
```json
{
  "type": "profile_status",
  "data": {
    "profileName": "Spiekanie ZnO",
    "stage": 2,
    "stageName": "Wygrzewanie",
    "progStatus": "RUN",
    "progElapsed": 420
  }
}
```

#### 5. `state_snapshot` — pełny snapshot po reconnect (alias: `mb_snapshot`)
```json
{
  "type": "state_snapshot",
  "data": {
    "pv1": 156.3, "pv2": 45.2, "sp1": 160.0, "mv": 67.4,
    "manualMode": false, "mvManual": 40,
    "regStatus": "RUN", "progStatus": "STOP", "progStage": 0,
    "alarmSTB": false, "alarmLATCH": false,
    "out1": true, "out2": false
  }
}
```

#### 6. `impedance_data` — wyniki pomiaru impedancji
```json
{
  "type": "impedance_data",
  "data": {
    "sweepId": 1,
    "f_min": 0.01,
    "f_max": 1000000,
    "n_points": 60,
    "duration_ms": 4500,
    "points": [
      { "f": 1000000, "z_re": 51.2, "z_im": -3.5 },
      { "f": 630957,  "z_re": 52.1, "z_im": -5.8 },
      { "f": 0.01,    "z_re": 285.3, "z_im": -112.7 }
    ]
  }
}
```

#### 7. `config_data` — odpowiedź na config_request
```json
{
  "type": "config_data",
  "data": {
    "wsUrl": "ws://localhost:8080",
    "ethIP": "192.168.1.100",
    "ethPort": 502,
    "modbusAddr": 1,
    "users": { "admin": { ... }, "operator": { ... } },
    "mfc": [ { "id": 1, "name": "MFC-1", "gas": "N₂", "enabled": false }, ... ],
    "pages": [1, 2, 3, 4, 5, 6, 7, 8, 9],
    "paramNames": {
      "pv1": "TC1 (piec)", "pv2": "TC2 (próbka)",
      "res": "Rezystancja", "tm": "T pow.", "rhm": "RH pow.",
      "xlabzre": "XLab Zre", "xlabzim": "XLab Zim", "xlabr": "XLab R"
    }
  }
}
```

---

## INFLUXDB — TIME-SERIES (wspólna konfiguracja)

| Parametr | Wartość |
|---|---|
| URL | `http://localhost:8086` |
| Token | `tfl-dev-token-2026` |
| Org | `ThinFilmLab` |
| Bucket | `measurements` |
| Retencja | 720h (30 dni) |
| Measurement | `process_data` |

**Pola (fields):** `pv1, pv2, sp1, mv, outAnalog, ch3, mfc1, mfc2, mfc3, mfc4`
**Tagi:** `lab="ThinFilmLab"`, `source="ws"|"demo"`
**Batching:** 10 punktów lub co 5 sekund

---

## STRONY APLIKACJI — ROLE I DOSTĘP

| Strona | Nazwa | admin | user | student | guest |
|---|---|---|---|---|---|
| P1 | Monitorowanie | ✅ | ✅ | ✅ | ✅ |
| P2 | Ustawienia | ✅ | ✅ | ✅ | ❌ |
| P3 | Próbka | ✅ | ✅ | ✅ | ❌ |
| P4 | Konfiguracja | ✅ | ✅ | ❌ | ❌ |
| P5 | Konsola WS | ✅ | ✅ | ❌ | ❌ |
| P6 | Logi | ✅ | ✅ | ❌ | ❌ |
| P7 | Raporty | ✅ | ✅ | ✅ | ❌ |
| P8 | Impedancja | ✅ | ✅ | ✅ | ❌ |
| P9 | Pomoc | ✅ | ✅ | ✅ | ✅ |

**Konta domyślne (po zmianie: tryb jasny):**

| Login | Hasło | Rola |
|---|---|---|
| admin | admin123 | admin |
| operator | oper123 | user |
| student | stud123 | student |
| guest | guest | guest |

---

## KLUCZOWE PLIKI PROJEKTU

### ThinFilmLab 1
- `/e/Basia/ThinFilmLab/src/App.jsx` — React app (176 KB)
- `/e/Basia/ThinFilmLab/server/server.js` — Express REST API (port 3001)
- `/e/Basia/ThinFilmLab/docs/PROTOCOL_JSON_WS.md` — protokół WS
- `/e/Basia/ThinFilmLab/docs/API_ENDPOINTS.md` — REST endpoints
- `/e/Basia/ThinFilmLab/docs/schemas/labview_to_web.json` — schematy RX
- `/e/Basia/ThinFilmLab/docs/schemas/web_to_labview.json` — schematy TX
- `/e/Basia/ThinFilmLab/docker-compose.yml` — InfluxDB

### ThinFilmLab 2
- `/e/BasiaLab1/src/App.jsx` — React app (154 KB)
- `/e/BasiaLab1/docs/PROTOCOL_JSON_WS.md` — protokół WS
- `/e/BasiaLab1/docs/API_ENDPOINTS.md` — REST endpoints
- `/e/BasiaLab1/docker-compose.yml` — InfluxDB
- `/e/BasiaLab1/public/help.json` — FAQ PL/EN (25.8 KB)
