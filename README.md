# BasiaLab1 — Gas Laboratory Dashboard

React-based web dashboard for a gas mixing laboratory station. Communicates with LabVIEW in real-time via WebSocket (JSON protocol). Displays a live SVG schematic of the gas flow, MFC readings, sensor data, sample information, and historical charts.

---

## Tech Stack

| Component | Version |
|-----------|---------|
| React | 19 |
| Vite | 6 |
| Recharts | 2.15 |
| InfluxDB client (browser) | 1.35 |
| Transport | WebSocket (JSON) |

---

## Getting Started

```bash
npm install
npm run dev        # development server (default: http://localhost:5173)
npm run build      # production build
npm run preview    # preview production build
```

Default login credentials (configurable in `USERS_INIT`):

| User | Password | Role |
|------|----------|------|
| admin | admin123 | admin |
| operator | oper123 | user |
| student | stud123 | student |
| guest | guest | guest |

---

## Architecture Overview

```
LabVIEW  ←──WebSocket (JSON)──→  React Dashboard
              ws://host:8080
```

The dashboard connects to a LabVIEW WebSocket server. All communication uses JSON messages with a `type` field as discriminator. The connection URL is configurable at runtime from the Settings page.

---

## WebSocket Protocol

### Message Structure

All messages follow this envelope:

```json
{
  "type": "message_type",
  "ts": "2026-02-27T10:00:00.000Z",
  "data": { ... }
}
```

Messages sent **from the dashboard to LabVIEW** additionally include:

```json
{
  "type": "...",
  "ts": "...",
  "data": { ... },
  "user": "operator"
}
```

---

## LabVIEW → Web (incoming messages)

### `measurement_update`
Periodic measurement data. Sent at a configurable interval (e.g. every 1–5 s).

```json
{
  "type": "measurement_update",
  "ts": "2026-02-27T10:00:00.000Z",
  "data": {
    "pv1": 156.3,
    "pv2": 45.2,
    "mv": 67.4,
    "out1": true,
    "outAnalog": 12.8,
    "resistance": 12500,
    "gasMixTemp": 23.4,
    "gasMixHumidity": 48.2,
    "mfc": [
      { "id": 1, "pv": 120.5, "sp": 150, "enabled": true },
      { "id": 2, "pv": 85.0,  "sp": 100, "enabled": true },
      { "id": 3, "pv": 0.0,   "sp": 0,   "enabled": false },
      { "id": 4, "pv": 0.0,   "sp": 0,   "enabled": false }
    ]
  }
}
```

| Field | Type | Unit | Description |
|-------|------|------|-------------|
| `pv1` | float | °C | Process value — Thermocouple 1 (furnace) |
| `pv2` | float | °C | Process value — Thermocouple 2 (sample) |
| `mv` | float | % | Manipulated variable (heater power) |
| `out1` | bool | — | Heater output state |
| `outAnalog` | float | mA/V | Analog output value |
| `resistance` | float | Ω | Sample electrical resistance |
| `gasMixTemp` | float | °C | Gas mixture temperature (Sensirion) |
| `gasMixHumidity` | float | % RH | Gas mixture relative humidity (Sensirion) |
| `mfc[].id` | int | — | MFC identifier (1–4) |
| `mfc[].pv` | float | sccm | Actual flow rate |
| `mfc[].sp` | float | sccm | Flow setpoint |
| `mfc[].enabled` | bool | — | MFC active state |

All fields are optional — missing fields retain their previous value in the dashboard state.

---

### `status_update`
Regulation status change.

```json
{
  "type": "status_update",
  "ts": "2026-02-27T10:00:00.000Z",
  "data": {
    "regMode": "PID",
    "regStatus": "RUN",
    "progStage": 2
  }
}
```

| Field | Type | Values | Description |
|-------|------|--------|-------------|
| `regMode` | string | `"PID"`, `"ON/OFF"` | Control mode |
| `regStatus` | string | `"RUN"`, `"STOP"` | Regulation active |
| `progStage` | int | 0–N | Current profile segment index |

---

### `alarm_event`
Alarm notification.

```json
{
  "type": "alarm_event",
  "ts": "2026-02-27T10:00:00.000Z",
  "data": {
    "alarmId": "AL_HI",
    "severity": "danger",
    "pv1": 210.5,
    "msg": "Przekroczenie temperatury",
    "latch": true
  }
}
```

| Field | Type | Values | Description |
|-------|------|--------|-------------|
| `alarmId` | string | `"AL_HI"`, `"AL_LO"` | Alarm identifier |
| `severity` | string | `"danger"`, `"warning"`, `"info"` | Severity level |
| `pv1` | float | °C | Temperature at alarm trigger |
| `msg` | string | — | Optional alarm message |
| `latch` | bool | — | If true, alarm latches until manually cleared |

---

### `profile_status`
Profile execution status update.

```json
{
  "type": "profile_status",
  "ts": "2026-02-27T10:00:00.000Z",
  "data": {
    "profileName": "Spiekanie ZnO",
    "stage": 2,
    "stageName": "Wygrzewanie"
  }
}
```

---

### `impedance_data`
Impedance spectroscopy sweep result.

```json
{
  "type": "impedance_data",
  "ts": "2026-02-27T10:00:00.000Z",
  "data": {
    "sweepId": 1,
    "points": [
      { "f": 1000000, "z_re": 51.2, "z_im": -3.5 },
      { "f": 100000,  "z_re": 55.8, "z_im": -18.2 }
    ]
  }
}
```

| Field | Type | Unit | Description |
|-------|------|------|-------------|
| `sweepId` | int | — | Sweep sequence number |
| `points[].f` | float | Hz | Frequency |
| `points[].z_re` | float | Ω | Impedance real part |
| `points[].z_im` | float | Ω | Impedance imaginary part |

---

### `config_data`
System configuration response (sent after `config_request`).

```json
{
  "type": "config_data",
  "ts": "2026-02-27T10:00:00.000Z",
  "data": {
    "wsUrl": "ws://192.168.1.100:8080",
    "ethIP": "192.168.1.100",
    "ethPort": 502,
    "mfc": [ { "id": 1, "name": "MFC-1", "gas": "N₂", "maxFlow": 500, "unit": "sccm" } ],
    "users": {},
    "roles": {},
    "pages": []
  }
}
```

---

## Web → LabVIEW (outgoing messages)

### `setpoint_command`
Change temperature setpoint.

```json
{
  "type": "setpoint_command",
  "ts": "...",
  "data": { "target": "sp1", "value": 200 },
  "user": "admin"
}
```

---

### `mode_command`
Start/stop regulation or switch manual/auto.

```json
{
  "type": "mode_command",
  "ts": "...",
  "data": { "command": "start", "regMode": "PID" },
  "user": "admin"
}
```

| `command` | Effect |
|-----------|--------|
| `"start"` | Start regulation |
| `"stop"` | Stop regulation |

---

### `manual_mv`
Set manual heater output (when in MANUAL mode).

```json
{
  "type": "manual_mv",
  "ts": "...",
  "data": { "mv": 75 },
  "user": "operator"
}
```

---

### `profile_command`
Send and start a temperature profile.

```json
{
  "type": "profile_command",
  "ts": "...",
  "data": {
    "command": "start",
    "profile": {
      "name": "Spiekanie ZnO",
      "segments": [
        { "name": "Rampa",      "sp": 400, "ramp": 5,  "hold": 0,   "flow": [100, 50, 0, 0] },
        { "name": "Wygrzewanie","sp": 400, "ramp": 0,  "hold": 120, "flow": [100, 50, 0, 0] },
        { "name": "Chłodzenie", "sp": 25,  "ramp": 2,  "hold": 0,   "flow": [0,   0,  0, 0] }
      ]
    }
  },
  "user": "admin"
}
```

Segment fields:

| Field | Type | Unit | Description |
|-------|------|------|-------------|
| `name` | string | — | Segment label |
| `sp` | float | °C | Target temperature |
| `ramp` | float | °C/min | Ramp rate (0 = step) |
| `hold` | float | min | Hold duration |
| `flow` | float[4] | sccm | MFC setpoints [MFC1, MFC2, MFC3, MFC4] |

---

### `pid_command`
Update PID parameters.

```json
{
  "type": "pid_command",
  "ts": "...",
  "data": { "pidPb": 4.2, "pidTi": 95, "pidTd": 24 },
  "user": "admin"
}
```

| Field | Description |
|-------|-------------|
| `pidPb` | Proportional band (%) |
| `pidTi` | Integral time (s) |
| `pidTd` | Derivative time (s) |

---

### `sample_info`
Send sample metadata to LabVIEW for logging.

```json
{
  "type": "sample_info",
  "ts": "...",
  "data": {
    "sampleId": "ZnO-001",
    "material": "ZnO",
    "substrate": "Al₂O₃",
    "method": "Sputtering",
    "thickness": "200 nm",
    "targetGas": "H₂S",
    "processTemp": "400°C",
    "pressure": "0.3 Pa",
    "atmosphere": "Ar/O₂",
    "sourcePower": "100 W",
    "processTime": "60 min",
    "gasFlow": "50/10 sccm",
    "operator": "A. Nowak",
    "batchNo": "B-2026-01",
    "goal": "Badanie czułości",
    "notes": "Warstwa referencyjna"
  },
  "user": "operator"
}
```

---

### `mfc_setpoint`
Set individual MFC flow setpoint.

```json
{
  "type": "mfc_setpoint",
  "ts": "...",
  "data": { "id": 1, "sp": 100 },
  "user": "operator"
}
```

---

### `mfc_config`
Update MFC configuration (gas type, IP, limits).

```json
{
  "type": "mfc_config",
  "ts": "...",
  "data": {
    "mfc": [
      {
        "id": 1,
        "name": "MFC-1",
        "gas": "N₂",
        "gasComposition": "100% N₂",
        "ip": "192.168.1.101",
        "port": 502,
        "slaveAddr": 1,
        "maxFlow": 500,
        "unit": "sccm",
        "enabled": true
      }
    ]
  },
  "user": "admin"
}
```

---

### `impedance_request`
Request an impedance spectroscopy sweep.

```json
{
  "type": "impedance_request",
  "ts": "...",
  "data": { "f_min": 0.01, "f_max": 1000000, "n_points": 60, "mode": "sweep" },
  "user": "operator"
}
```

---

### `config_request`
Request current system configuration from LabVIEW (sent on startup).

```json
{
  "type": "config_request",
  "ts": "...",
  "data": {},
  "user": "admin"
}
```

---

### `config_update`
Push configuration changes to LabVIEW.

```json
{
  "type": "config_update",
  "ts": "...",
  "data": { "ethIP": "192.168.1.100" },
  "user": "admin"
}
```

---

### `alarm_clear`
Clear a latched alarm.

```json
{
  "type": "alarm_clear",
  "ts": "...",
  "data": { "latch": true },
  "user": "operator"
}
```

---

## Dashboard State (`mb`)

The central state object updated from WebSocket messages:

```js
{
  // Temperatures
  pv1: Number,           // °C — furnace thermocouple
  pv2: Number,           // °C — sample thermocouple
  pv1Name: String,       // display label for PV1
  pv2Name: String,       // display label for PV2

  // Gas mix sensor (Sensirion)
  gasMixTemp: Number|null,      // °C
  gasMixHumidity: Number|null,  // % RH

  // Sample
  resistance: Number|null,  // Ω — auto-formatted to Ω / kΩ / MΩ

  // Control
  mv: Number,            // % — manipulated variable
  mvManual: Number,      // % — manual setpoint
  manualMode: Boolean,
  sp1: Number,           // °C — temperature setpoint
  out1: Boolean,         // heater relay state
  outAnalog: Number,     // analog output

  // Alarms
  alarm1: Boolean,       // HI alarm
  alarm2: Boolean,       // LO alarm
  alarmSTB: Boolean,     // standby alarm
  alarmLATCH: Boolean,   // latched alarm

  // Regulation
  regMode: String,       // "PID" | "ON/OFF"
  regStatus: String,     // "RUN" | "STOP"
  pidPb: Number,         // proportional band
  pidTi: Number,         // integral time
  pidTd: Number,         // derivative time

  // Profile execution
  progStage: Number,
  progStatus: String,    // "RUN" | "STOP"
  progElapsed: Number,   // seconds

  // MFC array (4 entries)
  mfc: [
    {
      id: Number,
      name: String,
      gas: String,
      gasComposition: String,
      ip: String,
      port: Number,
      slaveAddr: Number,
      maxFlow: Number,
      unit: String,      // "sccm"
      pv: Number,        // actual flow
      sp: Number,        // setpoint
      enabled: Boolean
    }
  ],

  // Network / connectivity
  wsUrl: String,
  wsConnected: Boolean,
  ethIP: String,
  ethPort: Number
}
```

---

## Resistance Display Logic

The `resistance` field is auto-formatted on the diagram:

| Value | Display |
|-------|---------|
| ≥ 1 MΩ (1 000 000) | `X.XX MΩ` |
| ≥ 1 kΩ (1 000) | `X.X kΩ` |
| < 1 kΩ | `X Ω` |

---

## Data Persistence

- **Real-time buffer** — last 150 data points in memory (`hist` array)
- **InfluxDB** — every `measurement_update` is written via `writeDataPoint()` (configurable in `src/influx.js`)
- **Historical ranges** — 1h / 6h / 24h / 7d queries via `queryHistory()`
- **Export** — experiment JSON export, CSV download, HTML/PDF reports

---

## User Roles

| Role | Pages accessible |
|------|-----------------|
| admin | All (1–9) |
| user | 1, 2, 3, 4, 5, 6, 7, 8, 9 |
| student | 1, 2, 3, 7, 8, 9 |
| guest | 1, 9 |

---

## Project Structure

```
BasiaLab1/
├── src/
│   ├── App.jsx          # Main application (single-file architecture)
│   ├── influx.js        # InfluxDB client wrapper
│   └── main.jsx         # React entry point
├── public/
├── package.json
├── vite.config.js
└── README.md
```

---

## Notes

- The WebSocket URL defaults to `ws://localhost:8080` and can be changed at runtime in the Settings page (Page 4)
- The dashboard supports **custom SVG diagrams** — upload a drawio SVG export via the diagram settings
- Both **dark and light themes** are supported; all SVG diagram colors adapt to the active theme via React state (`T.*` variables)
- The `measurement_update` handler uses a spread pattern: any extra fields sent by LabVIEW are automatically merged into dashboard state — forward-compatible by design
