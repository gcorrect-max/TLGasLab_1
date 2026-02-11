# SVG dynamic (opcja 2): `id` + JS + WebView2 (LabVIEW)

Data: 2026-02-09

Ta metoda pozwala używać **czystego pliku SVG** (bez JSX) i **dynamicznie podmieniać tekst**
(PV/SP/MV/HEAT/WS) przez JavaScript.

## Pliki

- `station_schematic_dynamic.svg` — SVG z nadanymi `id` na elementach `<text>`
- `station_schematic_update.js` — funkcja `window.updateStationSchematic(state)`
- `station_schematic_demo.html` — działający przykład (inline SVG)

## 1) Jakie elementy SVG są dynamiczne

W SVG są następujące identyfikatory:

- `pv1Text` — tekst temperatury (PV1)
- `spmvText` — tekst SP i MV
- `heatText` — status grzania
- `wsText` — status WebSocket

Możesz dodać kolejne `id` analogicznie (np. PV2, alarmy).

## 2) Format danych wejściowych (JS)

Funkcja oczekuje obiektu (wystarczy podać używane pola):

```json
{
  "pv1_C": 245.3,
  "sp1_C": 250.0,
  "mv_pct": 62,
  "mvManual_pct": 35,
  "manualMode": false,
  "out1_heat": true,
  "wsConnected": true
}
```

Wywołanie:

```js
window.updateStationSchematic(state);
```

## 3) Jak osadzić SVG, żeby JS mógł zmieniać elementy

**Najprościej i najpewniej:** wstaw SVG **inline** w HTML (tak jak w demo).
Wtedy `document.getElementById(...)` działa bez kombinacji.

Jeśli osadzasz jako `<img src="...svg">`, to DOM SVG nie jest dostępny.
Jeśli osadzasz jako `<object data="...svg" type="image/svg+xml">`, to trzeba się dostać przez `object.contentDocument`.

Rekomendacja do WebView2: **inline SVG** (wklejony do HTML).

## 4) Integracja z LabVIEW WebView2: `ExecuteScript`

### 4.1. Założenie
W WebView2 masz załadowaną stronę dashboardu (lub osobny HTML), w której:
- jest inline SVG,
- jest załadowany `station_schematic_update.js` (albo ten kod jest wbudowany w page).

### 4.2. Wywołanie z LabVIEW
W LabVIEW budujesz JSON `state` i wołasz:

```js
window.updateStationSchematic({...});
```

**Ważne:** jeśli wstrzykujesz JSON jako string, musisz go prawidłowo zacytować/uciec.

Praktyczny wzorzec:
1. W LabVIEW budujesz JSON string `stateJson` (np. `{"pv1_C":245.3,...}`).
2. Budujesz skrypt:

```js
window.updateStationSchematic(JSON.parse('STATE_JSON_ESCAPED'));
```

gdzie `STATE_JSON_ESCAPED` ma:
- zamienione `'` na `\'` (jeśli występują),
- zamienione `\` na `\\` (jeśli występują).

### 4.3. Częstotliwość
Aktualizuj UI co **200–1000 ms** (telemetria).  
Dla WebView2 zwykle 250–500 ms jest OK.

## 5) Szybki test bez LabVIEW

Otwórz w przeglądarce:
- `station_schematic_demo.html`

Kliknij „Losuj” i zobacz czy wartości w SVG się zmieniają.

---

Jeśli chcesz, dopiszę też wariant:
- `pv2Text` (FLOW),
- wskaźniki alarmów (HI/LO/STB/LATCH) jako kropki/LED z `id`.
