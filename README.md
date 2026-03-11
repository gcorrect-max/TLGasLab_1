# Stanowisko 2 — Badania cienkich warstw dla sensorów gazu

Dashboard SCADA/HMI do sterowania i monitorowania stanowiska laboratoryjnego do osadzania i badania cienkich warstw gazoczułych — rozszerzony o pomiary środowiska testowego (rezystancja sensora, temperatura i wilgotność mieszaniny gazowej).

**Aplikacja:** ThinFilmLab 2
**URL (dev):** http://localhost:3002
**Repozytorium:** https://github.com/gcorrect-max/TLGasLab_1

---

## Architektura

```
┌────────────────────┐    WebSocket (JSON)    ┌──────────────────────────┐
│  React Dashboard   │ ◄────────────────────► │  LabVIEW WS Server       │
│  S2 :3003          │                        │  AR200.B + DAQ           │
│  Stanowisko 2      │   TX: komendy WEB→LV   │  Regulatory PID          │
└────────────────────┘   RX: dane LV→WEB      │  4x MFC MKS (MODBUS)    │
        │                                     │  Czujniki środowiskowe   │
        ├──► InfluxDB v2 (Docker :8086)       └──────────────────────────┘
        │    bucket: measurements
        │
        └──► Express API (:3001)  ──► MySQL mysql.agh.edu.pl:3306
             server/server.js          baza: sobkow  station='S2'
             (serwer z projektu S1,    tabele: tfl_samples, tfl_experiments,
              wspólny dla obu stacji)           tfl_alarms
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

## Uruchomienie

### Wymagania systemowe

| Wymaganie | Wersja min. | Sprawdzenie | Uwagi |
|-----------|-------------|-------------|-------|
| Node.js | ≥ 18 LTS | `node -v` | https://nodejs.org |
| npm | ≥ 9 | `npm -v` | instalowany z Node.js |
| Docker Desktop | dowolna | `docker -v` | tylko do InfluxDB (opcjonalne) |
| VPN AGH | — | — | wymagany do MySQL (`mysql.agh.edu.pl`) |

---

### Wszystkie dostępne komendy npm

```bat
cd E:\BasiaLab1

npm run dev           # serwer deweloperski Vite → http://localhost:3002
npm run build         # build produkcyjny do dist/
npm run preview       # podgląd buildu → http://localhost:4173
npm run server        # backend Express + MySQL → http://localhost:3005
npm run server:dev    # jw. z auto-reload (--watch)
```

---

### Krok po kroku — pierwsze uruchomienie

**1. Zainstaluj zależności frontendu:**
```bat
cd E:\BasiaLab1
npm install
```

**2. Zainstaluj zależności backendu:**
```bat
cd E:\BasiaLab1\server
npm install
cd ..
```

**3. Utwórz plik konfiguracyjny backendu:**
```bat
copy server\.env.example server\.env
```
Edytuj `server\.env` — uzupełnij dane autoryzacji MySQL:
```env
# ── Autoryzacja bazy danych MySQL ──────────────────────────────
DB_HOST=mysql.agh.edu.pl
DB_PORT=3306
DB_NAME=sobkow2
DB_USER=sobkow2
DB_PASS=<twoje_haslo>

# ── Konfiguracja serwera API ────────────────────────────────────
API_PORT=3005
```
> MySQL dostępny tylko z sieci AGH lub przez VPN AGH. Bez połączenia dashboard działa normalnie (graceful degradation).

**4. Uruchom backend S2 (osobny terminal):**
```bat
cd E:\BasiaLab1
npm run server
```
Sprawdź: http://localhost:3005/api/health → `{ "ok": true }`

**3. (Opcjonalnie) Uruchom InfluxDB:**
```bat
cd E:\BasiaLab1
docker compose up -d
```
Poczekaj ~10 s, sprawdź: http://localhost:8086
Login: `admin` / Hasło: `thinfilm2026`

**5. Uruchom frontend:**
```bat
cd E:\BasiaLab1
npm run dev
```
Otwórz: http://localhost:3002

---

### Uruchomienie obu stanowisk jednocześnie (S1 + S2)

Każde stanowisko ma **własny backend** — uruchamiamy 4 terminale:

```bat
REM Terminal 1 — Backend S1 (ThinFilmLab 1)
cd E:\Basia\ThinFilmLab
npm run server

REM Terminal 2 — Backend S2 (ThinFilmLab 2)
cd E:\BasiaLab1
npm run server

REM Terminal 3 — Frontend S1
cd E:\Basia\ThinFilmLab
npx vite --port 3004

REM Terminal 4 — Frontend S2
cd E:\BasiaLab1
npx vite --port 3002
```

| Usługa | URL | Opis |
|--------|-----|------|
| Frontend S1 | http://localhost:3004 | ThinFilmLab 1 |
| Frontend S2 | http://localhost:3002 | ThinFilmLab 2 |
| Backend S1 API | http://localhost:3001 | Express + MySQL (sobkow) |
| Backend S2 API | http://localhost:3005 | Express + MySQL (sobkow2) |
| InfluxDB | http://localhost:8086 | Time-series (opcjonalny) |

---

### Build produkcyjny

```bat
cd E:\BasiaLab1

REM Zbuduj aplikację
npm run build

REM Podgląd lokalny buildu
npm run preview

REM Serwowanie buildu na wybranym porcie
npx serve -s dist -l 3002
```

Pliki wyjściowe w `dist/`:
```
dist/
├── index.html
├── help.json
└── assets/
    └── index-*.js    (~400 KB, minified + gzipped)
```

---

### InfluxDB — pełna obsługa

```bat
cd E:\BasiaLab1

docker compose up -d             # uruchom w tle
docker compose down              # zatrzymaj
docker compose restart influxdb  # restart kontenera
docker compose logs influxdb     # logi kontenera
docker compose ps                # status kontenerów
```

Konfiguracja (`docker-compose.yml`):

| Parametr | Wartość |
|----------|---------|
| URL | http://localhost:8086 |
| Login | admin |
| Hasło | thinfilm2026 |
| Organizacja | ThinFilmLab |
| Bucket | measurements |
| Token | tfl-dev-token-2026 |
| Retencja | 30 dni |

---

### Uruchomienie w LabVIEW WebView2

```bat
REM Zbuduj aplikację
cd E:\BasiaLab1
npm run build

REM Opcja A — plik lokalny (bez serwera)
REM W LabVIEW ustaw URL: file:///E:/BasiaLab1/dist/index.html

REM Opcja B — serwer lokalny (zalecane)
npx serve -s dist -l 3002
REM W LabVIEW ustaw URL: http://localhost:3002
```

---

### Domyślne konta

| Użytkownik | Hasło | Rola | Dostęp |
|------------|-------|------|--------|
| admin | admin123 | admin | P1–P9 (pełny) |
| operator | oper123 | user | P1–P9 |
| student | stud123 | student | P1, P2, P3, P7, P8, P9 |
| guest | guest | guest | P1, P9 |

---

## Struktura projektu

```
BasiaLab1/
├── src/
│   ├── App.jsx          # Główna aplikacja React (monolityczna)
│   └── influx.js        # Klient InfluxDB (zapis + odczyt historii)
├── public/
│   └── help.json        # FAQ PL/EN (strona P9)
├── docs/                # Dokumentacja techniczna
├── docker-compose.yml   # InfluxDB v2 w Dockerze
├── index.html           # Browser tab: ThinFilmLab 2
└── package.json
```

> Backend MySQL (`server/server.js`) znajduje się w projekcie S1 (ThinFilmLab).

---

## Funkcje dashboardu (strony P1–P9)

| Strona | Nazwa | Opis |
|--------|-------|------|
| P1 | Monitorowanie | Schemat stanowiska (GasLab SVG), wykresy PV/SP/MV live, sterowanie eksperymentem, wykres rezystancji sensora i warunków środowiskowych |
| P2 | Ustawienia | Setpointy SP1/SP2/SP3, tryb MAN/AUTO, suwak MV, PID, profil segmentowy |
| P3 | Próbka | Formularz metadanych próbki, zapis do MySQL (`station='S2'`) i WebSocket |
| P4 | Konfiguracja | WS URL, MODBUS, konfiguracja 4 MFC MKS, import SVG |
| P5 | Konsola WS | Log TX/RX, eksport CSV historii pomiarów |
| P6 | Logi | Dziennik zdarzeń aplikacji |
| P7 | Raporty | Tworzenie i edycja raportów pomiarowych ze zdjęciami |
| P8 | Impedancja | Spektroskopia impedancyjna — React (bez iframe): Bode, Nyquist, R(f), pop-out ⧉ |
| P9 | Pomoc | FAQ PL/EN |

---

## Integracja MySQL (Stanowisko 2)

S2 korzysta z tego samego serwera Express (`:3001`) co S1.
Wszystkie zapisy do bazy zawierają `station = "S2"`.

| Zdarzenie | Akcja MySQL |
|-----------|-------------|
| Kliknięcie **▶ Start** (P2) | `POST /api/experiments` → `{station:"S2", profileName, sampleId, status:"RUN"}` |
| Kliknięcie **⏹ Stop** (P2) | `PATCH /api/experiments/:id` → `{status:"DONE", finishedAt}` |
| Przychodzący `alarm_event` (WS) | `POST /api/alarms` → `{station:"S2", experimentId, severity, msg}` |
| Kliknięcie **Zapisz próbkę** (P3) | `POST /api/samples` → `{...sample, station:"S2"}` |
| Wyszukiwanie próbek (P3) | `GET /api/samples/search?…&station=S2` |
| Załaduj wszystkie próbki (P3) | `GET /api/samples?station=S2` |

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
- Backend S2 uruchamiany z własnego projektu: `cd E:\BasiaLab1 && npm run server` → http://localhost:3005
- Konfiguracja bazy danych w `server\.env` (DB_NAME, DB_USER, DB_PASS, API_PORT)
- MySQL dostępny tylko z sieci AGH lub przez VPN AGH; bez połączenia dashboard działa normalnie (graceful degradation)
