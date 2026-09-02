// ============================================================
// LOKAL BAZAGA DEMO MARKAZ YUKLASH
// 400 o'quvchi · 250 lid · 36 guruh · 14 o'qituvchi · 8 xona
// Ishga tushirish (server O'CHIQ bo'lishi kerak!):
//   node server/demo_yukla.mjs
// Avval eski operatsion ma'lumotlar tozalanadi (kontent va loginlar qoladi).
// ============================================================
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new PGlite(path.join(ROOT, 'lokal_baza'));

// baza hali yaratilmagan bo'lsa — xuddi serverdagidek tayyorlash
const bor = await db.query(`SELECT 1 FROM pg_roles WHERE rolname='authenticated'`);
if (!bor.rows.length) {
  console.log('Baza birinchi marta yaratilmoqda...');
  await db.exec('CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;');
  await db.exec(`CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT NULL::uuid';
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;`);
  await db.exec(`CREATE TABLE _migratsiyalar (nom TEXT PRIMARY KEY, vaqt TIMESTAMPTZ DEFAULT now());
    CREATE TABLE lokal_auth (email TEXT PRIMARY KEY, parol_hash TEXT NOT NULL);`);
}
for (const f of readdirSync(path.join(ROOT, 'supabase', 'migrations')).sort()) {
  const bormi = await db.query('SELECT 1 FROM _migratsiyalar WHERE nom=$1', [f]);
  if (bormi.rows.length) continue;
  console.log('Migratsiya:', f);
  await db.exec(readFileSync(path.join(ROOT, 'supabase', 'migrations', f), 'utf8'));
  await db.query('INSERT INTO _migratsiyalar (nom) VALUES ($1)', [f]);
}

console.log('1/3 Eski operatsion malumotlar tozalanmoqda...');
await db.exec(readFileSync(path.join(ROOT, 'supabase', 'tozalash_test_malumotlari.sql'), 'utf8'));

console.log('2/3 Demo markaz yuklanmoqda (bir necha soniya)...');
const t0 = Date.now();
const res = await db.exec(readFileSync(path.join(ROOT, 'supabase', 'demo_katta.sql'), 'utf8'));
console.log(`   yuklandi (${Math.round((Date.now() - t0) / 1000)}s)`);

console.log('3/3 Hisobot:');
const r = res[res.length - 1].rows[0];
for (const [k, v] of Object.entries(r)) console.log(`   ${k}: ${v}`);
await db.close();
console.log('TAYYOR! Endi "CRM LOKAL.bat" bilan ishga tushiring (admin / admin123).');
