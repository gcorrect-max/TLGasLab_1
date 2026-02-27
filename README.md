# Stanowisko 2 — Badania cienkich warstw dla sensorów gazu

Dashboard SCADA/HMI do sterowania i monitorowania stanowiska laboratoryjnego do osadzania i badania cienkich warstw gazoczułych — rozszerzony o pomiary środowiska testowego (rezystancja sensora, temperatura i wilgotność mieszaniny gazowej).

**Aplikacja:** ThinFilmLab 2
**URL (dev):** http://localhost:3002
**Repozytorium:** https://github.com/gcorrect-max/TLGasLab_1

---

## Architektura

```
┌────────────────────┐    WebSocket (JSON)    ┌──────────────────────────┐
│  React Dashboard    │ ◄────────────────────► │  LabVIEW WS Server       │
│  http://host:3000  │                        │  AR200.B + DAQ           │
│  Stanowisko 2       │   TX: komendy WEB→LV  │  Regulatory PID          │
└────────────────────┘   RX: dane LV→WEB      │  4x MFC MKS (MODBUS)    │
        │                                     │  Czujniki środowiskowe   │
        ▼                                     └──────────────────────────┘
 InfluxDB v2 (Docker)
 bucket: measurements
```

## Stos technologiczny

| Komponent | Wersja |
|-----------|--------|
| React | 19 |
| Vite | 6 |
| Recharts | 2.15 |
| InfluxDB client (browser) | 1.35 |
| Transport | WebSocket (JSON) |

---

## Szybki start

```bash
npm install
npm run dev        # serwer dev (domyślnie: http://localhost:5173)
npm run build      # build produkcyjny
npm run preview    # podgląd buildu
```

### Domyślne konta (konfigurowalne w `USERS_INIT`)

| Użytkownik | Hasło | Rola |
|------------|-------|------|
| admin | admin123 | admin |
| operator | oper123 | user |
| student | stud123 | student |
| guest | guest | guest |

### InfluxDB (opcjonalne)

```bat
docker compose up -d
```

Dostęp: http://localhost:8086 | login: admin | hasło: thinfilm2026

---

## Struktura projektu

```
BasiaLab1/
├── src/
│   ├── App.jsx          # Główna aplikacja React (monolityczna)
│   └── influx.js        # Klient InfluxDB (zapis + odczyt historii)
├── public/
│   ├── help.json        # FAQ PL/EN (strona P9)
│   └── impedance.html   # Moduł spektroskopii impedancyjnej (iframe, P8)
├── docs/                # Dokumentacja techniczna
├── docker-compose.yml   # InfluxDB v2 w Dockerze
├── index.html           # Browser tab: ThinFilmLab 2
└── package.json
```

---

## Funkcje dashboardu (strony P1–P9)

| Strona | Nazwa | Opis |
|--------|-------|------|
| P1 | Monitorowanie | Schemat stanowiska (GasLab SVG), wykresy PV/SP/MV live, sterowanie eksperymentem, wykres rezystancji sensora i warunków środowiskowych |
| P2 | Ustawienia | Setpointy SP1/SP2/SP3, tryb MAN/AUTO, suwak MV, PID, profil segmentowy |
| P3 | Próbka | Formularz metadanych próbki, zapis do MySQL i WebSocket |
| P4 | Konfiguracja | WS URL, MODBUS, konfiguracja 4 MFC MKS, import SVG |
| P5 | Konsola WS | Log TX/RX, eksport CSV historii pomiarów |
| P6 | Logi | Dziennik zdarzeń aplikacji |
| P7 | Raporty | Tworzenie i edycja raportów pomiarowych ze zdjęciami |
| P8 | Impedancja | Spektroskopia impedancyjna — wykresy Bode, Nyquist, R(f) |
| P9 | Pomoc | FAQ PL/EN |

---

## Dodatkowe pola pomiarowe (względem Stanowiska 1)

Stanowisko 2 obsługuje pomiary środowiska testowego sensora gazu:

| Pole | Typ | Jednostka | Opis |
|------|-----|-----------|------|
| `resistance` | float | Ω | Rezystancja sensora gazoczułego (auto-formatowanie: Ω / kΩ / MΩ) |
| `gasMixTemp` | float | °C | Temperatura mieszaniny gazowej (czujnik Sensirion) |
| `gasMixHumidity` | float | %RH | Wilgotność względna mieszaniny gazowej (czujnik Sensirion) |

Pola te są przesyłane w `measurement_update` z LabVIEW i wyświetlane jako osobna oś Y na wykresie P1.

### Formatowanie rezystancji

| Wartość | Wyświetlanie |
|---------|--------------|
| ≥ 1 MΩ (1 000 000) | `X.XX MΩ` |
| ≥ 1 kΩ (1 000) | `X.X kΩ` |
| < 1 kΩ | `X Ω` |

---

## Komunikacja WebSocket

**Protokół:** JSON over WebSocket
**Domyślny URL:** `ws://localhost:8080` (konfigurowalne w P4 → zakładka WebSocket)
**Pełna dokumentacja:** [docs/PROTOCOL_JSON_WS.md](docs/PROTOCOL_JSON_WS.md)

### Envelope — wspólny format wiadomości

**TX (Dashboard → LabVIEW):**
```json
{
  "type": "<command_type>",
  "ts": "2026-02-11T14:30:00.000Z",
  "user": { "username": "operator", "role": "user", "name": "Operator" },
  "data": { ... }
}
```

**RX (LabVIEW → Dashboard):**
```json
{
  "type": "<message_type>",
  "ts": "2026-02-11T14:30:00.000Z",
  "data": { ... }
}
```

### TX: Dashboard → LabVIEW (14 typów)

| Typ | Opis |
|-----|------|
| `hello` | Identyfikacja klienta (auto po połączeniu) |
| `config_request` | Żądanie konfiguracji (auto po połączeniu) |
| `setpoint_command` | Zmiana SP1/SP2/SP3 |
| `mode_command` | MAN/AUTO, START/STOP regulatora |
| `manual_mv` | Moc ręczna 0–100% |
| `pid_command` | Parametry PID (Pb, Ti, Td) |
| `alarm_clear` | Kasowanie alarmu LATCH |
| `profile_command` | Start/Stop profilu segmentowego (z nastawami MFC) |
| `sample_info` | Dane próbki (P3) |
| `report_create` | Nowy raport (P7) |
| `report_update` | Edycja raportu (P7) |
| `mfc_config` | Konfiguracja 4 MFC |
| `mfc_setpoint` | Nastawa przepływomierza |
| `impedance_request` | Żądanie pomiaru impedancji (P8) |

### RX: LabVIEW → Dashboard (7 typów)

| Typ | Opis |
|-----|------|
| `measurement_update` | PV1, PV2, SP1, MV, MFC[], resistance, gasMixTemp, gasMixHumidity — co ~1s |
| `status_update` | Status regulacji, PID, profil |
| `alarm_event` | Zdarzenie alarmu |
| `state_snapshot` | Pełny snapshot stanu (po reconnect) |
| `profile_status` | Postęp profilu segmentowego |
| `impedance_data` | Wyniki pomiaru impedancji |
| `config_data` | Konfiguracja systemu |

### Format `measurement_update` (Stanowisko 2)

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
    "outAnalog": 12.8,
    "out1": true,
    "manualMode": false,
    "resistance": 125000.5,
    "gasMixTemp": 24.8,
    "gasMixHumidity": 45.2,
    "mfc": [
      { "id": 1, "pv": 120.5, "sp": 150, "enabled": true },
      { "id": 2, "pv": 85.0,  "sp": 100, "enabled": true },
      { "id": 3, "pv": 0.0,   "sp": 0,   "enabled": false },
      { "id": 4, "pv": 0.0,   "sp": 0,   "enabled": false }
    ]
  }
}
```

| Pole | Typ | Jednostka | Opis |
|------|-----|-----------|------|
| `pv1` | float | °C | Temperatura pieca (termopara) |
| `pv2` | float | °C | Temperatura próbki |
| `mv` | float | % | Moc grzania (manipulated variable) |
| `out1` | bool | — | Stan wyjścia grzewczego |
| `outAnalog` | float | mA | Wyjście analogowe (4–20 mA) |
| `resistance` | float | Ω | Rezystancja elektryczna sensora |
| `gasMixTemp` | float | °C | Temperatura mieszaniny gazowej |
| `gasMixHumidity` | float | %RH | Wilgotność mieszaniny gazowej |
| `mfc[].id` | int | — | Nr MFC (1–4) |
| `mfc[].pv` | float | sccm | Aktualny przepływ |
| `mfc[].sp` | float | sccm | Nastawa przepływu |
| `mfc[].enabled` | bool | — | Czy MFC aktywny |

Wszystkie pola opcjonalne — brakujące pola zachowują poprzednią wartość w stanie dashboardu.

---

## Tryb DEMO (offline)

Gdy WS jest rozłączony, dashboard uruchamia symulację PID z realistycznym modelem pieca. Dane zapisywane do InfluxDB ze znacznikiem `_source: "demo"`. Reconnekcja z wykładniczym backoff 1–15s.

---

## InfluxDB

| Parametr | Wartość |
|----------|---------|
| URL | http://localhost:8086 |
| Organizacja | ThinFilmLab |
| Bucket | measurements |
| Token | tfl-dev-token-2026 |
| Retencja | 30 dni |

Pola zapisywane: `pv1`, `pv2`, `sp1`, `mv`, `mfc1`–`mfc4`, `resistance`, `gasMixTemp`, `gasMixHumidity`

Pełna dokumentacja: [docs/INFLUXDB_SETUP.md](docs/INFLUXDB_SETUP.md)

---

## Integracja z LabVIEW

Wymagania po stronie LabVIEW:
- Serwer WebSocket nasłuchujący na porcie 8080
- Cykliczne `measurement_update` co ~1s z polami: `pv1`, `pv2`, `sp1`, `mv`, `mfc[]`, `resistance`, `gasMixTemp`, `gasMixHumidity`
- Obsługa komend: `setpoint_command`, `mode_command`, `profile_command`, `mfc_setpoint`, `mfc_config`

Osadzenie w WebView2:
- Runtime: Microsoft Edge WebView2 (https://developer.microsoft.com/microsoft-edge/webview2/)
- Wrapper VIPM: `sklein_lib_webview2` (https://www.vipm.io/package/sklein_lib_webview2/)

Szczegóły: [docs/LABVIEW_INTEGRATION.md](docs/LABVIEW_INTEGRATION.md), [docs/LABVIEW_IMPLEMENTATION_GUIDE.md](docs/LABVIEW_IMPLEMENTATION_GUIDE.md)

---

## Uprawnienia użytkowników

| Rola | Dostęp do stron |
|------|-----------------|
| admin | Wszystkie (P1–P9) |
| user (operator) | P1–P9 |
| student | P1, P2, P3, P7, P8, P9 |
| guest | P1, P9 |

---

## Dokumentacja techniczna

| Plik | Opis |
|------|------|
| [docs/PROTOCOL_JSON_WS.md](docs/PROTOCOL_JSON_WS.md) | Pełna specyfikacja protokołu WebSocket JSON |
| [docs/ws_protocol.md](docs/ws_protocol.md) | Protokół WS — opis komend (wersja skrócona) |
| [docs/LABVIEW_INTEGRATION.md](docs/LABVIEW_INTEGRATION.md) | Integracja z LabVIEW — przegląd |
| [docs/LABVIEW_IMPLEMENTATION_GUIDE.md](docs/LABVIEW_IMPLEMENTATION_GUIDE.md) | Implementacja strony LabVIEW — szczegóły VI |
| [docs/API_ENDPOINTS.md](docs/API_ENDPOINTS.md) | Endpointy i interfejsy API (WS, InfluxDB, MySQL) |
| [docs/INFLUXDB_SETUP.md](docs/INFLUXDB_SETUP.md) | Instalacja i konfiguracja InfluxDB v2 |
| [docs/ERROR_HANDLING.md](docs/ERROR_HANDLING.md) | Obsługa błędów i graceful degradation |
| [docs/RUN_LABVIEW_WEBVIEW.md](docs/RUN_LABVIEW_WEBVIEW.md) | Uruchomienie UI w LabVIEW WebView2 |
| [docs/ThinFilmLab_LabVIEW_WebView2_Runbook.md](docs/ThinFilmLab_LabVIEW_WebView2_Runbook.md) | Runbook WebView2 — krok po kroku |
| [docs/SVG_DYNAMIC_WEBVIEW2.md](docs/SVG_DYNAMIC_WEBVIEW2.md) | Dynamiczny SVG z JavaScript i WebView2 |
| [docs/LABVIEW_VI_COMMUNICATION.md](docs/LABVIEW_VI_COMMUNICATION.md) | Lista VI do komunikacji LabVIEW ↔ Web |

---

## Uwagi

- URL WebSocket domyślnie `ws://localhost:8080`, zmiana w P4 → zakładka WebSocket
- Dashboard obsługuje **własne diagramy SVG** — wgraj eksport z draw.io przez P4
- Motywy **ciemny i jasny** — SVG automatycznie dostosowuje kolory przez zmienne motywu (`T.*`)
- Handler `measurement_update` merge'uje wszystkie pola z LabVIEW — nowe pola są automatycznie obsługiwane bez zmian w dashboardzie
