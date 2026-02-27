# Integracja Stanowiska 2 (ThinFilmLab 2) z LabVIEW

## Przegląd

ThinFilmLab 2 to aplikacja webowa (React + Vite) pełniąca rolę SCADA/HMI dla stanowiska laboratoryjnego do badania cienkich warstw gazoczułych. Stanowisko 2 rozszerza funkcje o pomiar rezystancji sensora oraz warunków środowiskowych mieszaniny gazowej (temperatura, wilgotność). Komunikacja z kontrolerem LabVIEW odbywa się przez **WebSocket** z wymianą komunikatów w formacie **JSON**.

```
┌─────────────────┐    WebSocket (JSON)    ┌────────────────────────┐
│  React Dashboard │ ◄──────────────────► │   LabVIEW WS Server    │
│  http://host:3000│                       │   AR200.B + DAQ + MFC  │
│                  │   TX: komendy WEB→LV  │                        │
│  src/App.jsx     │   RX: dane LV→WEB     │   Regulatory PID       │
│  src/influx.js   │                       │   4x MFC MKS (MODBUS)  │
│                  │                       │   Impedancja            │
└─────────────────┘                        └────────────────────────┘
        │
        ▼
 InfluxDB v2 (Docker)
 measurements bucket
```

## Wymagania po stronie LabVIEW

### WebSocket Server
- LabVIEW musi uruchomić **serwer WebSocket** nasłuchujący na skonfigurowanym porcie (domyślnie `ws://192.168.1.100:8080/ws`)
- Obsługiwać komunikaty JSON (parse + build)
- Cyklicznie wysyłać `measurement_update` (co ~1s) z bieżącymi odczytami
- Odpowiadać na `config_request` komunikatem `config_data`

### Sprzęt
- **Regulator AR200.B** — sterowanie temperaturą pieca (PID)
- **4x MFC MKS** — przepływomierze masowe z komunikacją MODBUS Ethernet
- **DAQ** — akwizycja danych z termopar i czujników
- **Moduł impedancji** (opcjonalnie) — spektroskopia impedancyjna

## Sekwencja połączenia

```
Dashboard                          LabVIEW
    │                                  │
    ├─── WebSocket connect ──────────►│
    │                                  │
    ├─── {"type":"hello"} ───────────►│  Identyfikacja klienta
    ├─── {"type":"config_request"} ──►│  Żądanie konfiguracji
    │                                  │
    │◄── {"type":"config_data"} ──────┤  Konfiguracja MFC, users, wsUrl
    │                                  │
    │◄── {"type":"measurement_update"}┤  Co ~1s: PV1, PV2, SP1, MV, MFC[]
    │◄── {"type":"measurement_update"}┤
    │◄── {"type":"status_update"} ────┤  Okresowo: status regulacji, PID
    │    ...                           │
    │                                  │
    ├─── {"type":"setpoint_command"} ►│  Użytkownik zmienia SP
    │                                  │
    │◄── {"type":"alarm_event"} ──────┤  Alarm z LabVIEW
    │                                  │
```

## Protokół komunikacji

Pełna dokumentacja: **[docs/ws_protocol.md](ws_protocol.md)**

### Podsumowanie

**14 typów TX (Dashboard → LabVIEW):**

| Typ | Opis | Źródło |
|-----|------|--------|
| `hello` | Identyfikacja klienta | Automatycznie |
| `config_request` | Żądanie konfiguracji | Automatycznie |
| `setpoint_command` | Zmiana SP1/SP2/SP3 | P2 |
| `mode_command` | MAN/AUTO, START/STOP | P2 |
| `manual_mv` | Moc ręczna (0-100%) | P2 |
| `pid_command` | Parametry PID | P2 |
| `alarm_clear` | Kasowanie LATCH | P2 |
| `profile_command` | Start/Stop profilu z segmentami + przepływami MFC | P2 |
| `sample_info` | Dane próbki | P3 |
| `report_create` | Nowy raport | P7 |
| `report_update` | Edycja raportu | P7 |
| `mfc_config` | Konfiguracja 4 MFC | P4 |
| `mfc_setpoint` | Nastawa MFC (per device) | P4 |
| `impedance_request` | Pomiar impedancji | P8 |

**7 typów RX (LabVIEW → Dashboard):**

| Typ | Opis | Częstotliwość |
|-----|------|---------------|
| `measurement_update` | PV1, PV2, SP1, MV, MFC[] | Co ~1s |
| `status_update` | Status regulacji, PID, profil | Okresowo |
| `alarm_event` | Zdarzenie alarmu | Na zdarzenie |
| `state_snapshot` | Pełny snapshot stanu | Na reconnect |
| `profile_status` | Postęp profilu [PLANNED] | Okresowo |
| `impedance_data` | Dane z pomiaru impedancji | Na żądanie |
| `config_data` | Konfiguracja systemu | Na config_request |

### Format envelope (wszystkie wiadomości TX)

```json
{
  "type": "<command_type>",
  "ts": "2026-02-10T14:30:00.000Z",
  "user": { "username": "operator", "role": "user", "name": "Operator" },
  "data": { ... }
}
```

## Tryb DEMO (offline)

Gdy brak połączenia WebSocket, dashboard automatycznie uruchamia **symulację PID**:
- Generuje realistyczne dane temperatury z regulacją PID
- Symuluje dryft MFC wokół nastaw (dla enabled MFC)
- Dane zapisywane do InfluxDB ze znacznikiem `_source: "demo"`
- UI działa identycznie — wykresy, alarmy, sterowanie lokalne
- Dioda **WS** w nagłówku gaśnie, reconnekcja z backoff 1–15s

## Integracja MFC (MODBUS Ethernet)

Dashboard konfiguruje 4 przepływomierze MKS:

| MFC | Domyślny gaz | IP | Port | Max flow |
|-----|-------------|-----|------|----------|
| MFC-1 | N₂ | 192.168.1.101 | 502 | 500 sccm |
| MFC-2 | Ar | 192.168.1.102 | 502 | 200 sccm |
| MFC-3 | O₂ | 192.168.1.103 | 502 | 100 sccm |
| MFC-4 | H₂S | 192.168.1.104 | 502 | 50 sccm |

**Komunikacja:**
- `mfc_config` → wysyła całą konfigurację 4 MFC do LabVIEW
- `mfc_setpoint` → wysyła nastaw per MFC (id + sp)
- `measurement_update` → LabVIEW odsyła aktualny PV/SP/enabled per MFC
- Profil segmentowy → każdy segment ma pole `flow: [mfc1, mfc2, mfc3, mfc4]`

LabVIEW zarządza komunikacją MODBUS z MFC — dashboard wysyła tylko nastawy JSON.

## Integracja impedancji

Moduł impedancji (P8) działa przez **iframe** (`/impedance.html`):
- iframe wysyła żądanie przez `postMessage` → App.jsx przekazuje przez WS jako `impedance_request`
- LabVIEW odpowiada `impedance_data` → App.jsx przekazuje do iframe przez `postMessage`
- Dane: tablice `frequencies`, `z_real`, `z_imag`, `phase`

## Zapis danych (InfluxDB)

Każdy `measurement_update` (z WS lub demo) jest zapisywany do InfluxDB v2:
- Moduł: `src/influx.js`
- Batching: 10 punktów lub co 5 sekund
- Fail-silent — brak InfluxDB nie blokuje dashboardu
- Konfiguracja: patrz **[docs/INFLUXDB_SETUP.md](INFLUXDB_SETUP.md)**

## Wskazówki implementacji po stronie LabVIEW

### 1. WebSocket Server
- Użyj biblioteki **WebView2** lub dedykowanego serwera WS w LabVIEW
- Nasłuchuj na porcie konfigurowalnym (domyślnie 8080)
- Obsługuj wiele klientów jednocześnie (dashboard może mieć kilka okien)

### 2. Parsowanie JSON
- Używaj `Flatten to JSON` / `Unflatten from JSON` w LabVIEW
- Pole `type` w każdym komunikacie identyfikuje komendę
- Pole `ts` (ISO 8601) służy do logowania/debugowania

### 3. Cykliczne wysyłanie danych
- Timer ~1s → zbierz PV1, PV2, SP1, MV, MFC → wyślij `measurement_update`
- Stan MFC: PV z MODBUS read, SP z ostatniego setpointu

### 4. Obsługa komend
- Dispatcher: switch na `type` → odpowiedni SubVI
- `setpoint_command` → zapisz do regulatora AR200.B
- `mode_command` → przełącz tryb PID / manual
- `profile_command.start` → uruchom sekwencer segmentowy
- `mfc_setpoint` → MODBUS write do odpowiedniego MFC

### 5. Alarmy
- Monitoruj progi PV1 HI/LO → wyślij `alarm_event` z `sev` i `msg`
- Obsłuż `alarm_clear` z dashboardu → skasuj LATCH

### 6. Reconnect
- Po utracie połączenia dashboard wysyła ponownie `hello` + `config_request`
- Wyślij `state_snapshot` z pełnym stanem w odpowiedzi (opcjonalnie)

## Pliki projektu

| Plik | Opis |
|------|------|
| `src/App.jsx` | Główna aplikacja React (monolityczna) |
| `src/influx.js` | Klient InfluxDB (zapis + odczyt) |
| `public/help.json` | Dane FAQ (PL/EN) pobierane przez fetch API |
| `public/impedance.html` | Moduł impedancji (iframe) |
| `docker-compose.yml` | InfluxDB v2 w Docker |
| `docs/ws_protocol.md` | Pełna specyfikacja protokołu WS JSON |
| `docs/INFLUXDB_SETUP.md` | Instalacja i konfiguracja InfluxDB |
| `docs/LABVIEW_INTEGRATION.md` | Ten dokument |
