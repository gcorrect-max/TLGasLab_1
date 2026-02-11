# ThinFilmLab UI w LabVIEW (Win11, localhost) — Runbook (WebView2)

Ten dokument opisuje **kolejne kroki** uruchomienia Twojej strony (React/Vite + WebSocket) **wewnątrz aplikacji LabVIEW** na **Windows 11** z założeniem **localhost**.

> Rekomendacja: **WebView2 (Edge/Chromium)** zamiast standardowego Web Browser Control (IE).  
> Standardowy Web Browser Control w LabVIEW używa osadzonego silnika Internet Explorer, co zwykle nie wspiera nowoczesnego React/Vite.  
> Źródła: NI forum (IE w WebBrowser control), WebView2 runtime (Microsoft), WebView2 wrapper dla LabVIEW (VIPM).

---

## 0) Założenia i architektura

### Porty (przykład)
- UI (HTTP): `http://127.0.0.1:3000/`
- WebSocket (LV/proxy): `ws://127.0.0.1:8765/ws`

### Co uruchamiamy
1. **Serwer WebSocket** (po stronie LabVIEW / proxy) na localhost.
2. **Serwer HTTP** serwujący statyczne pliki UI (`dist/`) na localhost.
3. **LabVIEW Front Panel** z osadzonym **WebView2**, który nawiguję do `http://127.0.0.1:3000/`.

---

## 1) Wymagania (zanim zaczniesz)

### 1.1 System
- Windows 11
- Node.js LTS (do buildu i serwowania UI) — jeśli budujesz Vite
- (Opcjonalnie) Python 3.x — alternatywa do serwowania `dist/`

### 1.2 Microsoft Edge WebView2 Runtime
Na Win11 często jest już obecny, ale w środowiskach offline / “odchudzonych” może go brakować.

- Zainstaluj **Evergreen WebView2 Runtime** (Bootstrapper lub Standalone Installer).  
  Strona Microsoft: https://developer.microsoft.com/microsoft-edge/webview2/

> Wskazówka: docelowo na PC laboratoryjnym warto mieć **standalone installer** do instalacji offline.

### 1.3 LabVIEW + WebView2 wrapper
Najwygodniej: paczka VIPM “WebView2 by sklein”:
- https://www.vipm.io/package/sklein_lib_webview2/

Repo (opis, kompatybilność Win10/11 32/64-bit):
- https://github.com/kleinsimon/LV-WebView2

---

## 2) Przygotowanie UI (React/Vite) jako statyczny build

W katalogu projektu UI:

```bat
cd C:\sciezka\do\Twojego\UI
npm install
npm run build
```

Po buildzie dostajesz katalog:
- `dist\`  ← to jest to, co serwujemy w HTTP

### 2.1 Test w normalnej przeglądarce (zanim włożysz do LabVIEW)
Uruchom lokalny serwer HTTP:

**Opcja A: `serve`**
```bat
npx serve -s dist -l 3000
```

**Opcja B: Python**
```bat
python -m http.server 3000 --directory dist
```

Sprawdź w Chrome/Edge:
- `http://127.0.0.1:3000/`

Jeśli strona działa w normalnej przeglądarce, dopiero wtedy przechodź do LabVIEW.

---

## 3) WebSocket na localhost (po stronie LabVIEW)

Twoja strona łączy się do WS wg pola `WS URL` w konfiguracji (w UI). Ustaw:
- `ws://127.0.0.1:8765/ws`

### 3.1 Minimalne wymagania WS
- serwer WS musi akceptować połączenia z localhost
- wiadomości LV→WEB powinny być JSON (np. `measurement_update`, `status_update`, `alarm_event`, `state_snapshot`)
- UI wysyła TX JSON przez `sendCmd(...)` (np. `setpoint_command`, `profile_command`, itd.)

### 3.2 Test WS (szybki)
Zanim odpalisz w LabVIEW, możesz sprawdzić WS klientem np. `wscat`:

```bat
npm i -g wscat
wscat -c ws://127.0.0.1:8765/ws
```

Jeśli WS odpowiada/utrzymuje połączenie — OK.

---

## 4) LabVIEW — osadzenie WebView2 i nawigacja do UI

Poniżej opis jest “narzędziowy”, bo dokładne nazwy VIs zależą od wrappera (VIPM). Logika jest zawsze ta sama:

### 4.1 Instalacja paczki WebView2 (VIPM)
1. Zainstaluj **VI Package Manager (VIPM)**.
2. Wyszukaj paczkę: `sklein_lib_webview2`
3. Zainstaluj zgodnie z instrukcją (wymaga restartu LabVIEW w niektórych przypadkach).

### 4.2 Front Panel: dodaj kontrolkę WebView2
1. Otwórz VI z panelem frontowym (np. `Main.vi`).
2. Wstaw kontrolkę WebView2 (z palety dostarczonej przez paczkę / XControl).  
   (Jeśli używasz .NET container, zobacz sekcję 7 — to trudniejszy wariant).

### 4.3 Block Diagram: inicjalizacja i Navigate
Zrób 3 kroki w kolejności:

1) **Start serwera HTTP** (jeśli chcesz uruchamiać go z LabVIEW)  
2) **Start serwera WS** (LabVIEW / proxy)  
3) **Navigate WebView2** do UI

Minimalny flow (pseudo):
- `System Exec.vi` → start `serve` / `python -m http.server`
- `Wait (ms)` 500–1500 ms (albo health-check)
- `WebView2.Navigate("http://127.0.0.1:3000/")`

#### 4.3.1 Komenda do startu `serve` z LabVIEW
W `System Exec.vi` ustaw:

```bat
cmd /c start "ThinFilmLab_UI" /MIN npx serve -s "C:\sciezka\do\UI\dist" -l 3000
```

#### 4.3.2 Komenda do startu python http.server
```bat
cmd /c start "ThinFilmLab_UI" /MIN python -m http.server 3000 --directory "C:\sciezka\do\UI\dist"
```

> Wersja “cmd /c start …” uruchamia proces w osobnym oknie i nie blokuje LabVIEW.

### 4.4 Health-check (zalecane zamiast sztywnego Wait)
Zamiast `Wait (ms)` zrób prosty ping HTTP:
- `GET http://127.0.0.1:3000/` i sprawdź, czy zwraca 200

Dopiero wtedy wykonaj `Navigate`.

---

## 5) Przepływ uruchomienia w jednym VI (proponowany)

### 5.1 Main.vi (kolejność)
1. Start WS Server (LabVIEW) → port 8765  
2. Start HTTP Server (serve/python) → port 3000  
3. Init WebView2 (jeśli wymaga)  
4. Navigate → `http://127.0.0.1:3000/`  
5. Monitor (opcjonalnie): watchdog, status WS, “Restart UI”

### 5.2 Zamykanie aplikacji
Na stop/abort:
1. Zamknij WebView2 (Dispose / Close)  
2. Zatrzymaj WS Server (Stop loop, Close listener)  
3. Zatrzymaj HTTP Server (najprościej trzymać PID i zabić, albo użyć własnego serwera w LV)  

Praktycznie: jeśli `serve/python` uruchamiasz `cmd start`, to zatrzymanie jest zwykle osobnym krokiem (taskkill).

Przykład ubicia procesu `node.exe` (jeśli tylko to używasz):
```bat
taskkill /IM node.exe /F
```

(Lepsze: uruchamiaj z konkretnym tytułem okna i ubijaj po WMIC — zależy od tego, jak masz środowisko).

---

## 6) Najczęstsze problemy i szybkie naprawy

### 6.1 Czarny ekran / brak renderu
- Sprawdź, czy `http://127.0.0.1:3000/` działa w Edge/Chrome.
- Sprawdź WebView2 Runtime (czy jest zainstalowany).
- Sprawdź, czy kontrolka WebView2 jest poprawnie inicjalizowana (wg wrappera).

### 6.2 Brak połączenia WS
- Czy serwer WS działa na `127.0.0.1:8765`?
- Czy URL w UI jest poprawny?
- Czy WS endpoint to dokładnie `/ws`? (UI używa `/ws` w przykładach)
- Test `wscat` (sekcja 3.2).

### 6.3 Firewall
Na localhost zwykle nie przeszkadza, ale jeśli bindujesz na `0.0.0.0`, Windows Defender Firewall może pytać o zgodę.

### 6.4 UI w EXE (deployment)
- Musisz dostarczyć:
  - `dist/` (statyczne pliki)
  - WebView2 runtime (jeśli PC go nie ma)
  - node/python (jeśli serwujesz z zew. narzędzi)

**Najczystsze podejście produkcyjne:**  
zrobić mały serwer HTTP w LabVIEW (lub w proxy) zamiast zależeć od `npx serve`.  
Na start jednak — `npx serve` jest OK do prototypu.

---

## 7) Alternatywa: .NET Container (gdy nie chcesz VIPM)
NI opisuje osadzanie kontrolek .NET w .NET Container:
- https://www.ni.com/docs/en-US/bundle/labview/page/creating-net-controls-in-a-net-container.html

To działa, ale WebView2 często wymaga dodatkowej inicjalizacji (CoreWebView2), więc bez wrappera jest więcej roboty.  
Jeśli chcesz iść tą drogą, daj znać — przygotuję dokładny “recipe” pod Twoją wersję LabVIEW (32/64-bit) i .NET.

---

## 8) Checklist (do odhaczania)

- [ ] WebView2 Runtime zainstalowany (Win11)  
- [ ] `npm run build` generuje `dist/`  
- [ ] `http://127.0.0.1:3000/` działa w Edge/Chrome  
- [ ] Serwer WS działa na `ws://127.0.0.1:8765/ws` (test `wscat`)  
- [ ] VIPM package WebView2 zainstalowany w LabVIEW  
- [ ] WebView2 wstawiony na Front Panel  
- [ ] LabVIEW uruchamia HTTP server (lub serwer działa ręcznie)  
- [ ] `Navigate` do `http://127.0.0.1:3000/`  
- [ ] WS Console pokazuje RX/TX JSONy po połączeniu  

---

## 9) Źródła (referencje)

- WebBrowser control w LabVIEW oparty o Internet Explorer:  
  https://forums.ni.com/t5/Example-Code/Use-Internet-Explorer-11-as-Webbrowser-on-a-LabVIEW-UI/ta-p/4218149

- WebView2 runtime (Microsoft):  
  https://developer.microsoft.com/microsoft-edge/webview2/

- WebView2 wrapper (VIPM):  
  https://www.vipm.io/package/sklein_lib_webview2/

- Repo wrappera (GitHub):  
  https://github.com/kleinsimon/LV-WebView2

- NI: .NET Container w LabVIEW:  
  https://www.ni.com/docs/en-US/bundle/labview/page/creating-net-controls-in-a-net-container.html
