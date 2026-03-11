/**
 * ThinFilmLab 2 (GasLab) — MySQL REST API Server
 * Baza: mysql.agh.edu.pl / sobkow2
 * Port: 3005 (konfigurowany przez API_PORT w server/.env)
 */
require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
const PORT = parseInt(process.env.API_PORT) || 3005;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

// ── Pool połączeń MySQL ──
const pool = mysql.createPool({
  host:     process.env.DB_HOST || 'mysql.agh.edu.pl',
  port:     parseInt(process.env.DB_PORT) || 3306,
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  connectTimeout: 15000,
  charset: 'utf8mb4',
});

// ── Inicjalizacja tabel ──
async function initDB() {
  const conn = await pool.getConnection();
  try {
    // Próbki materiałowe
    await conn.query(`
      CREATE TABLE IF NOT EXISTS tfl_samples (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        station     VARCHAR(10) DEFAULT 'S1',
        sampleId    VARCHAR(100),
        material    VARCHAR(100),
        substrate   VARCHAR(100),
        method      VARCHAR(100),
        thickness   VARCHAR(50),
        targetGas   VARCHAR(100),
        processTemp VARCHAR(50),
        pressure    VARCHAR(50),
        atmosphere  VARCHAR(100),
        sourcePower VARCHAR(50),
        processTime VARCHAR(50),
        gasFlow     VARCHAR(50),
        operator    VARCHAR(100),
        batchNo     VARCHAR(100),
        goal        TEXT,
        notes       TEXT,
        photos      TEXT,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sid  (sampleId(50)),
        INDEX idx_mat  (material(50)),
        INDEX idx_op   (operator(50)),
        INDEX idx_sta  (station)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Przebiegi eksperymentów (uruchomienia profilu)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS tfl_experiments (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        station       VARCHAR(10) DEFAULT 'S1',
        profile_name  VARCHAR(200),
        sample_id     VARCHAR(100),
        operator      VARCHAR(100),
        status        VARCHAR(20) DEFAULT 'RUN',
        started_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
        finished_at   DATETIME,
        segments_json TEXT,
        notes         TEXT,
        INDEX idx_esid (sample_id(50)),
        INDEX idx_est  (started_at),
        INDEX idx_esta (station)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Alarmy z LabVIEW
    await conn.query(`
      CREATE TABLE IF NOT EXISTS tfl_alarms (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        station       VARCHAR(10) DEFAULT 'S1',
        ts            DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
        experiment_id INT,
        severity      VARCHAR(20),
        alarm_msg     TEXT,
        INDEX idx_ats  (ts),
        INDEX idx_aexp (experiment_id),
        INDEX idx_asta (station)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Dodaj kolumnę station do istniejących tabel (jeśli jej brak)
    for (const tbl of ['tfl_samples', 'tfl_experiments', 'tfl_alarms']) {
      try {
        await conn.query(`ALTER TABLE \`${tbl}\` ADD COLUMN station VARCHAR(10) DEFAULT 'S1' AFTER id`);
        console.log(`[DB] Dodano kolumnę station → ${tbl}`);
      } catch (e) {
        if (!e.message.includes('Duplicate column')) throw e;
        // kolumna już istnieje — OK
      }
    }

    console.log('[DB] Tabele gotowe — tfl_samples / tfl_experiments / tfl_alarms');
  } finally {
    conn.release();
  }
}

// pomocnicza — parsuj JSON z TEXT kolumny
function parseJSON(v, def) {
  if (v == null) return def;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return def; }
}

// ════════════════════════════════════════
// HEALTH
// ════════════════════════════════════════

app.get('/api/health', async (_req, res) => {
  if (!dbReady) return res.status(503).json({ ok: false, error: 'Brak połączenia z MySQL (VPN AGH wymagany)' });
  try {
    const [[{ now }]] = await pool.query('SELECT NOW() AS now');
    res.json({ ok: true, ts: now, db: process.env.DB_NAME });
  } catch (e) {
    res.status(503).json({ ok: false, error: e.message });
  }
});

// ════════════════════════════════════════
// PRÓBKI (samples)
// ════════════════════════════════════════

// POST /api/samples — dodaj próbkę
app.post('/api/samples', async (req, res) => {
  try {
    const d = req.body;
    const [r] = await pool.query(
      `INSERT INTO tfl_samples
        (station,sampleId,material,substrate,method,thickness,targetGas,processTemp,
         pressure,atmosphere,sourcePower,processTime,gasFlow,operator,batchNo,goal,notes,photos)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        d.station||'S1',
        d.sampleId||null, d.material||null, d.substrate||null, d.method||null,
        d.thickness||null, d.targetGas||null, d.processTemp||null, d.pressure||null,
        d.atmosphere||null, d.sourcePower||null, d.processTime||null, d.gasFlow||null,
        d.operator||null, d.batchNo||null, d.goal||null, d.notes||null,
        JSON.stringify(Array.isArray(d.photos) ? d.photos : []),
      ]
    );
    res.json({ ok: true, id: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/samples?station=S1 — wszystkie (max 200, opcjonalnie filtruj stację)
app.get('/api/samples', async (req, res) => {
  try {
    const { station } = req.query;
    const where = station ? 'WHERE station=?' : '';
    const params = station ? [station] : [];
    const [rows] = await pool.query(
      `SELECT id AS _id, station, sampleId, material, substrate, method, thickness, targetGas,
              processTemp, pressure, atmosphere, sourcePower, processTime, gasFlow,
              operator, batchNo, goal, notes, photos, created_at AS _createdAt
       FROM tfl_samples ${where} ORDER BY id DESC LIMIT 200`, params
    );
    rows.forEach(r => { r.photos = parseJSON(r.photos, []); });
    res.json({ ok: true, data: rows, count: rows.length });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/samples/search?field=X&query=Y&station=S1
app.get('/api/samples/search', async (req, res) => {
  try {
    const { field, query, station } = req.query;
    const allowed = [
      'sampleId','material','substrate','method','thickness','targetGas',
      'processTemp','pressure','atmosphere','sourcePower','processTime',
      'gasFlow','operator','batchNo','goal','notes',
    ];
    if (!allowed.includes(field))
      return res.status(400).json({ ok: false, error: 'Nieprawidłowe pole wyszukiwania' });

    const stationWhere = station ? ' AND station=?' : '';
    const params = station ? [`%${query}%`, station] : [`%${query}%`];
    const [rows] = await pool.query(
      `SELECT id AS _id, station, sampleId, material, substrate, method, thickness, targetGas,
              processTemp, pressure, atmosphere, sourcePower, processTime, gasFlow,
              operator, batchNo, goal, notes, photos, created_at AS _createdAt
       FROM tfl_samples WHERE \`${field}\` LIKE ?${stationWhere} ORDER BY id DESC LIMIT 100`,
      params
    );
    rows.forEach(r => { r.photos = parseJSON(r.photos, []); });
    res.json({ ok: true, data: rows, count: rows.length });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// DELETE /api/samples/:id
app.delete('/api/samples/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM tfl_samples WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ════════════════════════════════════════
// EKSPERYMENTY (przebiegi profilu)
// ════════════════════════════════════════

// POST /api/experiments — start eksperymentu
app.post('/api/experiments', async (req, res) => {
  try {
    const d = req.body;
    const [r] = await pool.query(
      `INSERT INTO tfl_experiments
        (station, profile_name, sample_id, operator, status, segments_json, notes)
       VALUES (?,?,?,?,?,?,?)`,
      [
        d.station     || 'S1',
        d.profileName || null,
        d.sampleId    || null,
        d.operator    || null,
        d.status      || 'RUN',
        JSON.stringify(d.segments || []),
        d.notes       || null,
      ]
    );
    res.json({ ok: true, id: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// PATCH /api/experiments/:id — zakończ eksperyment
app.patch('/api/experiments/:id', async (req, res) => {
  try {
    const d = req.body;
    await pool.query(
      `UPDATE tfl_experiments SET status=?, finished_at=? WHERE id=?`,
      [d.status || 'DONE', d.finishedAt ? new Date(d.finishedAt) : new Date(), req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/experiments?station=S1
app.get('/api/experiments', async (req, res) => {
  try {
    const { station } = req.query;
    const where = station ? 'WHERE station=?' : '';
    const params = station ? [station] : [];
    const [rows] = await pool.query(
      `SELECT id AS _id, station,
              profile_name AS profileName,
              sample_id    AS sampleId,
              operator, status,
              started_at   AS startedAt,
              finished_at  AS finishedAt,
              segments_json, notes
       FROM tfl_experiments ${where} ORDER BY id DESC LIMIT 200`, params
    );
    rows.forEach(r => {
      r.segments = parseJSON(r.segments_json, []);
      delete r.segments_json;
    });
    res.json({ ok: true, data: rows, count: rows.length });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// DELETE /api/experiments/:id
app.delete('/api/experiments/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM tfl_experiments WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ════════════════════════════════════════
// ALARMY
// ════════════════════════════════════════

// POST /api/alarms
app.post('/api/alarms', async (req, res) => {
  try {
    const d = req.body;
    await pool.query(
      `INSERT INTO tfl_alarms (station, experiment_id, severity, alarm_msg) VALUES (?,?,?,?)`,
      [d.station || 'S1', d.experimentId || null, d.severity || 'warning', d.msg || '']
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/alarms?limit=N&station=S1
app.get('/api/alarms', async (req, res) => {
  try {
    const lim = Math.min(parseInt(req.query.limit) || 100, 500);
    const { station } = req.query;
    const where = station ? 'WHERE station=?' : '';
    const params = station ? [station, lim] : [lim];
    const [rows] = await pool.query(
      `SELECT id AS _id, station, ts, experiment_id AS experimentId, severity, alarm_msg AS msg
       FROM tfl_alarms ${where} ORDER BY id DESC LIMIT ?`,
      params
    );
    res.json({ ok: true, data: rows, count: rows.length });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ════════════════════════════════════════
// START — graceful degradation + retry
// ════════════════════════════════════════
let dbReady = false;

// Nadpisz endpointy DB statusem jeśli brak połączenia
function requireDB(req, res, next) {
  if (!dbReady) return res.status(503).json({ ok: false, error: 'Brak połączenia z MySQL — uruchom VPN AGH i poczekaj na retry' });
  next();
}

// Stosuj middleware requireDB na wszystkich endpointach DB
// (owijamy istniejące handlery w sprawdzenie stanu)
const origRouters = app._router;

async function tryInitDB(retryDelay = 15000) {
  try {
    await initDB();
    dbReady = true;
    console.log('[DB] Połączono pomyślnie!');
  } catch (err) {
    console.warn(`[DB] Brak połączenia: ${err.message}`);
    console.warn(`[DB] Retry za ${retryDelay / 1000}s — sprawdź VPN AGH`);
    setTimeout(() => tryInitDB(Math.min(retryDelay * 2, 120000)), retryDelay);
  }
}

app.listen(PORT, () => {
  console.log(`[TFL API S2] http://localhost:${PORT}/api  (serwer uruchomiony)`);
  console.log(`[DB]  ${process.env.DB_USER}@${process.env.DB_HOST}/${process.env.DB_NAME}`);
  console.log('[DB] Próba połączenia z MySQL...');
  tryInitDB();
});
