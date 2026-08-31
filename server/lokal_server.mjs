// ============================================================
// IELTSBridge CRM — LOKAL SERVER (internetsiz rejim)
// Baza: PGlite (haqiqiy Postgres, fayl sifatida ./lokal_baza da)
// Barcha migratsiyalar, triggerlar, RLS huquqlari aynan bulutdagidek ishlaydi.
// Ishga tushirish: node server/lokal_server.mjs   (port 5200)
// ============================================================
import { PGlite } from '@electric-sql/pglite';
import http from 'node:http';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 5200;
const db = new PGlite(path.join(ROOT, 'lokal_baza'));

// ---------- yordamchilar ----------
const sessiyalar = new Map(); // token -> email
function hashla(parol) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(parol, salt, 32).toString('hex');
}
function tekshir(parol, saqlangan) {
  const [salt, h] = String(saqlangan).split(':');
  try { return timingSafeEqual(Buffer.from(h, 'hex'), scryptSync(parol, salt, 32)); }
  catch { return false; }
}
let navbat = Promise.resolve();
function navbatda(fn) {
  const p = navbat.then(fn, fn);
  navbat = p.catch(() => {});
  return p;
}
// foydalanuvchi nomidan (RLS bilan) bajarish
async function foydalanuvchiSifatida(email, fn) {
  return navbatda(() => db.transaction(async (tx) => {
    await tx.exec(`SELECT set_config('request.jwt.claims', '${JSON.stringify({ email }).replace(/'/g, "''")}', true); SET LOCAL ROLE authenticated;`);
    return fn(tx);
  }));
}

// ---------- so'rov quruvchi (facade protokoli) ----------
const FK = {
  groups: { teachers: ['teachers', 'teacher_id'], support: ['teachers', 'support_teacher_id'], levels: ['levels', 'level_code'] },
  enrollments: { students: ['students', 'student_id'], groups: ['groups', 'group_id'] },
  payments: { students: ['students', 'student_id'] },
  trials: { leads: ['leads', 'lead_id'], groups: ['groups', 'group_id'], teachers: ['teachers', 'teacher_id'] },
  assessment_results: { assessments: ['assessments', 'assessment_code'] },
};
const PK = { teachers: 'id', levels: 'code', students: 'id', groups: 'id', leads: 'id', assessments: 'code' };

function ustunlarniAjrat(s) {
  // yuqori darajadagi vergullar bo'yicha (qavslarni hisobga olib)
  const out = []; let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function selectQur(jadval, ustunlar) {
  if (!ustunlar || ustunlar.trim() === '*' || ustunlar.trim() === '') return `t.*`;
  const qismlar = [];
  let yulduz = false;
  for (const item of ustunlarniAjrat(ustunlar)) {
    if (item === '*') { yulduz = true; continue; }
    const m = item.match(/^(?:([a-zA-Z_]+):)?([a-zA-Z_]+)(?:!([a-zA-Z_]+))?\(([^)]*)\)$/);
    if (m) {
      const alias = m[1] ?? m[2];
      let target, fkCol;
      if (m[3]) { // aniq FK nomi: groups_teacher_id_fkey
        target = m[2];
        fkCol = m[3].replace(jadval + '_', '').replace('_fkey', '');
      } else {
        const meta = FK[jadval]?.[m[2]] ?? FK[jadval]?.[alias];
        if (!meta) throw new Error(`Nomalum embed: ${jadval} -> ${item}`);
        [target, fkCol] = meta;
      }
      const ichki = m[4].trim() === '*' || m[4].trim() === '' ? '*' : m[4];
      qismlar.push(`(SELECT to_jsonb(e) FROM (SELECT ${ichki} FROM ${target} WHERE ${target}.${PK[target] ?? 'id'} = t.${fkCol}) e) AS ${alias}`);
    } else {
      qismlar.push(`t.${item}`);
    }
  }
  if (yulduz) qismlar.unshift('t.*');
  return qismlar.join(', ');
}

function filtrQur(filtrlar, params) {
  const sh = [];
  for (const f of filtrlar ?? []) {
    const p = (v) => { params.push(v); return '$' + params.length; };
    switch (f.turi) {
      case 'eq': sh.push(`t.${f.ustun} = ${p(f.qiymat)}`); break;
      case 'neq': sh.push(`t.${f.ustun} <> ${p(f.qiymat)}`); break;
      case 'gt': sh.push(`t.${f.ustun} > ${p(f.qiymat)}`); break;
      case 'gte': sh.push(`t.${f.ustun} >= ${p(f.qiymat)}`); break;
      case 'lt': sh.push(`t.${f.ustun} < ${p(f.qiymat)}`); break;
      case 'lte': sh.push(`t.${f.ustun} <= ${p(f.qiymat)}`); break;
      case 'ilike': sh.push(`t.${f.ustun} ILIKE ${p(f.qiymat)}`); break;
      case 'is': sh.push(`t.${f.ustun} IS ${f.qiymat === null ? 'NULL' : f.qiymat}`); break;
      case 'in': sh.push(f.qiymat.length ? `t.${f.ustun} IN (${f.qiymat.map((v) => p(v)).join(',')})` : 'FALSE'); break;
      case 'or': {
        const ich = f.qiymat.split(',').map((s) => {
          const [ustun, op, ...rest] = s.split('.');
          const v = rest.join('.');
          if (op === 'eq') return `t.${ustun} = ${p(v)}`;
          if (op === 'ilike') return `t.${ustun} ILIKE ${p(v)}`;
          throw new Error('or ichida nomalum op: ' + op);
        });
        sh.push('(' + ich.join(' OR ') + ')');
        break;
      }
      default: throw new Error('Nomalum filtr: ' + f.turi);
    }
  }
  return sh.length ? ' WHERE ' + sh.join(' AND ') : '';
}

async function sorovBajar(tx, b) {
  const params = [];
  if (b.amal === 'select') {
    if (b.head && b.count) {
      const sql = `SELECT count(*)::int AS n FROM ${b.jadval} t` + filtrQur(b.filtrlar, params);
      const r = await tx.query(sql, params);
      return { data: null, count: r.rows[0].n };
    }
    let sql = `SELECT ${selectQur(b.jadval, b.ustunlar)} FROM ${b.jadval} t` + filtrQur(b.filtrlar, params);
    for (const [i, o] of (b.tartib ?? []).entries()) {
      sql += (i === 0 ? ' ORDER BY ' : ', ') + `t.${o.ustun} ${o.osish ? 'ASC' : 'DESC'}`;
    }
    if (b.limit) sql += ' LIMIT ' + Number(b.limit);
    const r = await tx.query(sql, params);
    let data = r.rows;
    let count = b.count ? data.length : undefined;
    if (b.single === 'single') {
      if (data.length !== 1) return { error: { message: data.length + ' qator (1 kutilgan)', code: 'PGRST116' } };
      data = data[0];
    } else if (b.single === 'maybe') {
      data = data[0] ?? null;
    }
    return { data, count };
  }
  if (b.amal === 'insert' || b.amal === 'upsert') {
    const rows = Array.isArray(b.qiymatlar) ? b.qiymatlar : [b.qiymatlar];
    const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const vals = rows.map((r) => '(' + cols.map((c) => { params.push(r[c] === undefined ? null : r[c]); return '$' + params.length; }).join(',') + ')').join(',');
    let sql = `INSERT INTO ${b.jadval} (${cols.join(',')}) VALUES ${vals}`;
    if (b.amal === 'upsert') {
      sql += ` ON CONFLICT (${b.onConflict}) DO UPDATE SET ` + cols.map((c) => `${c} = EXCLUDED.${c}`).join(',');
    }
    if (b.returning) sql += ' RETURNING ' + b.returning;
    const r = await tx.query(sql, params);
    let data = b.returning ? r.rows : null;
    if (b.returning && b.single === 'single') data = data[0] ?? null;
    return { data };
  }
  if (b.amal === 'update') {
    const cols = Object.keys(b.qiymatlar);
    const set = cols.map((c) => { params.push(b.qiymatlar[c]); return `${c} = $${params.length}`; }).join(',');
    let sql = `UPDATE ${b.jadval} t SET ${set}` + filtrQur(b.filtrlar, params);
    if (b.returning) sql += ' RETURNING ' + b.returning;
    const r = await tx.query(sql, params);
    return { data: b.returning ? (b.single === 'single' ? r.rows[0] ?? null : r.rows) : null };
  }
  if (b.amal === 'delete') {
    const sql = `DELETE FROM ${b.jadval} t` + filtrQur(b.filtrlar, params);
    await tx.query(sql, params);
    return { data: null };
  }
  throw new Error('Nomalum amal: ' + b.amal);
}

const RPCLAR = {
  make_group_id: ['p_level', 'p_start'],
  generate_sessions: ['p_group_id'],
  reschedule_sessions: ['p_group_id'],
  generate_monthly_payments: ['p_period'],
  receive_payment: ['p_payment_id', 'p_amount', 'p_method', 'p_received_by'],
  correct_payment: ['p_payment_id', 'p_amount_paid', 'p_method'],
};

// ---------- boshlang'ich sozlash ----------
async function tayyorla() {
  const bor = await db.query(`SELECT 1 FROM pg_roles WHERE rolname='authenticated'`);
  if (!bor.rows.length) {
    console.log('Birinchi ishga tushirish: baza yaratilmoqda...');
    await db.exec('CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;');
    await db.exec(`CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT NULL::uuid';
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;`);
    await db.exec(`CREATE TABLE _migratsiyalar (nom TEXT PRIMARY KEY, vaqt TIMESTAMPTZ DEFAULT now());
      CREATE TABLE lokal_auth (email TEXT PRIMARY KEY, parol_hash TEXT NOT NULL);`);
  }
  // migratsiyalarni qo'llash (yangilari ham avtomatik tushadi)
  const migDir = path.join(ROOT, 'supabase', 'migrations');
  for (const f of readdirSync(migDir).sort()) {
    const bormi = await db.query('SELECT 1 FROM _migratsiyalar WHERE nom=$1', [f]);
    if (bormi.rows.length) continue;
    console.log('Migratsiya:', f);
    await db.exec(readFileSync(path.join(migDir, f), 'utf8'));
    await db.query('INSERT INTO _migratsiyalar (nom) VALUES ($1)', [f]);
  }
  await db.exec(`GRANT USAGE ON SCHEMA public TO authenticated, anon;
    GRANT USAGE ON SCHEMA auth TO authenticated, anon;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO authenticated;
    REVOKE ALL ON lokal_auth FROM authenticated, anon;
    REVOKE ALL ON _migratsiyalar FROM authenticated, anon;`);
  // standart bosh admin
  const admin = await db.query('SELECT count(*)::int n FROM lokal_auth');
  if (!admin.rows[0].n) {
    await db.query('INSERT INTO lokal_auth (email, parol_hash) VALUES ($1, $2)', ['admin@ieltsbridge.uz', hashla('admin123')]);
    await db.query(`INSERT INTO staff_roles (email, role, full_name) VALUES ('admin@ieltsbridge.uz', 'superadmin', 'Bosh admin') ON CONFLICT (email) DO NOTHING`);
    console.log('Standart kirish yaratildi -> login: admin  parol: admin123 (birinchi kirishdan keyin almashtiring!)');
  }
}

// ---------- HTTP ----------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
function json(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}
function tanaOqi(req) {
  return new Promise((resolve, reject) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 5e6) req.destroy(); });
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch (e) { reject(e); } });
  });
}
function emailTop(req) {
  const t = req.headers['x-token'];
  return t ? sessiyalar.get(String(t)) : undefined;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/holat') return json(res, 200, { lokal: true });

    if (url.pathname === '/api/kirish' && req.method === 'POST') {
      const { email, parol } = await tanaOqi(req);
      const r = await db.query('SELECT parol_hash FROM lokal_auth WHERE lower(email)=lower($1)', [email]);
      if (!r.rows.length || !tekshir(parol, r.rows[0].parol_hash)) return json(res, 401, { error: "Login yoki parol noto'g'ri" });
      const token = randomBytes(24).toString('hex');
      sessiyalar.set(token, email.toLowerCase());
      return json(res, 200, { token, email: email.toLowerCase() });
    }
    if (url.pathname === '/api/chiqish' && req.method === 'POST') {
      const t = req.headers['x-token'];
      if (t) sessiyalar.delete(String(t));
      return json(res, 200, { ok: true });
    }

    const email = emailTop(req);
    if (url.pathname.startsWith('/api/') && !email) return json(res, 401, { error: 'Kirish kerak' });

    if (url.pathname === '/api/sorov' && req.method === 'POST') {
      const b = await tanaOqi(req);
      try {
        const natija = await foydalanuvchiSifatida(email, (tx) => sorovBajar(tx, b));
        return json(res, 200, natija);
      } catch (e) {
        const code = String(e.message).includes('row-level security') ? '42501' : (e.code ?? 'XATO');
        return json(res, 200, { error: { message: e.message, code } });
      }
    }
    if (url.pathname === '/api/rpc' && req.method === 'POST') {
      const { nom, params } = await tanaOqi(req);
      if (!RPCLAR[nom]) return json(res, 200, { error: { message: 'Nomalum funksiya: ' + nom } });
      const arglar = RPCLAR[nom].filter((k) => params && params[k] !== undefined);
      const sql = `SELECT ${nom}(${arglar.map((k, i) => `${k} := $${i + 1}`).join(', ')}) AS natija`;
      try {
        const r = await foydalanuvchiSifatida(email, (tx) => tx.query(sql, arglar.map((k) => params[k])));
        return json(res, 200, { data: r.rows[0]?.natija ?? null });
      } catch (e) {
        return json(res, 200, { error: { message: e.message, code: e.code ?? 'XATO' } });
      }
    }
    if (url.pathname === '/api/signup' && req.method === 'POST') {
      const { email: yangi, parol } = await tanaOqi(req);
      const ruxsat = await foydalanuvchiSifatida(email, (tx) => tx.query('SELECT has_manage() r'));
      if (!ruxsat.rows[0].r) return json(res, 200, { error: { message: 'Huquq yoq' } });
      const bor = await db.query('SELECT 1 FROM lokal_auth WHERE lower(email)=lower($1)', [yangi]);
      if (bor.rows.length) return json(res, 200, { error: { message: 'Bu login band' } });
      await db.query('INSERT INTO lokal_auth (email, parol_hash) VALUES ($1, $2)', [yangi.toLowerCase(), hashla(parol)]);
      return json(res, 200, { ok: true });
    }
    if (url.pathname === '/api/parol' && req.method === 'POST') {
      // o'z parolini almashtirish
      const { eski, yangi } = await tanaOqi(req);
      const r = await db.query('SELECT parol_hash FROM lokal_auth WHERE email=$1', [email]);
      if (!r.rows.length || !tekshir(eski, r.rows[0].parol_hash)) return json(res, 200, { error: { message: "Eski parol noto'g'ri" } });
      await db.query('UPDATE lokal_auth SET parol_hash=$1 WHERE email=$2', [hashla(yangi), email]);
      return json(res, 200, { ok: true });
    }
    if (url.pathname === '/api/zaxira') {
      const ruxsat = await foydalanuvchiSifatida(email, (tx) => tx.query('SELECT is_superadmin() r'));
      if (!ruxsat.rows[0].r) return json(res, 403, { error: 'Faqat bosh admin' });
      const jadvallar = (await db.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ('_migratsiyalar','lokal_auth')`)).rows;
      const dump = { vaqt: new Date().toISOString(), jadvallar: {} };
      for (const j of jadvallar) dump.jadvallar[j.tablename] = (await db.query(`SELECT * FROM ${j.tablename}`)).rows;
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="crm_zaxira_${new Date().toISOString().slice(0, 10)}.json"`,
      });
      return res.end(JSON.stringify(dump));
    }

    // ---- statik fayllar (dist) ----
    let fayl = url.pathname === '/' ? '/index.html' : url.pathname;
    const toliq = path.join(ROOT, 'dist', fayl);
    if (existsSync(toliq) && !toliq.includes('..')) {
      res.writeHead(200, { 'Content-Type': MIME[path.extname(toliq)] ?? 'application/octet-stream' });
      return res.end(readFileSync(toliq));
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(readFileSync(path.join(ROOT, 'dist', 'index.html')));
  } catch (e) {
    return json(res, 500, { error: String(e.message) });
  }
});

await tayyorla();
server.listen(PORT, '0.0.0.0', () => {
  console.log('============================================');
  console.log(`  IELTSBridge CRM LOKAL rejimda ishlamoqda`);
  console.log(`  Shu kompyuterda:  http://localhost:${PORT}`);
  console.log(`  Boshqa kompyuterdan (bir Wi-Fi da): http://<bu-kompyuter-IP>:${PORT}`);
  console.log(`  To'xtatish: Ctrl+C`);
  console.log('============================================');
});
