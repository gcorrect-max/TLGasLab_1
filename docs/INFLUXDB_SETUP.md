# InfluxDB v2 — Instalacja i konfiguracja

## Wymagania
- **Docker Desktop for Windows** z backendem WSL2
  - Pobranie: https://docs.docker.com/desktop/setup/install/windows-install/
  - Po instalacji: `docker --version` i `docker compose version`

## Szybki start

```bash
cd E:\BasiaLab1
docker compose up -d
```

Weryfikacja:
```bash
curl http://localhost:8086/health
# Oczekiwany wynik: {"name":"influxdb","message":"ready for queries and writes","status":"pass"}
```

## Dostep do UI

- **URL:** http://localhost:8086
- **Login:** admin
- **Haslo:** thinfilm2026

## Konfiguracja

| Parametr | Wartosc |
|----------|---------|
| Organizacja | ThinFilmLab |
| Bucket (raw) | measurements |
| Retencja raw | 30 dni (720h) |
| Token API | tfl-dev-token-2026 |
| Port | 8086 |

## Architektura

```
Czujniki --> LabVIEW --> WebSocket --> React Dashboard --> InfluxDB v2
                                         |                    |
                                    hist[] (150 pkt)    measurements bucket
                                    (pamiec RAM)        (30 dni, 1s rozdzielczosc)
```

### Przepyw danych
1. LabVIEW wysya `measurement_update` przez WebSocket co ~1s
2. React dashboard odbiera dane i:
   - Dodaje punkt do `hist[]` (ring buffer 150 pkt, pamiec RAM)
   - Zapisuje punkt do InfluxDB via `writeDataPoint()` (batched, co 10 pkt lub 5s)
3. W trybie demo (bez WS): symulacja PID tez zapisuje do InfluxDB
4. Wykresy P1 moga pokazywac:
   - "Na zywo" — ostatnie 80 punktow z `hist[]`
   - "1h/6h/24h/7d" — dane z InfluxDB (z automatycznym downsamplingiem)

## Modul klienta: `src/influx.js`

| Funkcja | Opis |
|---------|------|
| `writeDataPoint(data)` | Zapis punktu (pv1, pv2, sp1, mv, mfc1-4) |
| `queryHistory(range)` | Zapytanie historyczne ("-1h", "-6h", "-24h", "-7d") |
| `influxHealth()` | Health check -> true/false |

## Downsampling (opcjonalnie)

Utworzenie bucketa na dane zagregowane (retencja 1 rok):
```bash
docker exec tfl-influxdb influx bucket create \
  --name measurements_downsampled \
  --org ThinFilmLab \
  --retention 8760h \
  --token tfl-dev-token-2026
```

Utworzenie taska w InfluxDB UI (Tasks > Create Task):
```flux
option task = {name: "downsample_5m", every: 5m}

from(bucket: "measurements")
  |> range(start: -10m)
  |> filter(fn: (r) => r._measurement == "process_data")
  |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
  |> to(bucket: "measurements_downsampled", org: "ThinFilmLab")
```

## Zarzadzanie kontenerem

```bash
docker compose up -d      # Start
docker compose stop       # Stop (dane zachowane)
docker compose down       # Stop + usun kontener (dane w volume zachowane)
docker compose down -v    # Stop + usun kontener + dane (UWAGA!)
docker compose logs -f    # Logi
```

## Troubleshooting

| Problem | Rozwiazanie |
|---------|------------|
| Port 8086 zajety | Zmien port w docker-compose.yml: `"8087:8086"` i w src/influx.js |
| CORS error | InfluxDB v2 domyslnie zezwala na CORS; sprawdz czy kontener dziala |
| Dashboard bez InfluxDB | Dziaa normalnie — zapis fail-silent, LED "DB" zgaszony |
| Dane zagubione | Sprawdz `docker volume ls` — volume `thinfilmlab_influxdb-data` |
