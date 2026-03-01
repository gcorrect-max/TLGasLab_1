# RUN: Dashboard + LabVIEW przez WebView (Edge WebView2)

Data: 2026-02-09

Poniżej masz **praktyczną instrukcję** uruchomienia dashboardu w scenariuszu:
- UI działa jako strona web (dev albo build),
- LabVIEW uruchamia UI w kontrolce **WebView2**,
- komunikacja UI ↔ LabVIEW odbywa się po **WebSocket** (zalecane) lub przez lokalne REST (opcjonalnie).

---

## 1) Tryby pracy UI

### A) Dev (najszybciej na start)
1. W katalogu projektu:
   - `npm install`
   - `npm run dev`
2. Otwórz w przeglądarce adres (np. `http://localhost:3000/`).
3. W LabVIEW w WebView2 ustaw ten sam URL.

**Plusy:** szybkie zmiany w UI.  
**Minusy:** wymaga Node podczas uruchomienia.

### B) Build (zalecane do laboratorium)
1. `npm run build`
2. Serwuj statyczny katalog `dist/`:
   - prosty serwer (nginx, Caddy, python `http.server`, itp.)
3. W LabVIEW WebView2 ustaw URL do tego serwera (np. `http://127.0.0.1:8080/`).

---

## 2) Komunikacja: WebSocket (zalecane)

### Adres WS
UI ma pole `wsUrl` (domyślnie z konfiguracji). Przykład:
- `ws://127.0.0.1:8081/ws`

### Wiadomości
- **LabVIEW → Web:** `labview_to_web.json`
- **Web → LabVIEW:** `web_to_labview.json`

**Minimalny kontrakt (praktyczny):**
- LabVIEW publikuje `measurement_update` co 200–1000 ms.
- UI wysyła:
  - `setpoint_command` przy zmianie SP,
  - `mode_command` przy START/STOP i AUTO/MAN,
  - `manual_mv` przy suwaku MV,
  - `pid_command` przy zmianie PID,
  - `profile_command` przy START/STOP profilu,
  - `sample_info` przy zapisie próbki,
  - `config_update` przy zapisie konfiguracji.

---

## 3) Lista VI do uruchomienia (wariant rekomendowany)

Poniżej podaję **zestaw VI** jako szkielet integracji. Nazwy są propozycją (możesz dopasować do swojego repo),
ale odpowiadają konkretnym funkcjom, które UI wymaga.

### 3.1 VI startowy (wymagane)
1. **WebUI_Main.vi**
   - Start aplikacji.
   - Inicjalizacja konfiguracji i stanów.
   - Uruchomienie serwera WS/HTTP.
   - Uruchomienie WebView2 z URL dashboardu.
   - Pętla główna / shutdown.

2. **WebUI_Init.vi**
   - Ładowanie plików konfig (JSON/INI).
   - Inicjalizacja struktur: `SystemState`, `PIDState`, `ProfileState`, `AlarmState`.
   - Inicjalizacja loggera.

### 3.2 Serwer komunikacji (wymagane)
3. **WebUI_WS_Server.vi**
   - Serwer WebSocket (listen + accept).
   - Utrzymanie listy klientów.
   - Odbiór wiadomości (Web→LabVIEW) i przekazanie do parsera.

4. **WebUI_Parse_Web2LV_JSON.vi**
   - Parsuje wiadomości JSON z UI (`*_command`).
   - Mapuje na akcje: ustaw SP, PID, tryb, profil, config, sample.

5. **WebUI_Build_LV2Web_JSON.vi**
   - Buduje telemetrię JSON (LabVIEW→Web).
   - Uzupełnia: PV/SP/MV, wyjścia, statusy, alarmy, program profilu.
   - (Opcjonalnie) wysyła `ack` po komendach.

6. **WebUI_WS_Broadcast.vi**
   - Publikuje telemetrię do wszystkich klientów WS w ustalonym interwale.

### 3.3 Pętle pomiarowe/sterujące (zależne od sprzętu)
7. **Ctrl_ReadSensors.vi**
   - Odczyt PV1 (temp), PV2 (flow), inne.
   - Filtry / sanity-check.

8. **Ctrl_PID_Loop.vi**
   - PID + tryb MANUAL.
   - Aktualizacja MV, ograniczenia, histereza.
   - Sterowanie wyjściami (out1/out2).

9. **Ctrl_Profile_Engine.vi**
   - Obsługa etapów profilu (ramp/hold).
   - Aktualizuje `progStatus`, `progStage`, `progElapsed`, bieżący SP.

10. **Ctrl_Alarm_Manager.vi**
   - Detekcja HI/LO/STB/LATCH.
   - Generuje zdarzenia alarmowe (opcjonalnie osobnym kanałem).

### 3.4 Logowanie i dane (opcjonalne)
11. **Data_LogWriter.vi**
   - Zapis telemetrii do CSV/TDMS/DB.

12. **Data_SampleStore.vi**
   - Zapis `sample_info` do pliku JSON / bazy danych.

### 3.5 WebView2 (wymagane do „kiosku”)
13. **WebUI_OpenWebView.vi**
   - Otwiera okno z kontrolką WebView2.
   - Ładuje URL dashboardu.
   - (Opcjonalnie) implementuje „kiosk mode” (blokada nawigacji).

---

## 4) Uruchomienie krok po kroku (LabVIEW)

1. Zainstaluj **Microsoft Edge WebView2 Runtime** na komputerze.
2. Upewnij się, że UI jest dostępne pod URL:
   - dev: `http://localhost:3000/`
   - build: `http://127.0.0.1:8080/`
3. Uruchom `WebUI_Main.vi`.
4. `WebUI_WS_Server.vi` powinien nasłuchiwać na porcie WS (np. 8081).
5. W UI ustaw `wsUrl` (zakładka P4 → WebSocket) i kliknij „Połącz”.
6. Zweryfikuj:
   - P1: wykresy rosną (napływa `measurement_update`)
   - P2: zmiana SP generuje komendę i LabVIEW aktualizuje telemetrię
   - Alarmy: pojawiają się zdarzenia

---

## 5) Checklist testów integracyjnych

- [ ] UI połączone do WS, status „Connected”.
- [ ] Telemetria aktualizuje PV1/PV2/MV co ≤ 1s.
- [ ] `setpoint_command` zmienia SP w LabVIEW i wraca w telemetrii.
- [ ] MANUAL: suwak MV działa i wyłącza PID.
- [ ] START/STOP regulatora działa.
- [ ] START/STOP profilu działa, etap i czas rosną.
- [ ] Alarm HI/LO/STB/LATCH poprawnie się wyzwalają i resetują (LATCH tylko po komendzie resetu).

---

## 6) Najczęstsze problemy

1. **Brak aktualizacji w UI**  
   - sprawdź port WS, firewall, poprawność URL `ws://...`.

2. **WebView2 ładuje pustą stronę**  
   - sprawdź URL w przeglądarce,
   - upewnij się, że WebView2 Runtime jest zainstalowany.

3. **Komendy z UI nie działają**  
   - dodaj logowanie surowych ramek JSON po stronie LabVIEW (`WebUI_Parse_Web2LV_JSON.vi`).

---

Jeśli chcesz, w kolejnym kroku mogę dopisać gotowy, konkretny **mapping pól** 1:1 do Twojej struktury `mb` (z dashboardu) i Twoich VI (z Remote Solar Lab).
