# Implementacja strony LabVIEW — ThinFilmLab WebSocket Bridge

## Spis treści

1. [Architektura ogólna](#1-architektura-ogólna)
2. [Lista VI — przegląd](#2-lista-vi--przegląd)
3. [WebUI_Main.vi — główny VI](#3-webui_mainvi--główny-vi)
4. [WebUI_WS_Server.vi — serwer WebSocket](#4-webui_ws_servervi--serwer-websocket)
5. [Obsługa handshake (hello)](#5-obsługa-handshake-hello)
6. [Odbiór komend Web→LV — parser i dispatcher](#6-odbiór-komend-weblv--parser-i-dispatcher)
7. [Budowanie i wysyłanie telemetrii LV→Web](#7-budowanie-i-wysyłanie-telemetrii-lvweb)
8. [Pętla pomiarowa i PID](#8-pętla-pomiarowa-i-pid)
9. [Komunikacja z MFC MKS przez MODBUS Ethernet](#9-komunikacja-z-mfc-mks-przez-modbus-ethernet)
10. [Profil segmentowy (program temperaturowy)](#10-profil-segmentowy-program-temperaturowy)
11. [Alarmy](#11-alarmy)
12. [Logowanie danych](#12-logowanie-danych)
13. [WebView2 (tryb kiosk)](#13-webview2-tryb-kiosk)
14. [Shutdown i cleanup](#14-shutdown-i-cleanup)
15. [Diagram przepływu danych](#15-diagram-przepływu-danych)
16. [Checklist implementacji](#16-checklist-implementacji)

---

## 1. Architektura ogólna

```
┌──────────────────────────────────────────────────────────────────┐
│                        WebUI_Main.vi                             │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ WS Server   │  │ Ctrl Loop   │  │ Publish Loop            │  │
│  │ (port 8080) │  │ (PID + DAQ) │  │ (JSON → broadcast)      │  │
│  │             │  │             │  │                         │  │
│  │ accept      │  │ read PV     │  │ build measurement_update│  │
│  │ recv JSON   │  │ compute MV  │  │ build status_update     │  │
│  │ parse cmd   │  │ write OUT   │  │ send to all clients     │  │
│  │ dispatch    │  │ check alarm │  │                         │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                      │                │
│         └──── Shared State (FGV / DVR) ─────────┘                │
│                                                                  │
│  ┌──────────────────┐  ┌───────────────┐  ┌──────────────────┐  │
│  │ Profile Engine    │  │ Alarm Manager │  │ Data Logger      │  │
│  │ (ramp/hold/next)  │  │ (HI/LO/LATCH)│  │ (CSV/TDMS)       │  │
│  └──────────────────┘  └───────────────┘  └──────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

**Zasada:** Trzy główne pętle równoległe komunikują się przez współdzielony stan (Functional Global Variable, Data Value Reference lub Notifier/Queue).

---

## 2. Lista VI — przegląd

### Wymagane (MVP)

| # | VI                            | Rola                                              |
|---|-------------------------------|----------------------------------------------------|
| 1 | `WebUI_Main.vi`               | Punkt startowy, uruchomienie pętli, shutdown        |
| 2 | `WebUI_Init.vi`               | Ładowanie config, inicjalizacja stanów              |
| 3 | `WebUI_WS_Server.vi`          | Serwer WebSocket — listen, accept, recv             |
| 4 | `WebUI_Parse_Web2LV.vi`       | Parsowanie JSON komend z dashboardu                 |
| 5 | `WebUI_Dispatch_Command.vi`   | Router komend → akcje (case structure)              |
| 6 | `WebUI_Build_LV2Web.vi`       | Budowanie JSON telemetrii                           |
| 7 | `WebUI_WS_Broadcast.vi`       | Wysyłka JSON do wszystkich klientów WS              |
| 8 | `Ctrl_ReadSensors.vi`         | Odczyt PV z DAQ/regulatora                          |
| 9 | `Ctrl_PID_Loop.vi`            | Algorytm PID + tryb MANUAL                         |
| 10| `Ctrl_Profile_Engine.vi`      | Obsługa profilu segmentowego                        |
| 11| `Ctrl_Alarm_Manager.vi`       | Detekcja i obsługa alarmów                          |
| 12| `WebUI_Shutdown.vi`           | Bezpieczne zamknięcie                               |

### Opcjonalne

| # | VI                            | Rola                                              |
|---|-------------------------------|----------------------------------------------------|
| 13| `Data_LogWriter.vi`           | Zapis telemetrii do CSV/TDMS                        |
| 14| `Data_SampleStore.vi`         | Zapis `sample_info` do pliku/bazy                   |
| 15| `WebUI_OpenWebView.vi`        | WebView2 w trybie kiosk                             |

---

## 3. WebUI_Main.vi — główny VI

### Cel

Punkt startowy aplikacji. Uruchamia wszystkie pętle i zarządza cyklem życia.

### Block Diagram — szkic

```
┌─ Sequence Frame 1: INIT ──────────────────────────────────────────┐
│                                                                    │
│  WebUI_Init.vi                                                     │
│    → załaduj config (JSON/INI)                                     │
│    → zainicjalizuj SharedState (FGV: Write)                        │
│    → zainicjalizuj Queue<String> (cmdQueue)                        │
│    → zainicjalizuj Notifier (stopNotifier)                         │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
                              │
┌─ Parallel Loops (4 pętle) ─┼───────────────────────────────────────┐
│                             │                                       │
│  ┌─ Loop A: WS Server ─────┤                                       │
│  │  WebUI_WS_Server.vi      │  port 8080, accept, recv             │
│  │  → parse → enqueue cmd   │  (cmdQueue)                          │
│  └──────────────────────────┤                                       │
│                             │                                       │
│  ┌─ Loop B: Command Proc ───┤                                       │
│  │  Dequeue Element          │                                       │
│  │  WebUI_Parse_Web2LV.vi   │                                       │
│  │  WebUI_Dispatch_Command.vi│  → modyfikuj SharedState             │
│  └──────────────────────────┤                                       │
│                             │                                       │
│  ┌─ Loop C: Control ────────┤                                       │
│  │  Ctrl_ReadSensors.vi     │  (co 100-500 ms)                     │
│  │  Ctrl_PID_Loop.vi        │                                       │
│  │  Ctrl_Profile_Engine.vi  │                                       │
│  │  Ctrl_Alarm_Manager.vi   │                                       │
│  │  → zapisz do SharedState │                                       │
│  └──────────────────────────┤                                       │
│                             │                                       │
│  ┌─ Loop D: Publish ────────┤                                       │
│  │  WebUI_Build_LV2Web.vi   │  (co 200-1000 ms)                    │
│  │  WebUI_WS_Broadcast.vi   │  → wyślij JSON do klientów           │
│  └──────────────────────────┘                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
┌─ Sequence Frame 3: SHUTDOWN ───────────────────────────────────────┐
│  WebUI_Shutdown.vi                                                  │
│    → zatrzymaj pętle (stopNotifier)                                 │
│    → zamknij WS connections                                         │
│    → zamknij WebView2                                               │
│    → zwolnij zasoby                                                 │
└────────────────────────────────────────────────────────────────────┘
```

### Wejścia

| Kontrolka       | Typ    | Domyślnie                  | Opis                   |
|-----------------|--------|----------------------------|------------------------|
| `WS Port`       | U16    | 8080                       | Port serwera WS        |
| `Publish Rate ms`| U32   | 500                        | Interwał telemetrii    |
| `Control Rate ms`| U32   | 200                        | Interwał pętli PID     |
| `Config Path`   | Path   | "config.json"              | Plik konfiguracyjny    |

### Wyjścia

| Wskaźnik      | Typ    | Opis                       |
|---------------|--------|----------------------------|
| `Status`      | String | Aktualny status aplikacji  |
| `Error Out`   | Error  | Klaster błędów             |

---

## 4. WebUI_WS_Server.vi — serwer WebSocket

### Cel

Nasłuchuje na porcie, akceptuje połączenia klientów, odbiera wiadomości JSON i przekazuje do przetworzenia.

### Biblioteka

Zalecana: **JKI WebSocket Server** (dostępny na VIPM) lub **NI WebSocket API** (NI LabVIEW 2020+).

### Szkic implementacji

```
┌─ Pętla nasłuchiwania ─────────────────────────────────────────────┐
│                                                                    │
│  WS_Server_Create.vi (port 8080)                                   │
│    │                                                               │
│    ▼                                                               │
│  While Loop:                                                       │
│    │                                                               │
│    ├─ WS_Accept_Connection.vi (timeout 100ms)                      │
│    │   → jeśli nowy klient: dodaj do listy clientRefs[]            │
│    │                                                               │
│    ├─ For Each clientRef:                                          │
│    │   ├─ WS_Read.vi (timeout 10ms, non-blocking)                 │
│    │   │   → jeśli dane: enqueue do cmdQueue                      │
│    │   │   → jeśli disconnect: usuń z clientRefs[]                │
│    │   └───                                                        │
│    │                                                               │
│    ├─ Check stopNotifier (timeout 0)                               │
│    │   → jeśli stop: break                                         │
│    │                                                               │
│    └─ Wait (10ms)                                                  │
│                                                                    │
│  WS_Server_Close.vi                                                │
└────────────────────────────────────────────────────────────────────┘
```

### Zarządzanie klientami

```
clientRefs[] = Array of WS Connection Refnum

Na accept:  → Append to array
Na disconnect: → Delete from array
Na broadcast:  → For Each → WS_Write.vi
```

### Struktura danych wewnętrznych

```labview
Cluster "WSClient":
  - refnum: WS Connection Refnum
  - connectedAt: Timestamp
  - remoteAddr: String
  - username: String (z hello, domyślnie "?")
```

---

## 5. Obsługa handshake (hello)

Po akceptowaniu nowego klienta, pierwsza wiadomość powinna być `hello`.

### Parsowanie hello

```
Odczytaj JSON → sprawdź type == "hello"
  → zapisz user.username do WSClient.username
  → (opcjonalnie) wyślij state_snapshot jako odpowiedź
```

### Odpowiedź na hello (zalecane)

Po `hello` serwer powinien wysłać `state_snapshot` z aktualnym stanem:

```json
{
  "type": "state_snapshot",
  "ts": "<ISO timestamp>",
  "data": {
    "pv1": 156.3,
    "pv2": 45.2,
    "sp1": 160.0,
    "mv": 67.4,
    "manualMode": false,
    "regStatus": "RUN",
    "progStatus": "STOP",
    "progStage": 0,
    "alarmSTB": false,
    "alarmLATCH": false,
    "out1": true,
    "out2": false,
    "outAnalog": 12.8
  }
}
```

To zapewnia natychmiastową synchronizację UI po połączeniu.

---

## 6. Odbiór komend Web→LV — parser i dispatcher

### WebUI_Parse_Web2LV.vi

**Wejście:** `jsonString` (String)

**Wyjścia:**
- `type` (String) — typ komendy
- `data` (Variant lub String) — payload
- `user` (String) — username nadawcy
- `ts` (String) — timestamp

**Implementacja:**

```
Unflatten From JSON String → Cluster {type, ts, user, data}

Gdzie:
  type = pole "type" (string)
  data = pole "data" (unflatten jako Variant lub zachowaj jako String JSON)
  user = pole "user.username" (string, opcjonalne)
```

> **Biblioteka JSON:** Zalecana `JSONtext` (VIPM) — obsługuje zagnieżdżone obiekty, tablice, mixed types.

### WebUI_Dispatch_Command.vi

**Wejścia:**
- `type` (String)
- `data` (Variant/String)

**Implementacja — Case Structure po `type`:**

```
Case "setpoint_command":
  → odczytaj data.sp1 / data.sp2 / data.sp3
  → SharedState.Write("sp1", wartość)
  → log: "SP1 → 180°C by operator"

Case "mode_command":
  → odczytaj data.manualMode / data.regStatus
  → SharedState.Write("manualMode", wartość)
  → SharedState.Write("regStatus", wartość)
  → jeśli STOP → resetuj pidI, pidPrevE
  → log: "REG STOP by admin"

Case "manual_mv":
  → odczytaj data.mvManual
  → SharedState.Write("mvManual", wartość)
  → log: "MV → 55% by operator"

Case "pid_command":
  → odczytaj data.pidPb, data.pidTi, data.pidTd
  → SharedState.Write("pidPb", wartość)
  → SharedState.Write("pidTi", wartość)
  → SharedState.Write("pidTd", wartość)
  → log: "PID Pb=4.2 Ti=95 Td=24"

Case "alarm_clear":
  → SharedState.Write("alarmLATCH", FALSE)
  → SharedState.Write("alarmSTB", FALSE)
  → log: "LATCH cleared by admin"

Case "profile_command":
  → odczytaj data.action ("start" / "stop")
  → jeśli "start":
    → odczytaj data.segments (array of clusters)
    → SharedState.Write("profileSegments", segments)
    → SharedState.Write("progStatus", "RUN")
    → SharedState.Write("progStage", 1)
    → SharedState.Write("progElapsed", 0)
    → SharedState.Write("sp1", segments[0].sp)
  → jeśli "stop":
    → SharedState.Write("progStatus", "STOP")
    → SharedState.Write("progStage", 0)
  → log: "Profile START/STOP"

Case "sample_info":
  → odczytaj wszystkie pola data.*
  → zapisz do pliku / bazy (Data_SampleStore.vi)
  → log: "Sample ZnO-001 saved"

Case "report_create":
  → odczytaj data.* (tytuł, data, zdjęcia base64...)
  → zapisz raport do pliku JSON / bazy
  → log: "Report created"

Case "report_update":
  → analogicznie do report_create, nadpisz po data.id

Case "config_update":
  → odczytaj data.wsUrl, data.modbusAddr, data.baudRate, ...
  → SharedState.Write(klucz, wartość) dla każdego pola
  → opcjonalnie: zapisz do config.json
  → log: "Config updated"

Default:
  → log warning: "Unknown command type: <type>"
```

---

## 7. Budowanie i wysyłanie telemetrii LV→Web

### WebUI_Build_LV2Web.vi

**Wejście:** SharedState (odczyt)

**Wyjście:** `jsonString` (String)

### measurement_update (co 200–1000 ms)

```labview
Odczytaj z SharedState:
  pv1, pv2, ch3, sp1, mv, outAnalog, out1, manualMode

Zbuduj JSON:
{
  "type": "measurement_update",
  "ts": "<Format Date/Time ISO>",
  "data": {
    "pv1": <pv1>,
    "pv2": <pv2>,
    "ch3": <ch3>,
    "sp1": <sp1>,
    "mv": <mv>,
    "outAnalog": <outAnalog>,
    "out1": <out1>,
    "manualMode": <manualMode>
  }
}

Flatten To JSON String → wyślij
```

### status_update (przy zmianach stanu lub co N sekund)

```labview
Odczytaj z SharedState:
  regMode, regStatus, manualMode, progStatus, progStage,
  progElapsed, limitPower, pidPb, pidTi, pidTd

Zbuduj JSON:
{
  "type": "status_update",
  "ts": "<ISO>",
  "data": { ...powyższe pola... }
}
```

> **Optymalizacja:** Wysyłaj `status_update` tylko gdy któreś pole się zmieniło (porównanie z poprzednim stanem).

### alarm_event (na zdarzenie)

```labview
Gdy Ctrl_Alarm_Manager.vi wykryje nowy alarm:

{
  "type": "alarm_event",
  "ts": "<ISO>",
  "data": {
    "sev": "danger",
    "msg": "HI: PV1=220.5°C > SP+10°C",
    "latch": true
  }
}

Wyślij natychmiast (nie czekaj na interwał publish).
```

### state_snapshot (na żądanie / po reconnect)

```labview
Odczytaj WSZYSTKIE pola z SharedState.
Zbuduj JSON z type = "state_snapshot".
Wyślij do konkretnego klienta (nie broadcast).
```

### WebUI_WS_Broadcast.vi

```labview
Wejście: jsonString, clientRefs[]

For Each clientRef:
  WS_Write.vi(clientRef, jsonString)
  Jeśli error → oznacz klienta do usunięcia
```

---

## 8. Pętla pomiarowa i PID

### Ctrl_ReadSensors.vi

**Cel:** Odczyt wartości procesowych z hardware.

```labview
Wejścia: referencje DAQ / Modbus

Odczytaj:
  PV1 ← Termopara TC-K (np. DAQ AI0 lub AR200.B register 1)
  PV2 ← Przepływomierz (DAQ AI1 lub register 2)

Filtrowanie:
  - Średnia krocząca (N=5) lub filtr dolnoprzepustowy
  - Sanity check: PV1 ∈ [-50, 600]°C, PV2 ∈ [0, 200] l/min

Wyjścia → SharedState:
  pv1, pv2
```

### Ctrl_PID_Loop.vi

**Cel:** Algorytm regulacji PID z trybem MANUAL.

```labview
Odczytaj z SharedState:
  pv1, sp1, manualMode, mvManual,
  regStatus, pidPb, pidTi, pidTd, limitPower,
  pidI (akumulator całki), pidPrevE (poprzedni błąd)

If regStatus == "STOP":
  mv = 0
  pidI = 0
  pidPrevE = 0

Else If manualMode == TRUE:
  mv = mvManual               // bezpośrednie sterowanie

Else:  // tryb AUTO (PID)
  e = sp1 - pv1               // błąd
  P = e / pidPb                // człon proporcjonalny
  pidI += (e × dt) / pidTi     // człon całkujący
  pidI = clamp(pidI, -50, 50)  // anti-windup
  D = pidTd × (e - pidPrevE) / dt  // człon różniczkujący

  mv = clamp((P + pidI + D) × K, 0, limitPower)
  pidPrevE = e

Zapisz do SharedState:
  mv, pidI, pidPrevE

Sterowanie wyjściami:
  out1 = (mv > 3)              // grzanie ON/OFF (SSR)
  outAnalog = 4 + (pv1/500) × 16  // przeliczenie 4-20mA

Zapisz do SharedState:
  out1, out2, outAnalog
```

### Parametry dt

```
dt = rzeczywisty czas od ostatniej iteracji [s]
     (użyj Tick Count lub High Resolution Timer)
K  = współczynnik skalowania (dostosuj do procesu, np. 20)
```

---

## 9. Komunikacja z MFC MKS przez MODBUS Ethernet

### Architektura

Dashboard obsługuje 4 przepływomierze MFC MKS podłączone przez MODBUS TCP/IP (Ethernet). Każdy MFC ma indywidualny adres IP i adres slave.

### Typowa mapa rejestrów MODBUS dla MKS MFC

| Rejestr | Typ | Opis |
|---------|-----|------|
| 40001 (0x0000) | Holding | Process Variable (PV) — aktualny przepływ |
| 40002 (0x0001) | Holding | Setpoint (SP) — zadany przepływ |
| 40003 (0x0002) | Holding | Valve position — pozycja zaworu |
| 40005 (0x0004) | Holding | Gas correction factor |
| 40010 (0x0009) | Holding | Full scale range |
| 40101 (0x0064) | Holding | Device status / error code |

> **Uwaga:** Dokładna mapa rejestrów zależy od modelu MFC MKS. Należy zweryfikować z dokumentacją konkretnego urządzenia.

### VI: MFC_Init.vi

Inicjalizacja połączeń MODBUS TCP do 4 przepływomierzy.

**Wejścia:**
- `MFC Config` (cluster array [4]): IP, port, slaveAddr, maxFlow, unit, enabled

**Wyjścia:**
- `TCP Connections` (array [4] of refnum): Otwarte połączenia TCP
- `Error Out`

**Działanie:**
1. Iteruj po 4 konfiguracjach MFC
2. Dla każdego enabled=true → TCP Open Connection (IP, port)
3. Zapisz refnum do tablicy
4. Dla enabled=false → refnum = 0 (nie łącz)

### VI: MFC_ReadFlow.vi

Odczyt aktualnego przepływu z jednego MFC.

**Wejścia:**
- `TCP Connection` (refnum)
- `Slave Address` (U8)
- `Register Address` (U16, domyślnie 0x0000)

**Wyjścia:**
- `Flow PV` (DBL) — aktualny przepływ
- `Error Out`

**Działanie:**
1. MODBUS TCP Frame: Transaction ID (2B) + Protocol ID (2B, 0x0000) + Length (2B) + Unit ID (1B) + Function Code 0x03 (Read Holding Registers) + Start Register (2B) + Qty (2B, 1)
2. TCP Write → TCP Read (odpowiedź)
3. Parse: wyciągnij 2 bajty danych → skaluj do jednostki przepływu
4. Jeśli odpowiedź zawiera exception code → raportuj błąd

### VI: MFC_WriteSetpoint.vi

Zapis setpointu do jednego MFC.

**Wejścia:**
- `TCP Connection` (refnum)
- `Slave Address` (U8)
- `Setpoint` (DBL)
- `Register Address` (U16, domyślnie 0x0001)

**Wyjścia:**
- `Error Out`

**Działanie:**
1. Skaluj setpoint do wartości rejestrowej (0–65535 odpowiada 0–maxFlow)
2. MODBUS TCP Frame: Function Code 0x06 (Write Single Register) + Register (2B) + Value (2B)
3. TCP Write → TCP Read (potwierdzenie echo)
4. Weryfikuj echo odpowiedzi

### Integracja w pętli głównej

W pętli Control Loop (co 500ms):

```
For Each MFC (i = 0..3):
  If MFC[i].enabled:
    PV = MFC_ReadFlow(conn[i], slaveAddr[i])
    FGV("mfc_pv", i, PV)

    If newSetpoint[i]:
      MFC_WriteSetpoint(conn[i], slaveAddr[i], SP[i])
```

W pętli Publish (co recInterval):
- Dodaj do `measurement_update.data.mfc` tablicę [{id, pv, sp, enabled}, ...]

### Obsługa komend z Dashboard

W Command Processor, nowe case'y:

- **`mfc_config`**: Aktualizuj FGV z konfiguracją 4 MFC. Zamknij stare połączenia TCP i otwórz nowe przez MFC_Init.vi.
- **`mfc_setpoint`**: Zapisz nowy SP dla danego MFC (identyfikuj po `data.id`). Wyślij przez MFC_WriteSetpoint.vi.

### Diagnostyka i bezpieczeństwo

- **Timeout TCP**: 2000ms na odpowiedź MODBUS. Po 3 timeout → oznacz MFC jako offline.
- **Limit przepływu**: Przed zapisem SP sprawdź czy wartość <= maxFlow.
- **Reconnect**: Jeśli TCP disconnect → auto-reconnect co 5s.
- **Logging**: Każda zmiana SP logowana do CSV z timestamp i user.

---

## 10. Profil segmentowy (program temperaturowy)

### Ctrl_Profile_Engine.vi

**Cel:** Obsługa wieloetapowego profilu temperatury (ramp → hold → next).

### Struktura segmentu

```labview
Cluster "Segment":
  - name: String       ("Rampa grzania")
  - sp: DBL            (docelowa temperatura °C)
  - ramp: DBL          (szybkość rampy °C/min, ujemna = chłodzenie)
  - hold: DBL          (czas utrzymania w minutach)
```

### Algorytm

```labview
Odczytaj z SharedState:
  progStatus, progStage, progElapsed,
  profileSegments[] (array of Segment)

If progStatus != "RUN" → return (nic nie rób)
If progStage < 1 OR progStage > Length(segments) → STOP, return

currentSeg = segments[progStage - 1]
prevSP = (progStage > 1) ? segments[progStage - 2].sp : 25.0  // temp. startowa

// Oblicz czas rampy
rampTime_s = |currentSeg.sp - prevSP| / |currentSeg.ramp| × 60  // min → s
holdTime_s = currentSeg.hold × 60

// Inkrementuj czas
progElapsed += dt  // dt w sekundach (np. 0.2s)

If progElapsed < rampTime_s:
  // Faza RAMP — interpolacja liniowa
  fraction = progElapsed / rampTime_s
  sp1 = prevSP + fraction × (currentSeg.sp - prevSP)

Else If progElapsed < rampTime_s + holdTime_s:
  // Faza HOLD — utrzymuj temperaturę
  sp1 = currentSeg.sp

Else:
  // Etap zakończony → przejdź do następnego
  If progStage < Length(segments):
    progStage += 1
    progElapsed = 0
  Else:
    // Koniec profilu
    progStatus = "STOP"
    progStage = 0
    progElapsed = 0

Zapisz do SharedState:
  sp1, progStage, progStatus, progElapsed
```

### Wysyłanie profile_status

Po każdej zmianie etapu wyślij:

```json
{
  "type": "profile_status",
  "ts": "<ISO>",
  "data": {
    "profileName": "Spiekanie ZnO",
    "stage": 2,
    "stageName": "Wygrzewanie",
    "progStatus": "RUN",
    "progElapsed": 120
  }
}
```

---

## 11. Alarmy

### Ctrl_Alarm_Manager.vi

**Cel:** Detekcja warunków alarmowych i generowanie zdarzeń.

### Warunki

```labview
Odczytaj z SharedState:
  pv1, sp1, hyst, alarmLATCH

// Alarm HI — temperatura zbyt wysoka
alarm_HI = (pv1 > sp1 + hyst × 5)

// Alarm LO — temperatura zbyt niska
alarm_LO = (pv1 < sp1 - hyst × 10)

// Standby — jakikolwiek alarm aktywny
alarmSTB = alarm_HI OR alarm_LO

// Latch — raz ustawiony, trzyma się do ręcznego kasowania
alarmLATCH = alarmLATCH OR alarmSTB

Zapisz do SharedState:
  alarm1 (= alarm_HI), alarm2 (= alarm_LO),
  alarmSTB, alarmLATCH
```

### Generowanie alarm_event

```labview
// Detekcja zbocza narastającego (poprzedni stan vs aktualny)
If alarm_HI AND NOT prev_alarm_HI:
  → Wyślij alarm_event:
    sev = "danger"
    msg = Format("HI: PV1=%.1f°C > SP+%.0f°C", pv1, hyst×5)
    latch = TRUE

If alarm_LO AND NOT prev_alarm_LO:
  → Wyślij alarm_event:
    sev = "warning"
    msg = Format("LO: PV1=%.1f°C < SP-%.0f°C", pv1, hyst×10)
    latch = FALSE

prev_alarm_HI = alarm_HI
prev_alarm_LO = alarm_LO
```

> **Ważne:** Alarm_event wysyłaj **natychmiast** (nie czekaj na interwał publish). Użyj osobnego wywołania `WebUI_WS_Broadcast.vi`.

---

## 12. Logowanie danych

### Data_LogWriter.vi

**Cel:** Ciągły zapis telemetrii do pliku.

### Format CSV

```
Timestamp,PV1_C,PV2_Lmin,SP1_C,MV_pct,OutAnalog_mA,RegStatus,ManualMode,ProgStage
2026-02-11T14:30:01.000,156.3,45.2,160.0,67.4,12.8,RUN,FALSE,2
2026-02-11T14:30:02.000,157.1,45.0,160.0,66.8,12.9,RUN,FALSE,2
```

### Format TDMS (alternatywa)

```labview
TDMS_Open → Group "Telemetry"
  Channel "PV1" (Waveform DBL)
  Channel "PV2" (Waveform DBL)
  Channel "SP1" (Waveform DBL)
  Channel "MV"  (Waveform DBL)
```

### Interwał zapisu

- Domyślnie: co 1–5 sekund (configurable via `recInterval`)
- W trybie "REC": zapis aktywny
- W trybie innym: pauza

### Data_SampleStore.vi

**Cel:** Zapis metadanych próbki po komendzie `sample_info`.

```labview
Odczytaj data.sampleId, data.material, data.substrate, ...
Zbuduj JSON string
Zapisz do pliku: samples/<sampleId>.json
Lub INSERT do bazy PostgreSQL/SQLite
```

---

## 13. WebView2 (tryb kiosk)

### WebUI_OpenWebView.vi

**Cel:** Otwarcie dashboardu w osadzonym WebView2 na Front Panel LabVIEW.

### Wymagania

- **WebView2 Runtime** zainstalowany na PC (Win10/11)
- **Wrapper VIPM:** `sklein_lib_webview2` (https://www.vipm.io/package/sklein_lib_webview2/)

### Szkic

```labview
1. WebView2_Create.vi → refnum
2. WebView2_Navigate.vi(refnum, "http://127.0.0.1:3000/")
3. (opcjonalnie) Zablokuj nawigację poza domeną localhost
4. Przy shutdown: WebView2_Close.vi(refnum)
```

### Alternatywa: zewnętrzna przeglądarka

```labview
System Exec.vi:
  cmd /c start "" "http://127.0.0.1:3000/"
```

---

## 14. Shutdown i cleanup

### WebUI_Shutdown.vi

```labview
1. Wyślij stopNotifier (Notification) → wszystkie pętle kończą While Loop

2. Zamknij WS:
   For Each clientRef:
     WS_Close.vi(clientRef)
   WS_Server_Close.vi(serverRef)

3. Zamknij WebView2 (jeśli używany)

4. Zatrzymaj HTTP server (jeśli uruchomiony z LabVIEW):
   System Exec.vi: "taskkill /IM node.exe /F" (lub po PID)

5. Zamknij pliki logów:
   TDMS_Close.vi / Close File

6. Zwolnij zasoby:
   Destroy Queue (cmdQueue)
   Destroy Notifier (stopNotifier)
```

---

## 15. Diagram przepływu danych

```
                    ┌───────────────────────┐
                    │     HARDWARE          │
                    │  AR200.B / DAQ / TC-K │
                    └───────────┬───────────┘
                                │ analog/digital/Modbus
                                ▼
                    ┌───────────────────────┐
                    │  Ctrl_ReadSensors.vi  │
                    │  PV1, PV2 → state     │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │   SharedState (FGV)   │◄──── Ctrl_Profile_Engine.vi
                    │                       │        (aktualizuje SP1)
                    │  pv1, pv2, sp1, mv,   │
                    │  regStatus, progStage, │◄──── Ctrl_PID_Loop.vi
                    │  alarms, config...    │        (oblicza MV, out1)
                    │                       │
                    │                       │◄──── Ctrl_Alarm_Manager.vi
                    │                       │        (aktualizuje alarmy)
                    └──┬──────────┬─────────┘
                       │          │
          ┌────────────▼──┐  ┌───▼────────────────┐
          │ Publish Loop  │  │ Command Dispatch    │
          │               │  │                     │
          │ Build JSON    │  │ Parse JSON from WS  │
          │ Broadcast     │  │ Modify SharedState  │
          └───────┬───────┘  └──────────▲──────────┘
                  │                     │
                  │    WebSocket        │
                  ▼    (port 8080)      │
          ┌───────────────────────────────────────┐
          │         WS Server Loop                │
          │  accept │ recv (→cmdQueue) │ send     │
          └───────────────────┬───────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  React Dashboard  │
                    │  (localhost:3000)  │
                    └───────────────────┘
```

---

## 16. Checklist implementacji

### Faza 1: Minimalna komunikacja (dzień 1–2)

- [ ] `SharedState` FGV z polami: pv1, pv2, sp1, mv, regStatus, manualMode
- [ ] `WebUI_WS_Server.vi` — accept 1 klient, recv JSON, parsuj type
- [ ] `WebUI_Build_LV2Web.vi` — measurement_update z danymi testowymi
- [ ] `WebUI_WS_Broadcast.vi` — wyślij do klienta
- [ ] Test: dashboard łączy się, widzi dane na wykresie

### Faza 2: Komendy (dzień 3–4)

- [ ] `WebUI_Parse_Web2LV.vi` — parsuj JSON komend
- [ ] `WebUI_Dispatch_Command.vi` — obsłuż: setpoint_command, mode_command, manual_mv
- [ ] Test: zmiana SP w dashboardzie → widoczna w LabVIEW → wraca w telemetrii

### Faza 3: PID + profil (dzień 5–7)

- [ ] `Ctrl_ReadSensors.vi` — podłączenie do rzeczywistego DAQ/regulatora
- [ ] `Ctrl_PID_Loop.vi` — algorytm PID
- [ ] `Ctrl_Profile_Engine.vi` — profil segmentowy
- [ ] `Ctrl_Alarm_Manager.vi` — detekcja HI/LO/LATCH
- [ ] Test: profil START → rampa → hold → next → STOP

### Faza 4: Pełna integracja (dzień 8–10)

- [ ] Obsługa wielu klientów WS
- [ ] Handshake hello + state_snapshot
- [ ] pid_command, alarm_clear, profile_command
- [ ] sample_info → zapis do pliku
- [ ] report_create/update
- [ ] Data_LogWriter.vi (CSV/TDMS)

### Faza 5: Deployment

- [ ] WebView2 w LabVIEW (opcjonalnie)
- [ ] Build → dist/ + serwer HTTP
- [ ] Config.json z parametrami produkcyjnymi
- [ ] Testy integracyjne (patrz `PROTOCOL_JSON_WS.md`)

---

## Uwagi implementacyjne

### SharedState — Functional Global Variable (FGV)

Zalecany wzorzec do współdzielenia danych między pętlami:

```labview
WebUI_SharedState.vi:
  Input: action (enum: Read, Write, Init)
  Input: field (string) — nazwa pola
  Input: value (variant) — wartość do zapisu
  Output: state (cluster) — pełny stan

  Implementacja:
    Uninitialized Shift Register z klastrem stanu.
    Case Structure po action:
      "Init"  → zapisz domyślne wartości
      "Write" → nadpisz pole w klastrze
      "Read"  → zwróć klaster
```

### Alternatywa: Data Value Reference (DVR)

Dla LabVIEW 2020+, DVR może być wydajniejszy:

```labview
DVR = New Data Value Reference(initialState)

In-Place Element Structure:
  → odczytaj / zapisz pole bezpiecznie (thread-safe)
```

### Biblioteki JSON

| Biblioteka  | VIPM               | Zalety                            |
|-------------|---------------------|-----------------------------------|
| JSONtext    | `jdp_science_jsontext` | Szybka, obsługuje zagnieżdżenia |
| JSON API    | (wbudowana NI 2020+)  | Oficjalna, bez dodatkowych paczek|
| jki-json    | `jki_lib_json`        | Prosta, popularna w community   |

### Formatowanie ISO 8601 w LabVIEW

```labview
Format Date/Time String:
  Time Format: "%Y-%m-%dT%H:%M:%S.000Z"
  → "2026-02-11T14:30:01.000Z"
```
