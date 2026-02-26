# Obsługa błędów — ThinFilmLab Dashboard

## Filozofia: Fail-Silent + Graceful Degradation

Dashboard działa jako **SCADA/HMI** — musi pozostać responsywny nawet gdy poszczególne podsystemy są niedostępne. Każdy moduł obsługuje błędy lokalnie, nie blokując reszty aplikacji.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Dashboard (zawsze działa)                                          │
│  ├── WebSocket ✗ → Demo PID sim (symulacja lokalna)                │
│  ├── InfluxDB  ✗ → Tylko dane live z pamięci RAM                   │
│  ├── help.json ✗ → Komunikat błędu w P9                           │
│  └── MySQL     ✗ → Toast z opisem błędu, formularz nadal działa   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 1. WebSocket — połączenie z LabVIEW

### 1.1 Exponential Backoff Reconnect

Po utracie połączenia dashboard automatycznie próbuje połączyć się ponownie z rosnącym opóźnieniem:

| Parametr | Wartość |
|----------|---------|
| Formuła opóźnienia | `1000 * 1.7^tries` ms |
| Minimum | 1 000 ms (1s) |
| Maksimum | 15 000 ms (15s) |
| Watchdog timeout | 12 000 ms (12s) bez wiadomości → reconnect |
| Watchdog interwał | 1 500 ms (co 1.5s sprawdza) |

**Sekwencja:**
```
ws.onclose → oblicz delay → setTimeout(connectWs, delay) → tries++
```

Przykładowe opóźnienia:
```
Próba 0: 1.0s
Próba 1: 1.7s
Próba 2: 2.9s
Próba 3: 4.9s
Próba 4: 8.3s
Próba 5: 14.1s
Próba 6+: 15.0s (cap)
```

### 1.2 Watchdog (timeout)

Jeśli WS jest oznaczony jako `wsConnected=true`, ale brak wiadomości przez 12 sekund:
1. Log: `"WS timeout >12s. Reconnect."`
2. `disconnectWs("timeout")` — czyści handlery, zamyka socket
3. `connectWs({manual:false})` — nowe połączenie

### 1.3 Błąd parsowania JSON

```javascript
ws.onmessage = (ev) => {
  let msg = null;
  try { msg = JSON.parse(ev.data) } catch { return }
  if (typeof msg !== "object" || !msg) return;
  // ...
};
```

Nieprawidłowy JSON jest **cicho ignorowany** — dashboard nie crashuje.

### 1.4 Błąd wysyłania (TX)

```javascript
if (ws && ws.readyState === 1) {
  try { ws.send(JSON.stringify(payload)) }
  catch (e) { addLog(`TX fail: ${String(e)}`, "ws") }
}
```

- Sprawdzenie `readyState === 1` (OPEN) przed wysłaniem
- Wyjątek logowany do systemu logów (P6)
- Brak wysyłki nie blokuje UI — payload zapisany w historii TX konsoli

### 1.5 Handshake po reconnect

Po każdym udanym `ws.onopen`:
1. `hello` — identyfikacja klienta (app, ver, user)
2. `config_request` — żądanie konfiguracji

Błąd w `send()` podczas handshake jest przechwytywany przez `try/catch` bez reakcji (socket może się zamknąć w międzyczasie).

### 1.6 Dioda WS w headerze

- `<Led on={mb.wsConnected} color="#00cc66" label="WS"/>` — zielona gdy połączono, szara gdy offline
- Stan zarządzany przez `ws.onopen` (true) i `ws.onclose` (false)

---

## 2. InfluxDB — zapis i odczyt danych

### 2.1 Fail-Silent Write

```javascript
export function writeDataPoint(data) {
  try {
    // ... budowanie Point ...
    getWriteApi().writePoint(pt);
  } catch (e) {
    console.warn("[influx] write error:", e.message);
  }
}
```

- Błąd zapisu logowany do konsoli (`console.warn`)
- Dashboard kontynuuje normalną pracę
- Dane istnieją w `hist[]` (RAM) niezależnie od InfluxDB

### 2.2 Query Error → pusta tablica

```javascript
export async function queryHistory(range = "-1h") {
  try {
    // ... flux query ...
    return new Promise((resolve, reject) => {
      queryApi.queryRows(flux, {
        error(err) {
          console.warn("[influx] query error:", err.message);
          resolve([]);  // ← zwraca [] zamiast reject
        },
        complete() { resolve(rows); }
      });
    });
  } catch (e) {
    console.warn("[influx] query error:", e.message);
    return [];  // ← zwraca []
  }
}
```

- Dwa poziomy catch: Promise error + zewnętrzny try/catch
- Zawsze zwraca tablicę (pustą przy błędzie) — wykresy nie crashują

### 2.3 Health Check

```javascript
export async function influxHealth() {
  try {
    const r = await fetch(`${INFLUX_URL}/health`, {
      signal: AbortSignal.timeout(3000)
    });
    const j = await r.json();
    return j.status === "pass";
  } catch { return false; }
}
```

- Timeout 3 sekundy
- Wykonywany co 30 sekund
- Wynik → fioletowa dioda `<Led on={influxOk} color="#8844ff" label="DB"/>`
- `false` przy każdym błędzie (sieć, timeout, brak kontenera)

### 2.4 Batching + Flush

| Parametr | Wartość |
|----------|---------|
| `batchSize` | 10 punktów |
| `flushInterval` | 5 000 ms |
| `maxRetries` | 3 |

Flush przy zamykaniu taba:
```javascript
window.addEventListener("beforeunload", () => {
  try { _writeApi?.flush(); } catch {}
});
```

### 2.5 Brak InfluxDB — zachowanie dashboardu

| Funkcja | Zachowanie bez InfluxDB |
|---------|------------------------|
| Wykres live (P1) | Działa — dane z `hist[]` (RAM, 150 pkt) |
| Wykres historyczny | Pusta tablica → brak danych na wykresie |
| Eksport CSV (P5) | "Pamięć" działa; zakresy 1h/24h/7d puste |
| Dioda DB | Szara (off) |
| Zapis danych | `console.warn` w konsoli przeglądarki |

---

## 3. System alarmów

### 3.1 Alarmy z LabVIEW (WS)

```javascript
if (type === "alarm_event") {
  const sev = data?.sev || "warning";   // fallback
  const msgT = data?.msg || "alarm";     // fallback
  const latch = !!data?.latch;
  setMb(m => ({
    ...m,
    alarmSTB: true,
    alarmLATCH: latch ? true : m.alarmLATCH
  }));
  sAlog(a => [...a, { time, sev, msg: msgT }].slice(-100));
}
```

- Ring buffer 100 ostatnich alarmów
- Severity: `"danger"` | `"warning"` | `"info"`
- LATCH — alarm zatrzaskowy, wymaga `alarm_clear` do skasowania

### 3.2 Alarmy z demo PID

```javascript
const alarm1 = pv1 > sp1 + m.hyst * 5;    // HI
const alarm2 = pv1 < sp1 - m.hyst * 10;   // LO
const alarmSTB = alarm1 || alarm2;
const alarmLATCH = m.alarmLATCH || alarmSTB;
```

- HI: PV1 przekracza SP1 + 5x histereza
- LO: PV1 poniżej SP1 - 10x histereza
- Generowane co 1s w symulacji demo

### 3.3 Kasowanie alarmu LATCH

```javascript
sendCmd("alarm_clear", { latch: true });
```

- Przycisk dostępny w P2 gdy `alarmLATCH === true`
- Wysyła komendę do LabVIEW + ustawia lokalnie `alarmLATCH: false`

---

## 4. Parsowanie danych wejściowych

### 4.1 Import JSON eksperymentu (P1)

```javascript
const handleFile = (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  if (!f.name.endsWith(".json")) { toast("Tylko pliki .json", "error"); return; }
  const r = new FileReader();
  r.onload = (ev) => {
    try {
      const j = JSON.parse(ev.target.result);
      if (!j.profile?.segments || !j.sample) {
        toast("Nieprawidłowy format pliku eksperymentu", "error");
        return;
      }
      // ... import danych
    } catch (err) {
      toast(`Błąd parsowania JSON: ${err.message}`, "error");
    }
  };
  r.readAsText(f);
};
```

- Walidacja rozszerzenia `.json`
- Walidacja struktury (`profile.segments` + `sample`)
- Komunikat toast z `err.message` przy błędzie parse

### 4.2 Import SVG (P4)

```javascript
if (!f.name.endsWith(".svg")) { toast("Tylko pliki .svg", "error"); return; }
// ...
if (typeof txt === "string" && txt.includes("<svg")) {
  setCustomSvg(txt);
} else {
  toast("Nieprawidłowy plik SVG", "error");
}
```

- Walidacja rozszerzenia + obecność tagu `<svg`

### 4.3 Walidacja `applyLvMessage`

```javascript
const type = msg?.type || msg?.kind;
const data = msg?.data ?? msg?.payload ?? msg;
if (!type) return;
```

- Tolerancja: akceptuje `type` lub `kind`, `data` lub `payload`
- Brak `type` → ignoruj wiadomość
- Nieznany `type` → po prostu brak pasującego `if` — nic się nie dzieje

---

## 5. Help API (P9)

### 5.1 Fetch z obsługą błędów

```javascript
useEffect(() => {
  let cancel = false;
  setHelpLoading(true);
  setHelpError(null);
  fetch("/help.json")
    .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json() })
    .then(all => { if (!cancel) { setHelpData(all); setHelpLoading(false) } })
    .catch(e => {
      if (!cancel) { setHelpError(e.message || "Fetch error"); setHelpLoading(false) }
    });
  return () => { cancel = true };
}, []);
```

- Flaga `cancel` zapobiega aktualizacji stanu po unmount
- HTTP error (404, 500) rzuca wyjątek
- Stan ładowania: spinner
- Stan błędu: komunikat z `e.message`

---

## 6. MySQL / Backend API (P3)

### 6.1 Wzorzec obsługi

Wszystkie operacje MySQL w P3 używają tego samego wzorca:

```javascript
try {
  const r = await fetch(`${API}/endpoint`, options);
  const j = await r.json();
  if (j.ok) { toast("Sukces", "success"); }
  else { toast(`MySQL: ${j.error}`, "error"); }
} catch (e) {
  toast(`MySQL: ${e.message}`, "error");
}
```

| Operacja | Endpoint | Błąd sieci | Błąd serwera |
|----------|----------|------------|--------------|
| Health check | `/health` | Toast error | `dbStatus = "err"` |
| Insert | `/samples` POST | Toast error | Toast `j.error` |
| Search | `/samples?field=X&q=Y` | Toast error | Toast `j.error` |
| List all | `/samples` GET | Toast error | Toast `j.error` |
| Delete | `/samples/:id` DELETE | Toast error | Toast `j.error` |

---

## 7. LocalStorage

### 7.1 Wzorzec zapisu z try/catch

```javascript
try { localStorage.setItem("tfl_config", JSON.stringify(data)) } catch {}
```

- Używany przy: konfiguracji z LabVIEW, preferencji języka pomocy
- Cichy catch — brak LocalStorage (private browsing) nie blokuje nic

### 7.2 Wzorzec odczytu

```javascript
try { return localStorage.getItem("tfl_help_lang") || "pl" } catch { return "pl" }
```

- Fallback do wartości domyślnej

---

## 8. Toasty (powiadomienia UI)

### 8.1 Typy

| Typ | Ikona | Kolor tła | Użycie |
|-----|-------|-----------|--------|
| `error` | ⚠ | Czerwone | Błędy walidacji, sieci, parse |
| `success` | ✓ | Zielone | Potwierdzenia akcji |
| `info` | ℹ | Niebieskie | Informacje, statusy |

### 8.2 Mechanizm

```javascript
const toast = useCallback((msg, type = "info") => {
  sToasts(t => [...t, { id: Date.now(), msg, type }]);
  setTimeout(() => sToasts(t => t.filter(x => x.id !== id)), 4000);
}, []);
```

- Automatyczne usuwanie po 4 sekundach
- Ręczne zamknięcie przyciskiem ×
- Pozycja: prawy-górny róg, fixed, z-index 9999
- Animacja wejścia: `si` (slide-in)

---

## 9. Podsumowanie wzorców

| Moduł | Strategia | Logi | UI Feedback |
|-------|-----------|------|-------------|
| WebSocket | Auto-reconnect + backoff | addLog (P6) | LED WS + toast |
| InfluxDB write | Fail-silent, console.warn | console | LED DB |
| InfluxDB query | Return [] on error | console | Pusty wykres |
| JSON parse (WS) | Silent ignore | brak | brak |
| JSON parse (file) | Toast error | toast | Toast |
| Alarmy | Ring buffer 100 | alarm log (P1) | Badge + lista |
| MySQL API | Try/catch + toast | toast + addLog | Toast |
| LocalStorage | Try/catch, fallback | brak | brak |
| Help fetch | Error state w UI | brak | Ekran błędu |
