# Protokół WebSocket JSON — Kontroler v3.0 ↔ LabVIEW

## Architektura połączenia

```
┌──────────────────────┐       WebSocket (JSON)       ┌──────────────────────┐
│   Kontroler (React)  │  ◄──────────────────────►   │  LabVIEW WS Server   │
│   ws://host:port/ws  │     TX: komendy WEB→LV      │  AR200.B + DAQ       │
│                      │     RX: dane LV→WEB          │                      │
└──────────────────────┘                               └──────────────────────┘
```

- **LabVIEW** = WebSocket Server (nasłuchuje)
- **Kontroler** = WebSocket Client (łączy się)
- Auto-reconnect: exponential backoff 1s → 15s
- Watchdog: timeout 12s bez wiadomości → reconnect
- Handshake: po `onopen` klient wysyła `hello` + `config_request`
- Gdy WS rozłączony → symulacja PID demo (offline mode)

---

## 1. HANDSHAKE — hello + config_request (WEB → LV)

Wysyłane automatycznie po nawiązaniu połączenia (`ws.onopen`). Dwa komunikaty:

### 1.1 `hello`

```json
{
  "type": "hello",
  "ts": "2026-02-10T14:30:00.000Z",
  "user": {
    "username": "operator",
    "role": "user",
    "name": "Operator"
  },
  "app": "Laboratorium badania cienkich warstw dla sensorów gazu",
  "ver": "3.0"
}
```

| Pole | Typ | Opis |
|------|-----|------|
| `type` | string | Zawsze `"hello"` |
| `ts` | ISO 8601 | Timestamp klienta |
| `user` | object/null | Zalogowany użytkownik (username, role, name) |
| `app` | string | Nazwa aplikacji |
| `ver` | string | Wersja kontrolera |

### 1.2 `config_request`

Wysyłany bezpośrednio po `hello`. Żąda konfiguracji systemu — LabVIEW odpowiada `config_data` (patrz sekcja 3.7).

```json
{
  "type": "config_request",
  "ts": "2026-02-10T14:30:00.000Z",
  "user": { "username": "operator", "role": "user" },
  "data": {}
}
```

---

## 2. KOMENDY WEB → LabVIEW (TX)

Każda komenda ma wspólny envelope:

```json
{
  "type": "<command_type>",
  "ts": "2026-02-10T14:30:00.000Z",
  "user": { "username": "operator", "role": "user", "name": "Operator" },
  "data": { ... }
}
```

---

### 2.1 `setpoint_command` — Zmiana setpointu

Wysyłany: P2 → zmiana SP1/SP2/SP3 w polach numerycznych.

```json
{
  "type": "setpoint_command",
  "ts": "2026-02-10T14:30:00.000Z",
  "user": { "username": "operator", "role": "user", "name": "Operator" },
  "data": {
    "sp1": 180.0
  }
}
```

| Pole data | Typ | Opis |
|-----------|-----|------|
| `sp1` | float | Setpoint 1 — temperatura docelowa [°C] |
| `sp2` | float | Setpoint 2 (opcjonalnie) |
| `sp3` | float | Setpoint 3 (opcjonalnie) |

Wysyłana jest tylko zmieniona wartość (nie wszystkie 3 jednocześnie).

---

### 2.2 `mode_command` — Zmiana trybu regulacji

Wysyłany: P2 → przycisk MAN/AUTO, przycisk START/STOP regulatora.

```json
{
  "type": "mode_command",
  "ts": "2026-02-10T14:30:00.000Z",
  "user": { "username": "admin", "role": "admin", "name": "Administrator" },
  "data": {
    "manualMode": true
  }
}
```

lub:

```json
{
  "type": "mode_command",
  "ts": "2026-02-10T14:30:00.000Z",
  "user": { "username": "admin", "role": "admin", "name": "Administrator" },
  "data": {
    "regStatus": "RUN"
  }
}
```

| Pole data | Typ | Opis |
|-----------|-----|------|
| `manualMode` | boolean | `true` = tryb ręczny, `false` = PID auto |
| `regStatus` | string | `"RUN"` / `"STOP"` — start/stop pętli regulacji |

Wysyłana jest tylko zmieniona właściwość.

---

### 2.3 `manual_mv` — Ręczne sterowanie mocą

Wysyłany: P2 → suwak MV w trybie MANUAL.

```json
{
  "type": "manual_mv",
  "ts": "2026-02-10T14:30:00.000Z",
  "user": { "username": "operator", "role": "user", "name": "Operator" },
  "data": {
    "mvManual": 55.0
  }
}
```

| Pole data | Typ | Opis |
|-----------|-----|------|
| `mvManual` | float | Moc wyjściowa 0–100 [%] w trybie ręcznym |

---

### 2.4 `pid_command` — Parametry PID

Wysyłany: P2 → przycisk Autotune (lub ręczna zmiana PID).

```json
{
  "type": "pid_command",
  "ts": "2026-02-10T14:30:00.000Z",
  "user": { "username": "admin", "role": "admin", "name": "Administrator" },
  "data": {
    "pidPb": 4.2,
    "pidTi": 95,
    "pidTd": 24
  }
}
```

| Pole data | Typ | Opis |
|-----------|-----|------|
| `pidPb` | float | Proportional Band [°C] |
| `pidTi` | float | Czas całkowania [s] |
| `pidTd` | float | Czas różniczkowania [s] |

---

### 2.5 `alarm_clear` — Kasowanie LATCH alarmu

Wysyłany: P2 → przycisk 🔓 LATCH.

```json
{
  "type": "alarm_clear",
  "ts": "2026-02-10T14:30:00.000Z",
  "user": { "username": "admin", "role": "admin", "name": "Administrator" },
  "data": {
    "latch": true
  }
}
```

| Pole data | Typ | Opis |
|-----------|-----|------|
| `latch` | boolean | `true` = żądanie skasowania zatrzasku alarmu |

---

### 2.6 `profile_command` — Start/Stop profilu segmentowego

Wysyłany: P2 → dialog Start (pełny pomiar lub tylko temp.) / przycisk Stop.

**Start:**
```json
{
  "type": "profile_command",
  "ts": "2026-02-10T14:30:00.000Z",
  "user": { "username": "operator", "role": "user", "name": "Operator" },
  "data": {
    "action": "start",
    "profileName": "Spiekanie ZnO",
    "segments": [
      { "name": "Rampa grzania", "sp": 200, "ramp": 5, "hold": 0, "flow": [100, 50, 0, 0] },
      { "name": "Wygrzewanie",   "sp": 400, "ramp": 3, "hold": 60, "flow": [80, 30, 0, 0] },
      { "name": "Chłodzenie",    "sp": 25,  "ramp": -10, "hold": 0, "flow": [0, 0, 0, 0] }
    ]
  }
}
```

**Stop:**
```json
{
  "type": "profile_command",
  "ts": "2026-02-10T14:30:00.000Z",
  "user": { "username": "operator", "role": "user", "name": "Operator" },
  "data": {
    "action": "stop",
    "profileName": "Spiekanie ZnO"
  }
}
```

| Pole data | Typ | Opis |
|-----------|-----|------|
| `action` | string | `"start"` / `"stop"` |
| `profileName` | string | Nazwa profilu temperatury |
| `segments` | array | Lista etapów (tylko przy start) |
| `segments[].name` | string | Nazwa etapu |
| `segments[].sp` | float | Docelowa temperatura [°C] |
| `segments[].ramp` | float | Szybkość rampy [°C/min] (ujemna = chłodzenie) |
| `segments[].hold` | float | Czas utrzymania [min] |
| `segments[].flow` | array | Nastawy MFC [sccm]: `[mfc1, mfc2, mfc3, mfc4]` (domyślnie `[0,0,0,0]`) |

---

### 2.7 `sample_info` — Dane próbki i procesu

Wysyłany: P3 → przycisk 💾 Zapisz.

```json
{
  "type": "sample_info",
  "ts": "2026-02-10T14:30:00.000Z",
  "user": { "username": "student", "role": "student", "name": "Student" },
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
    "notes": ""
  }
}
```

| Pole data | Typ | Opis |
|-----------|-----|------|
| `sampleId` | string | Identyfikator próbki |
| `material` | string | Materiał warstwy |
| `substrate` | string | Podłoże |
| `method` | string | Metoda osadzania (PVD/CVD/Sol-Gel) |
| `thickness` | string | Grubość [nm] |
| `targetGas` | string | Gaz docelowy sensora |
| `processTemp` | string | Temperatura procesu [°C] |
| `pressure` | string | Ciśnienie [mbar] |
| `atmosphere` | string | Atmosfera (N₂, Ar, vacuum) |
| `sourcePower` | string | Moc źródła [W] |
| `processTime` | string | Czas procesu [min] |
| `gasFlow` | string | Przepływ gazu [sccm] |
| `operator` | string | Operator |
| `batchNo` | string | Numer serii |
| `goal` | string | Cel eksperymentu |
| `notes` | string | Uwagi |

---

### 2.8 `report_create` — Nowy raport pomiarowy

Wysyłany: P7 → przycisk ➕ Dodaj raport.

```json
{
  "type": "report_create",
  "ts": "2026-02-10T14:30:00.000Z",
  "user": { "username": "operator", "role": "user", "name": "Operator" },
  "data": {
    "id": 1707570600000,
    "date": "2026-02-10",
    "title": "Wygrzewanie ZnO #1",
    "sampleId": "ZnO-2026-001",
    "material": "ZnO",
    "substrate": "SiO₂/Si",
    "method": "PVD",
    "tempMax": "400",
    "result": "Warstwa jednorodna",
    "notes": "Bez odchyłek",
    "photos": [
      { "name": "img1.png", "data": "data:image/png;base64,iVBORw0..." }
    ],
    "profile": "Spiekanie ZnO"
  }
}
```

| Pole data | Typ | Opis |
|-----------|-----|------|
| `id` | number | Timestamp ID raportu |
| `date` | string | Data raportu (YYYY-MM-DD) |
| `title` | string | Tytuł raportu |
| `sampleId` | string | ID powiązanej próbki |
| `material` | string | Materiał |
| `substrate` | string | Podłoże |
| `method` | string | Metoda |
| `tempMax` | string | Temperatura maksymalna [°C] |
| `result` | string | Wynik pomiaru |
| `notes` | string | Uwagi |
| `photos` | array | Zdjęcia (base64) |
| `photos[].name` | string | Nazwa pliku |
| `photos[].data` | string | Data URL (base64) |
| `profile` | string | Nazwa profilu temperatury |

---

### 2.9 `report_update` — Aktualizacja raportu

Wysyłany: P7 → przycisk 💾 Zapisz zmiany (tryb edycji).

Struktura identyczna jak `report_create`. Pole `id` identyfikuje istniejący raport.

---

### 2.10 `config_update` — Aktualizacja konfiguracji systemu [PLACEHOLDER]

Zdefiniowany w schemacie `JSON_WEB2LV`, ale aktualnie **nie jest wysyłany** przez UI — przycisk "Zapisz" na zakładce Config (P4 → ctrl) zapisuje lokalnie. Docelowo ma wysyłać konfigurację kontrolera do LabVIEW.

```json
{
  "type": "config_update",
  "ts": "2026-02-10T14:30:00.000Z",
  "user": { "username": "admin", "role": "admin", "name": "Administrator" },
  "data": {
    "wsUrl": "ws://192.168.1.100:8080/ws",
    "ethIP": "192.168.1.200",
    "ethPort": 502
  }
}
```

---

### 2.11 `mfc_config` — Konfiguracja przepływomierzy MFC

Wysyłany: P4 → zakładka MFC → przycisk "💾 Zapisz konfigurację".

Przesyła pełną konfigurację wszystkich 4 przepływomierzy MKS.

```json
{
  "type": "mfc_config",
  "ts": "2026-02-10T14:30:00.000Z",
  "user": { "username": "admin", "role": "admin", "name": "Administrator" },
  "data": {
    "mfc": [
      {
        "id": 1,
        "name": "MFC-1",
        "gas": "Ar",
        "gasComposition": "",
        "ip": "192.168.1.101",
        "port": 502,
        "slaveAddr": 1,
        "maxFlow": 200,
        "unit": "sccm",
        "pv": 0,
        "sp": 100,
        "enabled": true
      },
      { "id": 2, "name": "MFC-2", "gas": "O₂", "enabled": true, "..." : "..." },
      { "id": 3, "name": "MFC-3", "gas": "N₂", "enabled": false, "..." : "..." },
      { "id": 4, "name": "MFC-4", "gas": "H₂", "enabled": false, "..." : "..." }
    ]
  }
}
```

| Pole data.mfc[] | Typ | Opis |
|-----------------|-----|------|
| `id` | int | Numer MFC (1–4) |
| `name` | string | Nazwa wyświetlana |
| `gas` | string | Typ gazu (Ar, O₂, N₂, H₂, ...) |
| `gasComposition` | string | Skład mieszanki (opcjonalnie) |
| `ip` | string | Adres IP MODBUS Ethernet |
| `port` | int | Port TCP (domyślnie 502) |
| `slaveAddr` | int | Adres slave MODBUS |
| `maxFlow` | float | Zakres pełnoskalowy [sccm] |
| `unit` | string | Jednostka (`"sccm"`) |
| `pv` | float | Aktualna wartość przepływu (odczyt) |
| `sp` | float | Nastawa docelowa |
| `enabled` | boolean | Czy MFC jest aktywny |

---

### 2.12 `mfc_setpoint` — Nastawa przepływomierza

Wysyłany: P4 → zakładka MFC → przycisk "📤 Wyślij nastawy".

Wysyłany osobno dla każdego aktywnego (enabled) MFC.

```json
{
  "type": "mfc_setpoint",
  "ts": "2026-02-10T14:30:00.000Z",
  "user": { "username": "operator", "role": "user", "name": "Operator" },
  "data": {
    "id": 1,
    "sp": 100.0
  }
}
```

| Pole data | Typ | Opis |
|-----------|-----|------|
| `id` | int | Numer MFC (1–4) |
| `sp` | float | Nowa nastawa przepływu [sccm] |

---

### 2.13 `impedance_request` — Żądanie pomiaru impedancji

Wysyłany: P8 (Impedancja) → iframe `/impedance.html` przekazuje żądanie przez `postMessage`.

```json
{
  "type": "impedance_request",
  "ts": "2026-02-10T14:30:00.000Z",
  "user": { "username": "operator", "role": "user", "name": "Operator" },
  "data": {
    "f_min": 100,
    "f_max": 1000000,
    "n_points": 50,
    "mode": "sweep"
  }
}
```

| Pole data | Typ | Opis |
|-----------|-----|------|
| `f_min` | float | Częstotliwość minimalna [Hz] |
| `f_max` | float | Częstotliwość maksymalna [Hz] |
| `n_points` | int | Liczba punktów pomiarowych |
| `mode` | string | Tryb pomiaru (`"sweep"`, `"single"`) |

---

## 3. WIADOMOŚCI LabVIEW → WEB (RX)

LabVIEW wysyła dane w formacie JSON. Dispatcher rozpoznaje `type` (lub `kind`) i routuje do odpowiedniego handlera.

---

### 3.1 `measurement_update` — Dane pomiarowe (cykliczne)

LabVIEW wysyła co interwał (np. 1s).

```json
{
  "type": "measurement_update",
  "ts": "2026-02-10T14:30:01.000Z",
  "data": {
    "pv1": 156.3,
    "pv2": 45.2,
    "ch3": 100.8,
    "sp1": 160.0,
    "mv": 67.4,
    "outAnalog": 12.8,
    "manualMode": false,
    "mfc": [
      { "id": 1, "pv": 98.5, "sp": 100, "enabled": true },
      { "id": 2, "pv": 49.1, "sp": 50,  "enabled": true },
      { "id": 3, "pv": 0,    "sp": 0,   "enabled": false },
      { "id": 4, "pv": 0,    "sp": 0,   "enabled": false }
    ]
  }
}
```

| Pole data | Typ | Opis |
|-----------|-----|------|
| `pv1` | float | Wartość procesu 1 — temperatura [°C] |
| `pv2` | float | Wartość procesu 2 — przepływ [l/min] |
| `ch3` | float | Kanał 3 (dowolny pomiar) |
| `sp1` | float | Aktualny setpoint [°C] |
| `mv` | float | Moc wyjściowa regulatora [%] |
| `outAnalog` | float | Wyjście analogowe [mA] |
| `manualMode` | boolean | Aktualny tryb |
| `mfc` | array | Stan przepływomierzy MFC (opcjonalnie) |
| `mfc[].id` | int | Numer MFC (1–4) |
| `mfc[].pv` | float | Aktualny przepływ [sccm] |
| `mfc[].sp` | float | Nastawa [sccm] |
| `mfc[].enabled` | boolean | Czy MFC aktywny |

**Efekt:** Aktualizuje wskaźniki, gauge'e, wykresy w czasie rzeczywistym. Dodaje punkt do historii (max 150). Zapisuje punkt do InfluxDB.

---

### 3.2 `status_update` — Status regulatora

```json
{
  "type": "status_update",
  "ts": "2026-02-10T14:30:02.000Z",
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

| Pole data | Typ | Opis |
|-----------|-----|------|
| `regMode` | string | Tryb regulacji (`"PID"`, `"ON/OFF"`) |
| `regStatus` | string | `"RUN"` / `"STOP"` |
| `manualMode` | boolean | Tryb ręczny |
| `progStatus` | string | Status programu segmentowego |
| `progStage` | int | Aktualny etap profilu (1-indexed) |
| `progElapsed` | int | Czas trwania aktualnego etapu [s] |
| `limitPower` | float | Limit mocy [%] |
| `pidPb/Ti/Td` | float | Aktualne parametry PID |

**Efekt:** Aktualizuje LED-y statusu, badge'e w sidebarze, informacje o profilu.

---

### 3.3 `alarm_event` — Zdarzenie alarmu

```json
{
  "type": "alarm_event",
  "ts": "2026-02-10T14:30:03.000Z",
  "data": {
    "sev": "warning",
    "msg": "HI: PV1 przekroczone 165.2°C",
    "latch": true
  }
}
```

| Pole data | Typ | Opis |
|-----------|-----|------|
| `sev` | string | Priorytet: `"warning"` / `"danger"` / `"info"` |
| `msg` | string | Treść alarmu |
| `latch` | boolean | `true` = alarm zatrzaśnięty (wymaga kasowania) |

**Efekt:** Dodaje wpis do listy alarmów na P1, ustawia `alarmSTB` i `alarmLATCH`, aktywuje LED ALM w headerze.

---

### 3.4 `state_snapshot` — Pełny snapshot stanu

Wysyłany na żądanie lub po reconnect.

```json
{
  "type": "state_snapshot",
  "ts": "2026-02-10T14:30:04.000Z",
  "data": {
    "pv1": 140.0,
    "pv2": 44.8,
    "sp1": 150.0,
    "mv": 55.0,
    "manualMode": true,
    "mvManual": 40,
    "regStatus": "RUN",
    "progStatus": "STOP",
    "progStage": 0,
    "alarmSTB": false,
    "alarmLATCH": false,
    "outAnalog": 10.2,
    "out1": true,
    "out2": false
  }
}
```

Akceptuje także `type: "mb_snapshot"` (alias).

| Pole data | Typ | Opis |
|-----------|-----|------|
| (dowolne) | mixed | Bulk update — wszystkie pola z `data` nadpisują stan `mb` |

**Efekt:** Natychmiastowa synchronizacja pełnego stanu kontrolera po utracie połączenia.

---

### 3.5 `profile_status` — Status profilu temperatury [PLANNED]

Zdefiniowany w schemacie `JSON_LV2WEB`, ale aktualnie **brak handlera** w `applyLvMessage` — wiadomość jest ignorowana. Docelowo LabVIEW ma raportować postęp profilu segmentowego.

```json
{
  "type": "profile_status",
  "ts": "2026-02-10T14:30:05.000Z",
  "data": {
    "profileName": "Spiekanie ZnO",
    "stage": 2,
    "stageName": "Wygrzewanie",
    "elapsed": 120,
    "remaining": 3480,
    "status": "RUN"
  }
}
```

---

### 3.6 `impedance_data` — Dane impedancji

Odpowiedź na `impedance_request`. Dane pomiaru spektroskopii impedancji.

```json
{
  "type": "impedance_data",
  "ts": "2026-02-10T14:30:06.000Z",
  "data": {
    "frequencies": [100, 1000, 10000, 100000],
    "z_real": [1200, 800, 400, 200],
    "z_imag": [-300, -500, -350, -100],
    "phase": [-14, -32, -41, -27]
  }
}
```

| Pole data | Typ | Opis |
|-----------|-----|------|
| `frequencies` | float[] | Częstotliwości pomiarowe [Hz] |
| `z_real` | float[] | Część rzeczywista impedancji [Ω] |
| `z_imag` | float[] | Część urojona impedancji [Ω] |
| `phase` | float[] | Faza [°] |

**Efekt:** Zapisuje w stanie `impData`, przekazuje do iframe `/impedance.html` przez `postMessage`.

---

### 3.7 `config_data` — Konfiguracja systemu

Odpowiedź na `config_request`. Przesyła konfigurację zapisaną po stronie LabVIEW.

```json
{
  "type": "config_data",
  "ts": "2026-02-10T14:30:07.000Z",
  "data": {
    "mfc": [
      { "id": 1, "name": "MFC-1", "gas": "Ar", "ip": "192.168.1.101", "port": 502, "maxFlow": 200, "enabled": true },
      { "id": 2, "name": "MFC-2", "gas": "O₂", "enabled": true },
      { "id": 3, "name": "MFC-3", "gas": "N₂", "enabled": false },
      { "id": 4, "name": "MFC-4", "gas": "H₂", "enabled": false }
    ],
    "wsUrl": "ws://192.168.1.100:8080/ws",
    "ethIP": "192.168.1.200",
    "ethPort": 502,
    "users": {
      "admin": { "pass": "****", "role": "admin", "name": "Administrator" }
    }
  }
}
```

| Pole data | Typ | Opis |
|-----------|-----|------|
| `mfc` | array | Konfiguracja przepływomierzy (mergowana z lokalnym stanem) |
| `wsUrl` | string | Adres WebSocket serwera LabVIEW |
| `ethIP` | string | Adres IP kontrolera Ethernet |
| `ethPort` | int | Port TCP kontrolera |
| `users` | object | Mapa użytkowników systemu |

**Efekt:** Merguje konfigurację MFC, aktualizuje wsUrl/ethIP, zapisuje do `localStorage("tfl_config")`.

---

## 4. PODSUMOWANIE — MAPA KOMEND

### TX (WEB → LV): 14 typów

| # | type | Źródło | Trigger |
|---|------|--------|---------|
| 1 | `hello` | App | Automatycznie po `onopen` |
| 2 | `config_request` | App | Automatycznie po `hello` |
| 3 | `setpoint_command` | P2 | Zmiana SP1/SP2/SP3 |
| 4 | `mode_command` | P2 | MAN↔AUTO, REG START/STOP |
| 5 | `manual_mv` | P2 | Suwak MV w trybie MANUAL |
| 6 | `pid_command` | P2 | Autotune / zmiana PID |
| 7 | `alarm_clear` | P2 | Kasowanie LATCH alarmu |
| 8 | `profile_command` | P2 | Start/Stop profilu segmentowego |
| 9 | `sample_info` | P3 | Zapisanie danych próbki |
| 10 | `report_create` | P7 | Nowy raport pomiarowy |
| 11 | `report_update` | P7 | Edycja istniejącego raportu |
| 12 | `mfc_config` | P4 | Konfiguracja przepływomierzy |
| 13 | `mfc_setpoint` | P4 | Nastawa przepływomierza (×N) |
| 14 | `impedance_request` | P8 | Pomiar impedancji (z iframe) |

*Uwaga: `config_update` (sekcja 2.10) jest zdefiniowany w schemacie, ale jeszcze nie wysyłany.*

### RX (LV → WEB): 7 typów

| # | type | Efekt |
|---|------|-------|
| 1 | `measurement_update` | Aktualizacja PV/SP/MV/MFC + wykres + InfluxDB |
| 2 | `status_update` | Status regulacji, program, PID |
| 3 | `alarm_event` | Dodanie alarmu, latch |
| 4 | `state_snapshot` | Pełna synchronizacja stanu (alias: `mb_snapshot`) |
| 5 | `profile_status` | [PLANNED] Status profilu segmentowego |
| 6 | `impedance_data` | Dane impedancji → iframe |
| 7 | `config_data` | Konfiguracja systemu z LabVIEW |

---

## 5. WS CONSOLE

Panel debug (🛰 w headerze) rejestruje wszystkie wiadomości:
- Zakładka **RX**: odebrane z LabVIEW (max 80)
- Zakładka **TX**: wysłane do LabVIEW (max 80)
- Każda wiadomość: timestamp, type, pełny JSON z możliwością kopiowania
