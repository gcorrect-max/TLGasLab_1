# Protokół WebSocket JSON — Stanowisko 2 (ThinFilmLab 2) v3.0

## Architektura połączenia

```
┌─────────────────────────┐     WebSocket (JSON)     ┌─────────────────────────┐
│  Dashboard (React/Vite) │ ◄─────────────────────► │  LabVIEW WS Server      │
│  ws://host:port         │    TX: komendy WEB→LV    │  AR200.B + DAQ          │
│  Klient WS              │    RX: dane LV→WEB       │  Serwer WS              │
└─────────────────────────┘                           └─────────────────────────┘
```

- **LabVIEW** = WebSocket Server (nasłuchuje na porcie, np. `8080`)
- **Dashboard** = WebSocket Client (łączy się do serwera)
- Domyślny URL: `ws://localhost:8080`
- Format danych: **JSON UTF-8**

---

## Połączenie i cykl życia

### Handshake

Po nawiązaniu połączenia (`onopen`) klient wysyła automatycznie dwie wiadomości:
1. `hello` — identyfikacja klienta
2. `config_request` — żądanie aktualnej konfiguracji

#### 1. `hello`

```json
{
  "type": "hello",
  "ts": "2026-02-11T14:30:00.000Z",
  "user": {
    "username": "operator",
    "role": "user",
    "name": "Operator"
  },
  "app": "Stanowisko 2 badania cienkich warstw dla sensorów gazu",
  "ver": "3.0"
}
```

| Pole   | Typ         | Opis                                      |
|--------|-------------|-------------------------------------------|
| `type` | string      | Zawsze `"hello"`                          |
| `ts`   | ISO 8601    | Timestamp klienta                         |
| `user` | object/null | Zalogowany użytkownik                     |
| `app`  | string      | Nazwa aplikacji                           |
| `ver`  | string      | Wersja kontrolera                         |

### Reconnect (exponential backoff)

Po utracie połączenia klient automatycznie próbuje się połączyć ponownie:

| Próba | Opóźnienie |
|-------|------------|
| 0     | ~1.0 s     |
| 1     | ~1.7 s     |
| 2     | ~2.9 s     |
| 3     | ~4.9 s     |
| 4     | ~8.3 s     |
| 5+    | 15.0 s (max) |

Wzór: `delay = clamp(1000 × 1.7^tries, 1000, 15000)` ms

### Watchdog

- Interwał sprawdzania: co **1500 ms**
- Timeout: **12 sekund** bez żadnej wiadomości RX
- Po timeout: rozłączenie + reconnect

### Tryb offline (demo)

Gdy WS jest rozłączony, dashboard przechodzi w tryb symulacji:
- Symulacja PID z szumem
- Symulacja profilu segmentowego
- Generowanie alarmów HI/LO
- Zapis do historii co 1s

---

## Envelope — wspólny format wiadomości

### TX (Web → LabVIEW)

```json
{
  "type": "<command_type>",
  "ts": "2026-02-11T14:30:00.000Z",
  "user": {
    "username": "operator",
    "role": "user",
    "name": "Operator"
  },
  "data": { ... }
}
```

### RX (LabVIEW → Web)

```json
{
  "type": "<message_type>",
  "ts": "2026-02-11T14:30:00.000Z",
  "data": { ... }
}
```

> **Elastyczność RX:** Dispatcher akceptuje też `"kind"` zamiast `"type"` oraz `"payload"` zamiast `"data"`.

---

## TX: Komendy Web → LabVIEW (14 typów)

### 1. `setpoint_command` — Zmiana setpointu

**Wyzwalacz:** P2 Ustawienia → pola SP1/SP2/SP3

```json
{
  "type": "setpoint_command",
  "ts": "2026-02-11T14:30:00.000Z",
  "user": {"username": "operator", "role": "user", "name": "Operator"},
  "data": {
    "sp1": 180.0
  }
}
```

| Pole data | Typ   | Jednostka | Opis                        |
|-----------|-------|-----------|-----------------------------|
| `sp1`     | float | °C        | Setpoint 1 — temperatura    |
| `sp2`     | float | —         | Setpoint 2 (opcjonalnie)    |
| `sp3`     | float | —         | Setpoint 3 (opcjonalnie)    |

> Wysyłana jest **tylko zmieniona wartość**, nie wszystkie 3.

---

### 2. `mode_command` — Zmiana trybu regulacji

**Wyzwalacz:** P2 → przycisk MAN/AUTO lub START/STOP regulatora

```json
{
  "type": "mode_command",
  "ts": "2026-02-11T14:30:00.000Z",
  "user": {"username": "admin", "role": "admin", "name": "Administrator"},
  "data": {
    "manualMode": true
  }
}
```

lub:

```json
{
  "type": "mode_command",
  "ts": "2026-02-11T14:30:00.000Z",
  "user": {"username": "admin", "role": "admin", "name": "Administrator"},
  "data": {
    "regStatus": "RUN"
  }
}
```

| Pole data    | Typ     | Opis                                       |
|--------------|---------|---------------------------------------------|
| `manualMode` | boolean | `true` = tryb ręczny, `false` = PID auto    |
| `regStatus`  | string  | `"RUN"` / `"STOP"` — start/stop regulacji   |

> Wysyłana jest **tylko zmieniona właściwość**.

---

### 3. `manual_mv` — Ręczne sterowanie mocą

**Wyzwalacz:** P2 → suwak MV w trybie MANUAL

```json
{
  "type": "manual_mv",
  "ts": "2026-02-11T14:30:00.000Z",
  "user": {"username": "operator", "role": "user", "name": "Operator"},
  "data": {
    "mvManual": 55.0
  }
}
```

| Pole data  | Typ   | Jednostka | Opis                       |
|------------|-------|-----------|----------------------------|
| `mvManual` | float | %         | Moc wyjściowa 0–100        |

---

### 4. `pid_command` — Parametry PID

**Wyzwalacz:** P2 → przycisk Autotune lub ręczna zmiana PID

```json
{
  "type": "pid_command",
  "ts": "2026-02-11T14:30:00.000Z",
  "user": {"username": "admin", "role": "admin", "name": "Administrator"},
  "data": {
    "pidPb": 4.2,
    "pidTi": 95,
    "pidTd": 24
  }
}
```

| Pole data | Typ   | Jednostka | Opis                      |
|-----------|-------|-----------|---------------------------|
| `pidPb`   | float | °C        | Proportional Band         |
| `pidTi`   | float | s         | Czas całkowania           |
| `pidTd`   | float | s         | Czas różniczkowania       |

---

### 5. `alarm_clear` — Kasowanie LATCH alarmu

**Wyzwalacz:** P2 → przycisk LATCH

```json
{
  "type": "alarm_clear",
  "ts": "2026-02-11T14:30:00.000Z",
  "user": {"username": "admin", "role": "admin", "name": "Administrator"},
  "data": {
    "latch": true
  }
}
```

| Pole data | Typ     | Opis                                      |
|-----------|---------|-------------------------------------------|
| `latch`   | boolean | `true` = żądanie skasowania zatrzasku     |

---

### 6. `profile_command` — Start/Stop profilu segmentowego

**Wyzwalacz:** P1 Eksperyment / P2 → dialog Start / przycisk Stop

**Start:**

```json
{
  "type": "profile_command",
  "ts": "2026-02-11T14:30:00.000Z",
  "user": {"username": "operator", "role": "user", "name": "Operator"},
  "data": {
    "action": "start",
    "profileName": "Spiekanie ZnO",
    "segments": [
      {"name": "Rampa grzania", "sp": 200, "ramp": 5, "hold": 0},
      {"name": "Wygrzewanie",   "sp": 400, "ramp": 3, "hold": 60},
      {"name": "Chłodzenie",    "sp": 25,  "ramp": -10, "hold": 0}
    ]
  }
}
```

**Stop:**

```json
{
  "type": "profile_command",
  "ts": "2026-02-11T14:30:00.000Z",
  "user": {"username": "operator", "role": "user", "name": "Operator"},
  "data": {
    "action": "stop",
    "profileName": "Spiekanie ZnO"
  }
}
```

| Pole data          | Typ    | Opis                                         |
|--------------------|--------|----------------------------------------------|
| `action`           | string | `"start"` / `"stop"`                         |
| `profileName`      | string | Nazwa profilu                                |
| `segments`         | array  | Lista etapów (tylko przy `start`)            |
| `segments[].name`  | string | Nazwa etapu                                  |
| `segments[].sp`    | float  | Docelowa temperatura [°C]                    |
| `segments[].ramp`  | float  | Szybkość rampy [°C/min] (ujemna = chłodzenie)|
| `segments[].hold`  | float  | Czas utrzymania [min]                        |

---

### 7. `sample_info` — Dane próbki i procesu

**Wyzwalacz:** P3 Próbka → przycisk Zapisz / Wyślij WS

```json
{
  "type": "sample_info",
  "ts": "2026-02-11T14:30:00.000Z",
  "user": {"username": "student", "role": "student", "name": "Student"},
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

| Pole data      | Typ    | Opis                           |
|----------------|--------|--------------------------------|
| `sampleId`     | string | Identyfikator próbki           |
| `material`     | string | Materiał warstwy               |
| `substrate`    | string | Podłoże                        |
| `method`       | string | Metoda osadzania (PVD/CVD/Sol-Gel) |
| `thickness`    | string | Grubość [nm]                   |
| `targetGas`    | string | Gaz docelowy sensora           |
| `processTemp`  | string | Temperatura procesu [°C]       |
| `pressure`     | string | Ciśnienie [mbar]               |
| `atmosphere`   | string | Atmosfera (N₂, Ar, vacuum)     |
| `sourcePower`  | string | Moc źródła [W]                 |
| `processTime`  | string | Czas procesu [min]             |
| `gasFlow`      | string | Przepływ gazu [sccm]           |
| `operator`     | string | Operator                       |
| `batchNo`      | string | Numer serii                    |
| `goal`         | string | Cel eksperymentu               |
| `notes`        | string | Uwagi                          |
| `photos`       | array  | Lista ścieżek/base64 zdjęć    |

---

### 8. `report_create` — Nowy raport pomiarowy

**Wyzwalacz:** P7 Raporty → przycisk Dodaj raport

```json
{
  "type": "report_create",
  "ts": "2026-02-11T14:30:00.000Z",
  "user": {"username": "operator", "role": "user", "name": "Operator"},
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
    "photos": [
      {"name": "img1.png", "data": "data:image/png;base64,iVBORw0..."}
    ],
    "profile": "Spiekanie ZnO"
  }
}
```

| Pole data       | Typ    | Opis                            |
|-----------------|--------|---------------------------------|
| `id`            | number | Timestamp ID raportu            |
| `date`          | string | Data raportu (YYYY-MM-DD)       |
| `title`         | string | Tytuł raportu                   |
| `sampleId`      | string | ID powiązanej próbki            |
| `material`      | string | Materiał                        |
| `substrate`     | string | Podłoże                         |
| `method`        | string | Metoda                          |
| `tempMax`       | string | Temperatura maksymalna [°C]     |
| `result`        | string | Wynik pomiaru                   |
| `notes`         | string | Uwagi                           |
| `photos`        | array  | Zdjęcia `{name, data}` (base64)|
| `profile`       | string | Nazwa profilu temperatury       |

---

### 9. `report_update` — Aktualizacja raportu

**Wyzwalacz:** P7 Raporty → przycisk Zapisz zmiany (tryb edycji)

Struktura identyczna jak `report_create`. Pole `id` identyfikuje istniejący raport.

---

### 10. `config_update` — Aktualizacja konfiguracji

**Wyzwalacz:** P4 Konfiguracja → przycisk Zapisz

```json
{
  "type": "config_update",
  "ts": "2026-02-11T14:30:00.000Z",
  "user": {"username": "admin", "role": "admin", "name": "Administrator"},
  "data": {
    "wsUrl": "ws://127.0.0.1:8081/ws",
    "modbusAddr": 1,
    "baudRate": 9600,
    "ethIP": "192.168.1.10",
    "ethPort": 502
  }
}
```

| Pole data    | Typ    | Opis                        |
|--------------|--------|-----------------------------|
| `wsUrl`      | string | Adres WebSocket             |
| `modbusAddr` | int    | Adres MODBUS urządzenia     |
| `baudRate`   | int    | Prędkość portu szeregowego  |
| `ethIP`      | string | Adres IP Ethernet           |
| `ethPort`    | int    | Port TCP MODBUS             |

---

### 11. `mfc_config` — Konfiguracja przepływomierzy MFC

**Wyzwalacz:** P4 Konfiguracja MFC → przycisk Zapisz / Wyślij konfigurację MFC

```json
{
  "type": "mfc_config",
  "ts": "2026-02-11T10:30:00.000Z",
  "user": {"username": "admin", "role": "admin"},
  "data": {
    "mfc": [
      {"id": 1, "name": "MFC-1", "gas": "N₂", "gasComposition": "100% N₂", "ip": "192.168.1.101", "port": 502, "slaveAddr": 1, "maxFlow": 500, "unit": "sccm", "enabled": true},
      {"id": 2, "name": "MFC-2", "gas": "Ar", "gasComposition": "100% Ar", "ip": "192.168.1.102", "port": 502, "slaveAddr": 1, "maxFlow": 200, "unit": "sccm", "enabled": true},
      {"id": 3, "name": "MFC-3", "gas": "O₂", "gasComposition": "100% O₂", "ip": "192.168.1.103", "port": 502, "slaveAddr": 1, "maxFlow": 100, "unit": "sccm", "enabled": false},
      {"id": 4, "name": "MFC-4", "gas": "H₂S", "gasComposition": "10 ppm H₂S/N₂", "ip": "192.168.1.104", "port": 502, "slaveAddr": 1, "maxFlow": 50, "unit": "sccm", "enabled": false}
    ]
  }
}
```

| Pole data             | Typ     | Opis                                      |
|-----------------------|---------|-------------------------------------------|
| `mfc`                 | array   | Tablica 4 przepływomierzy MFC MKS         |
| `mfc[].id`            | number  | ID przepływomierza (1–4)                   |
| `mfc[].name`          | string  | Nazwa urządzenia                           |
| `mfc[].gas`           | string  | Nazwa gazu (N₂, Ar, O₂, H₂S)             |
| `mfc[].gasComposition`| string  | Skład gazu (np. "100% N₂", "10 ppm H₂S/N₂") |
| `mfc[].ip`            | string  | IP MODBUS Ethernet                         |
| `mfc[].port`          | number  | Port TCP (domyślnie 502)                   |
| `mfc[].slaveAddr`     | number  | Adres slave MODBUS                         |
| `mfc[].maxFlow`       | number  | Maksymalny przepływ                        |
| `mfc[].unit`          | string  | Jednostka (sccm/slm/l/min)                |
| `mfc[].enabled`       | boolean | Czy aktywny                                |

> Wysyłana jest **pełna konfiguracja** wszystkich 4 MFC jednocześnie.

---

### 12. `mfc_setpoint` — Setpoint pojedynczego MFC

**Wyzwalacz:** P2 / Panel MFC → zmiana setpointu przepływomierza

```json
{
  "type": "mfc_setpoint",
  "ts": "2026-02-11T10:31:00.000Z",
  "user": {"username": "operator", "role": "user"},
  "data": {"id": 1, "sp": 150.0}
}
```

| Pole data | Typ    | Jednostka | Opis                                    |
|-----------|--------|-----------|-----------------------------------------|
| `id`      | number | —         | ID przepływomierza (1–4)                 |
| `sp`      | float  | sccm      | Żądany setpoint przepływu                |

> Wysyłana jest zmiana setpointu dla **pojedynczego** MFC.

---

### 13. `impedance_request` — Żądanie pomiaru impedancji

**Wyzwalacz:** P8 Impedancja → przycisk "Pobierz dane (WS)" lub automatycznie po przełączeniu na LIVE

```json
{
  "type": "impedance_request",
  "ts": "2026-02-13T10:00:00.000Z",
  "user": {"username": "operator", "role": "user", "name": "Operator"},
  "data": {
    "f_min": 0.01,
    "f_max": 1000000,
    "n_points": 60,
    "mode": "sweep"
  }
}
```

| Pole data    | Typ    | Jednostka | Opis                                      |
|--------------|--------|-----------|-------------------------------------------|
| `f_min`      | float  | Hz        | Dolna granica zakresu częstotliwości       |
| `f_max`      | float  | Hz        | Górna granica zakresu częstotliwości       |
| `n_points`   | int    | —         | Liczba punktów pomiarowych (log-spaced)    |
| `mode`       | string | —         | Tryb pomiaru: `"sweep"` (pełny zakres)    |

> **Request-Response:** To jest żądanie jednorazowe. LabVIEW odpowiada wiadomością `impedance_data` z wynikami po zakończeniu sweep'u. Nie jest to streaming — każde żądanie generuje jedną odpowiedź.

---

### 14. `config_request` — Żądanie konfiguracji przy starcie

**Wyzwalacz:** Automatycznie po połączeniu WS (`onopen`), zaraz po `hello`

```json
{
  "type": "config_request",
  "ts": "2026-02-19T10:00:00.000Z",
  "user": {"username": "operator", "role": "user"},
  "data": {}
}
```

| Pole data | Typ    | Opis                                              |
|-----------|--------|----------------------------------------------------|
| (pusty)   | object | Brak parametrów — żądanie pełnej konfiguracji      |

> **Request-Response:** LabVIEW odpowiada wiadomością `config_data` z aktualną konfiguracją systemu. Dashboard cache'uje odpowiedź w `localStorage` jako fallback offline.

---

## RX: Wiadomości LabVIEW → Web (7 typów)

### 1. `measurement_update` — Dane pomiarowe (cykliczne)

**Częstotliwość:** Co interwał pomiarowy (200–1000 ms)

```json
{
  "type": "measurement_update",
  "ts": "2026-02-11T14:30:01.000Z",
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
      {"id": 1, "pv": 148.5, "sp": 150.0, "enabled": true},
      {"id": 2, "pv": 95.2, "sp": 100.0, "enabled": true}
    ]
  }
}
```

| Pole data    | Typ     | Jednostka | Opis                                              |
|--------------|---------|-----------|---------------------------------------------------|
| `pv1`        | float   | °C        | Wartość procesu 1 — temperatura pieca              |
| `pv2`        | float   | °C        | Wartość procesu 2 — temperatura próbki             |
| `ch3`        | float   | —         | Kanał 3 (dowolny pomiar)                          |
| `sp1`        | float   | °C        | Aktualny setpoint                                 |
| `mv`         | float   | %         | Moc wyjściowa regulatora                          |
| `out1`       | boolean | —         | Wyjście cyfrowe 1 (grzanie)                       |
| `manualMode` | boolean | —         | Aktualny tryb                                     |
| `res`        | float   | Ω         | Rezystancja sensora gazoczułego                   |
| `tm`         | float   | °C        | Temperatura mieszaniny gazowej (Sensirion)        |
| `rhm`        | float   | %RH       | Wilgotność względna mieszaniny gazowej (Sensirion)|
| `xlabzre`    | float   | Ω         | XLab — impedancja część rzeczywista Re(Z)         |
| `xlabzim`    | float   | Ω         | XLab — impedancja część urojona Im(Z)             |
| `xlabr`      | float   | Ω         | XLab — rezystancja (moduł)                        |
| `mfc`        | array   | —         | Tablica aktywnych MFC (opcjonalne)                |
| `mfc[].id`   | number  | —         | ID przepływomierza (1–4)                          |
| `mfc[].pv`   | float   | sccm      | Aktualny przepływ                                 |
| `mfc[].sp`   | float   | sccm      | Setpoint przepływu                                |
| `mfc[].enabled` | boolean | —      | Czy aktywny                                       |

> Pole `mfc` jest **opcjonalne** — pojawia się tylko gdy przepływomierze MFC są skonfigurowane i aktywne.
> Pola `res`, `tm`, `rhm`, `xlabzre`, `xlabzim`, `xlabr` są specyficzne dla **obu stanowisk** z podłączonymi sensorami.

**Efekt w UI:**
- Aktualizuje wskaźniki, gauge'e, wykresy
- Dodaje punkt do historii (ring buffer max 150 punktów)
- Format punktu: `{t: "MM:SS", pv1, pv2, sp1, ch3, mv, res, tm, rhm, xlabzre, xlabzim, xlabr}`

---

### 2. `status_update` — Status regulatora

**Częstotliwość:** Przy zmianach stanu

```json
{
  "type": "status_update",
  "ts": "2026-02-11T14:30:02.000Z",
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

| Pole data     | Typ     | Opis                                   |
|---------------|---------|----------------------------------------|
| `regMode`     | string  | Tryb regulacji (`"PID"`, `"ON/OFF"`)   |
| `regStatus`   | string  | `"RUN"` / `"STOP"`                     |
| `manualMode`  | boolean | Tryb ręczny                            |
| `progStatus`  | string  | Status programu segmentowego           |
| `progStage`   | int     | Aktualny etap profilu (1-indexed)      |
| `progElapsed` | int     | Czas trwania aktualnego etapu [s]      |
| `limitPower`  | float   | Limit mocy [%]                         |
| `pidPb/Ti/Td` | float   | Aktualne parametry PID                 |

**Efekt w UI:**
- Aktualizuje LED-y statusu w headerze i sidebarze
- Aktualizuje badge'e (REG, MAN, profil)

---

### 3. `alarm_event` — Zdarzenie alarmu

**Częstotliwość:** Przy wystąpieniu warunku alarmowego

```json
{
  "type": "alarm_event",
  "ts": "2026-02-11T14:30:03.000Z",
  "data": {
    "sev": "danger",
    "msg": "HI: PV1 przekroczone 220.5°C > SP + 10°C",
    "latch": true
  }
}
```

| Pole data | Typ     | Opis                                           |
|-----------|---------|-------------------------------------------------|
| `sev`     | string  | Priorytet: `"warning"` / `"danger"` / `"info"` |
| `msg`     | string  | Treść alarmu (czytelna)                         |
| `latch`   | boolean | `true` = alarm zatrzaśnięty (wymaga kasowania)  |

**Efekt w UI:**
- Ustawia `alarmSTB = true`
- Jeśli `latch = true` → ustawia `alarmLATCH = true`
- Dodaje wpis do listy alarmów (ring buffer max 100)
- Aktywuje LED ALM w headerze

---

### 4. `profile_status` — Status profilu temperatury

**Częstotliwość:** W trakcie wykonywania profilu

```json
{
  "type": "profile_status",
  "ts": "2026-02-11T14:30:04.000Z",
  "data": {
    "profileName": "Spiekanie ZnO",
    "stage": 2,
    "stageName": "Wygrzewanie",
    "progStatus": "RUN",
    "progElapsed": 420
  }
}
```

| Pole data      | Typ    | Opis                            |
|----------------|--------|---------------------------------|
| `profileName`  | string | Nazwa wykonywanego profilu      |
| `stage`        | int    | Numer aktualnego etapu          |
| `stageName`    | string | Nazwa aktualnego etapu          |
| `progStatus`   | string | `"RUN"` / `"STOP"` / `"DONE"` |
| `progElapsed`  | int    | Czas trwania etapu [s]          |

---

### 5. `state_snapshot` — Pełny snapshot stanu

**Częstotliwość:** Na żądanie, po reconnect

Alias: `mb_snapshot`

```json
{
  "type": "state_snapshot",
  "ts": "2026-02-11T14:30:05.000Z",
  "data": {
    "pv1": 156.3,
    "pv2": 45.2,
    "sp1": 160.0,
    "mv": 67.4,
    "manualMode": false,
    "mvManual": 40,
    "regStatus": "RUN",
    "progStatus": "STOP",
    "progStage": 0,
    "alarmSTB": false,
    "alarmLATCH": false,
    "out1": true,
    "out2": false,
    "alarm1": false,
    "alarm2": false
  }
}
```

**Efekt w UI:**
- Natychmiastowe nadpisanie/merge pełnego stanu `mb`
- Używane do synchronizacji po utracie i odnowieniu połączenia

---

### 6. `impedance_data` — Wyniki pomiaru impedancji

**Częstotliwość:** Na żądanie (odpowiedź na `impedance_request`)

```json
{
  "type": "impedance_data",
  "ts": "2026-02-13T10:00:05.000Z",
  "data": {
    "sweepId": 1,
    "f_min": 0.01,
    "f_max": 1000000,
    "n_points": 60,
    "duration_ms": 4500,
    "points": [
      {"f": 1000000, "z_re": 51.2, "z_im": -3.5},
      {"f": 630957,  "z_re": 52.1, "z_im": -5.8},
      {"f": 398107,  "z_re": 53.8, "z_im": -9.4},
      {"f": 0.01,    "z_re": 285.3, "z_im": -112.7}
    ]
  }
}
```

| Pole data        | Typ    | Jednostka | Opis                                         |
|------------------|--------|-----------|----------------------------------------------|
| `sweepId`        | int    | —         | Numer identyfikacyjny sweep'u (opcjonalny)   |
| `f_min`          | float  | Hz        | Dolna częstotliwość użyta w pomiarze          |
| `f_max`          | float  | Hz        | Górna częstotliwość użyta w pomiarze          |
| `n_points`       | int    | —         | Liczba punktów w tablicy `points`             |
| `duration_ms`    | int    | ms        | Czas trwania sweep'u (opcjonalny)             |
| `points`         | array  | —         | Tablica wyników pomiarowych                   |
| `points[].f`     | float  | Hz        | Częstotliwość                                 |
| `points[].z_re`  | float  | Ω         | Część rzeczywista impedancji Re(Z)            |
| `points[].z_im`  | float  | Ω         | Część urojona impedancji Im(Z) (ujemna=pojemnościowa) |

> Dashboard oblicza z `z_re` i `z_im`: moduł |Z|, fazę φ, −Im(Z). Wyniki wyświetlane na wykresach Bodego, Nyquista i R(f).

**Efekt w UI:**
- Aktualizuje 3 wykresy na stronie P8 Impedancja: Bode, Nyquist, R(f)
- Aktualizuje tabelę danych pomiarowych
- Dane przekazywane do iframe `impedance.html` przez `postMessage`

**Przepływ danych (iframe mode):**
```
LabVIEW → WS → App.jsx (applyLvMessage) → setImpData
  → useEffect → iframe.postMessage({type:"impedance_data", data})
    → impedance.html: computeFromRaw → updateCharts
```

---

### 7. `config_data` — Konfiguracja systemu

**Częstotliwość:** Na żądanie (odpowiedź na `config_request`)

```json
{
  "type": "config_data",
  "ts": "2026-02-19T10:00:01.000Z",
  "data": {
    "wsUrl": "ws://localhost:8080",
    "ethIP": "192.168.1.100",
    "ethPort": 502,
    "modbusAddr": 1,
    "baudRate": 9600,
    "mfc": [
      {"id": 1, "name": "MFC-1", "gas": "N₂", "maxFlow": 500, "unit": "sccm", "enabled": false},
      {"id": 2, "name": "MFC-2", "gas": "Ar", "maxFlow": 200, "unit": "sccm", "enabled": false}
    ],
    "users": {
      "operator": {"name": "Operator", "role": "user", "firstName": "Anna", "lastName": "Nowak"}
    }
  }
}
```

| Pole data    | Typ    | Opis                                       |
|--------------|--------|--------------------------------------------|
| `wsUrl`      | string | Adres WebSocket (opcjonalny)               |
| `ethIP`      | string | Adres IP Ethernet (opcjonalny)             |
| `ethPort`    | int    | Port TCP MODBUS (opcjonalny)               |
| `modbusAddr` | int    | Adres MODBUS (opcjonalny)                  |
| `baudRate`   | int    | Baud rate (opcjonalny)                     |
| `mfc`        | array  | Konfiguracja przepływomierzy (opcjonalna)  |
| `users`      | object | Konta użytkowników (opcjonalne)            |

> Wszystkie pola są **opcjonalne** — LabVIEW wysyła tylko te, które zarządza. Dashboard merguje je z wartościami domyślnymi.

**Efekt w UI:**
- Aktualizuje `mb` (sieć, MFC)
- Aktualizuje `users` (konta, role)
- Cache w `localStorage` klucz `tfl_config` jako fallback offline

**Cache offline:**
- Dashboard zapisuje `config_data` do `localStorage` po każdym odebraniu
- Przy starcie (przed połączeniem WS) ładuje cache z `localStorage`
- Cache jest nadpisywany przy każdym `config_data` z LabVIEW

---

## Podsumowanie — mapa komend

### TX (Web → LabVIEW): 14 typów

| # | type                | Źródło     | Wyzwalacz                        |
|---|---------------------|------------|----------------------------------|
| 0 | `hello`             | App        | Automatycznie po `onopen`        |
| 1 | `setpoint_command`  | P2         | Zmiana SP1/SP2/SP3               |
| 2 | `mode_command`      | P2         | MAN↔AUTO, REG START/STOP        |
| 3 | `manual_mv`         | P2         | Suwak MV w trybie MANUAL         |
| 4 | `pid_command`       | P2         | Autotune / zmiana PID            |
| 5 | `alarm_clear`       | P2         | Kasowanie LATCH alarmu           |
| 6 | `profile_command`   | P1/P2      | Start/Stop profilu segmentowego  |
| 7 | `sample_info`       | P3         | Zapisanie danych próbki          |
| 8 | `report_create`     | P7         | Nowy raport pomiarowy            |
| 9 | `report_update`     | P7         | Edycja istniejącego raportu      |
| 10| `config_update`     | P4         | Zapisanie konfiguracji           |
| 11| `mfc_config`        | P4         | Konfiguracja przepływomierzy MFC |
| 12| `mfc_setpoint`      | P2/MFC     | Zmiana setpointu pojedynczego MFC|
| 13| `impedance_request` | P8         | Żądanie pomiaru impedancji (sweep)|
| 14| `config_request`    | App        | Automatycznie po `onopen` (po `hello`)|

### RX (LabVIEW → Web): 7 typów

| # | type                 | Efekt                                              |
|---|----------------------|----------------------------------------------------|
| 1 | `measurement_update` | Aktualizacja PV/SP/MV + wykres + MFC (cykliczne)   |
| 2 | `status_update`      | Status regulacji, program, PID                     |
| 3 | `alarm_event`        | Dodanie alarmu, latch                              |
| 4 | `profile_status`     | Status profilu segmentowego                        |
| 5 | `state_snapshot`     | Pełna synchronizacja stanu (bulk)                  |
| 6 | `impedance_data`     | Wyniki sweep'u impedancji (request-response)       |
| 7 | `config_data`        | Konfiguracja systemu (cache → localStorage)        |

---

## Stan aplikacji — pola `mb` (measurement block)

Obiekt `mb` jest centralnym stanem sterującym całym UI. Poniżej wszystkie pola z wartościami domyślnymi:

### Pomiary

| Pole              | Typ     | Domyślnie | Jednostka | Opis                                            |
|-------------------|---------|-----------|-----------|-------------------------------------------------|
| `pv1`             | float   | ~25       | °C        | Temperatura pieca (primary)                      |
| `pv2`             | float   | ~45       | °C        | Temperatura próbki (secondary)                   |
| `ch3`             | float   | 0         | —         | Kanał 3 (obliczeniowy)                           |
| `mv`              | float   | 0         | %         | Moc wyjściowa PID                                |
| `mvManual`        | float   | 50        | %         | Moc ręczna (tryb MANUAL)                         |
| `manualMode`      | boolean | false     | —         | `true` = tryb ręczny                             |
| `res`        | float   | null      | Ω         | Rezystancja sensora gazoczułego                   |
| `tm`         | float   | null      | °C        | Temperatura mieszaniny gazowej (Sensirion)        |
| `rhm`        | float   | null      | %RH       | Wilgotność względna mieszaniny gazowej (Sensirion)|
| `xlabzre`    | float   | null      | Ω         | XLab — impedancja część rzeczywista Re(Z)         |
| `xlabzim`    | float   | null      | Ω         | XLab — impedancja część urojona Im(Z)             |
| `xlabr`      | float   | null      | Ω         | XLab — rezystancja (moduł)                        |

### Setpointy

| Pole  | Typ   | Domyślnie | Jednostka | Opis        |
|-------|-------|-----------|-----------|-------------|
| `sp1` | float | 100       | °C        | Setpoint 1  |
| `sp2` | float | 60        | —         | Setpoint 2  |
| `sp3` | float | 80        | —         | Setpoint 3  |

### Wyjścia

| Pole   | Typ     | Domyślnie | Opis              |
|--------|---------|-----------|-------------------|
| `out1` | boolean | false     | Wyjście cyfrowe 1 |
| `out2` | boolean | false     | Wyjście cyfrowe 2 |

### Alarmy

| Pole        | Typ     | Domyślnie | Opis                     |
|-------------|---------|-----------|--------------------------|
| `alarm1`    | boolean | false     | Alarm HI (wysoka temp.)  |
| `alarm2`    | boolean | false     | Alarm LO (niska temp.)   |
| `alarmSTB`  | boolean | false     | Alarm standby            |
| `alarmLATCH`| boolean | false     | Alarm zatrzaśnięty       |

### Regulacja PID

| Pole        | Typ    | Domyślnie | Jednostka | Opis                    |
|-------------|--------|-----------|-----------|-------------------------|
| `regMode`   | string | "PID"     | —         | Tryb regulacji           |
| `regStatus` | string | "RUN"     | —         | "RUN" / "STOP"           |
| `pidPb`     | float  | 5         | °C        | Proportional Band        |
| `pidTi`     | float  | 120       | s         | Czas całkowania          |
| `pidTd`     | float  | 30        | s         | Czas różniczkowania      |
| `pidI`      | float  | 0         | —         | Akumulator całki (wewn.) |
| `pidPrevE`  | float  | 0         | —         | Poprzedni błąd (wewn.)   |
| `limitPower`| float  | 100       | %         | Limit mocy               |
| `hyst`      | float  | 1         | °C        | Histereza alarmów        |

### Profil segmentowy

| Pole         | Typ    | Domyślnie | Opis                          |
|--------------|--------|-----------|-------------------------------|
| `progStage`  | int    | 0         | Aktualny etap (0 = nie działa)|
| `progStatus` | string | "STOP"    | "RUN" / "STOP"                |
| `progElapsed`| int    | 0         | Czas w aktualnym etapie [s]   |

### Przepływomierze MFC

| Pole               | Typ      | Domyślnie | Opis                                    |
|--------------------|----------|-----------|------------------------------------------|
| `mfc`              | Array[4] | []        | Tablica 4 przepływomierzy MFC MKS        |
| `mfc[].id`         | number   | —         | ID przepływomierza (1–4)                 |
| `mfc[].name`       | string   | —         | Nazwa urządzenia                          |
| `mfc[].gas`        | string   | —         | Nazwa gazu (N₂, Ar, O₂, H₂S)            |
| `mfc[].gasComposition` | string | —      | Skład gazu                                |
| `mfc[].ip`         | string   | —         | IP MODBUS Ethernet                        |
| `mfc[].port`       | number   | 502       | Port TCP (domyślnie 502)                  |
| `mfc[].slaveAddr`  | number   | 1         | Adres slave MODBUS                        |
| `mfc[].maxFlow`    | number   | —         | Maksymalny przepływ                       |
| `mfc[].unit`       | string   | "sccm"    | Jednostka (sccm/slm/l/min)               |
| `mfc[].pv`         | number   | 0         | Aktualny przepływ                         |
| `mfc[].sp`         | number   | 0         | Setpoint                                  |
| `mfc[].enabled`    | boolean  | false     | Czy aktywny                               |

### Komunikacja

| Pole         | Typ    | Domyślnie        | Opis                    |
|--------------|--------|-------------------|-------------------------|
| `modbusAddr` | int    | 1                 | Adres MODBUS             |
| `baudRate`   | int    | 9600              | Baud rate                |
| `charFmt`    | string | "8N1"             | Format znakowy           |
| `ethIP`      | string | "192.168.1.100"   | IP Ethernet              |
| `ethPort`    | int    | 502               | Port TCP MODBUS          |
| `mqttBroker` | string | "192.168.1.1"     | Adres MQTT               |
| `mqttPort`   | int    | 1883              | Port MQTT                |
| `mqttTopic`  | string | "LAB/ThinFilm"    | Topic MQTT               |
| `wsUrl`      | string | "ws://localhost:8080" | URL WebSocket         |
| `wsConnected`| boolean| false             | Stan połączenia WS       |

### Inne

| Pole        | Typ    | Domyślnie | Opis                   |
|-------------|--------|-----------|------------------------|
| `recStatus` | string | "REC"     | Status nagrywania      |
| `recInterval`| int   | 5         | Interwał zapisu [s]    |
| `memUsed`   | int    | 42        | Zużycie pamięci [%]    |
| `rtc`       | Date   | now()     | Zegar czasu rzeczyw.   |
| `inType1`   | string | "TC-K"    | Typ wejścia (termopara)|

---

## WS Console (debug)

Panel debug w headerze rejestruje wszystkie wiadomości:
- Zakładka **RX**: odebrane z LabVIEW (max 80)
- Zakładka **TX**: wysłane do LabVIEW (max 80)
- Każda wiadomość: timestamp, type, pełny JSON z możliwością kopiowania
