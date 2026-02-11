# LabVIEW ↔ Web Dashboard – Lista VI dla warstwy komunikacji

Ten dokument opisuje **zestaw VI (oraz sugerowane pod-VI)** potrzebnych do komunikacji pomiędzy:
- stroną web (React dashboard + `bridge.ts`)
- a kodem wykonywanym w LabVIEW (WebView / Embedded UI)

> Nazwy VI są propozycją „standardu projektu”. Możesz je dopasować do własnego repo / naming convention.

---

## 1) VI startowy / inicjalizacja

### **WebUI_Main.vi**
**Cel:** Główny VI, który uruchamia całą warstwę komunikacji i zarządza cyklem życia.

**Zadania:**
- Inicjalizacja komponentów komunikacji (User Event, WebView, pętle).
- Start pętli:
  - **CommandEventLoop** (UI → LabVIEW)
  - **PublishLoop** (LabVIEW → UI)
- Obsługa stop/cleanup (zamknięcie WebView, Destroy User Event, zatrzymanie pętli).
- Opcjonalnie: inicjalizacja „SystemStatus” (single source of truth) i rejestrów/stanu.

**Wejścia (przykład):**
- `WebURL` (np. `http://127.0.0.1:5173/` lub URL serwera hostującego `dist/`)
- `PublishRateHz` (np. 10–30 Hz)
- `StrictValidation` (opcjonalnie)

**Wyjścia (przykład):**
- `Status/Errors`
- `Refnum` (dla debug)

---

## 2) VI: utworzenie kanału UI → LabVIEW (User Event)

### **WebUI_CreateUserEvent.vi**
**Cel:** Utworzenie User Event, na który dashboard będzie wysyłał komendy przez `FireUserEvent`.

**Zadania:**
- `Create User Event` z typem danych: **string (JSON)**.
- Rejestracja do Event Structure (jeśli używasz `Register For Events`).

**Wyjścia:**
- `User Event Refnum` – przekazywany później do JS jako **refnum**.

**Uwagi:**
- Najprostszy format danych to JSON string `{"tag":"X","data":...}`.

---

## 3) VI: uruchomienie i załadowanie strony w WebView

### **WebUI_OpenWebView.vi**
**Cel:** Otwarcie WebView / Embedded UI i załadowanie strony dashboardu.

**Zadania:**
- Inicjalizacja kontrolki WebView (zależnie od użytej technologii).
- Załadowanie URL (dev server lub produkcyjny host `dist/`).
- Oczekiwanie na zdarzenie „page loaded” / „document ready”.

**Wyjścia:**
- Referencja/uchwyt do WebView (potrzebny do wykonywania JS).

---

## 4) VI: handshake (przekazanie refnum do strony)

### **WebUI_InjectHandshakeRefnum.vi**
**Cel:** Przekazanie do strony refnum, aby dashboard mógł wysyłać komendy do LabVIEW.

**Zadania:**
- Wykonanie w WebView JavaScript:
  ```js
  window.labviewBridge.setRefnum(<refnum>)
  ```

**Kiedy wywołać:**
- Dopiero po pełnym załadowaniu strony (inaczej `window.labviewBridge` może nie istnieć).

**Uwagi praktyczne:**
- Jeśli WebView ma zdarzenie `NavigationCompleted/DocumentComplete`, handshake rób w tym callbacku.

---

## 5) VI: pętla odbioru komend z Web (UI → LabVIEW)

### **WebUI_CommandEventLoop.vi**
**Cel:** Odbieranie komend z dashboardu i przekazywanie ich do logiki LabVIEW.

**Zadania:**
- Event Structure (lub while-loop + wait on event) oczekująca na `User Event` (JSON string).
- Parsowanie JSON do `{ tag, data }`.
- Dispatch do konkretnych akcji sterowania po `tag`.

**Proponowane pod-VI:**

#### **WebUI_ParseCommandJSON.vi**
**Cel:** Parsuje JSON string z UI.

**Wejście:**
- `jsonString`

**Wyjście:**
- `tag` (string)
- `data` (Variant / string / cluster – zależnie od biblioteki JSON)

#### **WebUI_DispatchCommand.vi**
**Cel:** Router komend sterujących.

**Zadania:**
- `case structure` po `tag`.
- Przykładowe przypadki:
  - `Motor_A_Speed_Setpoint` → ustaw setpoint regulatora
  - `Power_Main` → włącz/wyłącz zasilanie
  - `System_Command` → `RESET/START/STOP/...`

**Uwagi:**
- W praktyce warto logować każde polecenie z timestampem.
- Jeżeli masz RBAC/booking – tutaj weryfikujesz, czy „owner” ma prawo wysłać komendę.

---

## 6) VI: publikacja danych do Web (LabVIEW → UI)

### **WebUI_PublishLoop.vi**
**Cel:** Regularna publikacja aktualnych wartości pomiarowych do dashboardu.

**Zadania:**
- Pętla z ustaloną częstotliwością (np. 5–30 Hz).
- Odczyt aktualnych wartości ze źródeł (DAQ, sterowniki, obliczenia, SystemStatus).
- Budowa JSON update:
  `{"tag":"X","value":..., "timestamp": ...}`
- Wykonanie JS w WebView:
  ```js
  window.labviewBridge.updateState(JSON.stringify({...}))
  ```

**Proponowane pod-VI:**

#### **WebUI_BuildUpdateJSON.vi**
**Cel:** Buduje JSON z update’em (tag, value, timestamp).

**Wejście:**
- `tag`
- `value` (skalar, bool, string, array)
- `timestamp` (ms)

**Wyjście:**
- `jsonString`

#### **WebUI_InvokeUpdateStateJS.vi**
**Cel:** Wysyła update do dashboardu.

**Zadania:**
- `Execute JavaScript` z:
  ```js
  window.labviewBridge.updateState(<jsonString>)
  ```

**Uwagi wydajnościowe:**
- Dla szybkich sygnałów lepiej wysyłać **batch** (`number[]`) co np. 100–200 ms
  zamiast pojedynczych próbek w 100 Hz.

---

## 7) (Opcjonalnie) VI: format danych dla wykresów / batch

### **WebUI_PublishWaveformBatch.vi**
**Cel:** Publikacja sygnałów w postaci paczek próbek `number[]`.

**Zadania:**
- Buforowanie próbek (np. N=50).
- Wysyłka update:
  - tag: `Drone_RF_Signal` lub `Output_Power_Factor_Samples`
  - value: tablica `number[]`

**Po stronie web:**
- komponent wykresu może dopinać batch do ring-buffera (okno historii).

---

## 8) VI: shutdown / cleanup

### **WebUI_Shutdown.vi**
**Cel:** Bezpieczne zamknięcie warstwy komunikacji.

**Zadania:**
- Zatrzymanie pętli (CommandEventLoop / PublishLoop).
- `Destroy User Event`.
- Zamknięcie WebView.
- Wyczyść zasoby (kolejki, notyfikatory, rejestry, logi).

---

## Minimalny zestaw VI (MVP)

Jeśli chcesz absolutne minimum, które „zadziała”:

1. `WebUI_Main.vi`
2. `WebUI_CreateUserEvent.vi`
3. `WebUI_OpenWebView.vi`
4. `WebUI_InjectHandshakeRefnum.vi`
5. `WebUI_CommandEventLoop.vi`
6. `WebUI_PublishLoop.vi`
7. `WebUI_Shutdown.vi`

---

## Przykładowe tagi w tym projekcie

- `Motor_A_Speed` (LV → Web)
- `Drone_RF_Signal` (LV → Web, często `number[]`)
- `Power_Main` (Web → LV, boolean)
- `System_Command` (Web → LV, string)

---

## Dodatkowa rekomendacja (dla większych systemów)

W miarę rozwoju projektu warto utrzymywać „single source of truth”, np.:
- `SystemStatus.ctl` / `SystemStatus.lvclass`
- PublishLoop czyta status i publikuje go jako spójne tagi.
- CommandEventLoop modyfikuje status tylko przez kontrolowane „actions” (dispatcher).
