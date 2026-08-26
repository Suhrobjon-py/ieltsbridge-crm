import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { som, sana, joriyDavr, qisqaSom, oyNomi } from '../lib/format';

// Rang palitras (dataviz validatoridan o'tgan: CVD-xavfsiz)
const RANG = { tushum: '#2e63b8', chiqim: '#d97706', foyda: '#0d9488' };

type OyHisobot = {
  davr: string;
  hisoblangan: number;
  tushum: number;
  maosh: number;
  xarajat: number;
  chiqim: number;
  foyda: number;
  yangi: number;
};

export default function Reports() {
  const [davr, setDavr] = useState(joriyDavr());
  const [payments, setPayments] = useState<any[]>([]);
  const [salaries, setSalaries] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [yuklandi, setYuklandi] = useState(false);
  const [kalkTeacher, setKalkTeacher] = useState('');
  const [kalkCount, setKalkCount] = useState<number | null>(null);
  const [kalkRate, setKalkRate] = useState<number | ''>('');

  async function load() {
    const [p, s, e, st, t] = await Promise.all([
      supabase.from('payments').select('period, amount_due, amount_paid'),
      supabase.from('teacher_salaries').select('teacher_id, period, amount, paid_at'),
      supabase.from('expenses').select('name, amount, spent_at'),
      supabase.from('students').select('joined_at'),
      supabase.from('teachers').select('id, full_name').eq('status', 'faol').order('id'),
    ]);
    setPayments(p.data ?? []);
    setSalaries(s.data ?? []);
    setExpenses(e.data ?? []);
    setStudents(st.data ?? []);
    setTeachers(t.data ?? []);
    setYuklandi(true);
  }
  useEffect(() => { load(); }, []);

  // Kalkulyator: tanlangan o'qituvchining faol o'quvchilari sonini avtomatik yig'ish
  useEffect(() => {
    if (!kalkTeacher) { setKalkCount(null); return; }
    (async () => {
      setKalkCount(null);
      const { data: gs } = await supabase.from('groups').select('id')
        .or(`teacher_id.eq.${kalkTeacher},support_teacher_id.eq.${kalkTeacher}`)
        .in('status', ['rejada', 'faol', 'imtihon']);
      const ids = (gs ?? []).map((g: any) => g.id);
      if (!ids.length) { setKalkCount(0); return; }
      const { count } = await supabase.from('enrollments').select('id', { count: 'exact', head: true })
        .eq('status', 'faol').in('group_id', ids);
      setKalkCount(count ?? 0);
    })();
  }, [kalkTeacher]);

  // Oylik yig'ma hisobotlar
  const oylar: OyHisobot[] = useMemo(() => {
    const map: Record<string, OyHisobot> = {};
    const oy = (d: string): OyHisobot => {
      if (!map[d]) map[d] = { davr: d, hisoblangan: 0, tushum: 0, maosh: 0, xarajat: 0, chiqim: 0, foyda: 0, yangi: 0 };
      return map[d];
    };
    for (const p of payments) {
      const o = oy(p.period);
      o.hisoblangan += Number(p.amount_due);
      o.tushum += Number(p.amount_paid);
    }
    for (const s of salaries) oy(s.period).maosh += Number(s.amount);
    for (const e of expenses) oy(String(e.spent_at).slice(0, 7)).xarajat += Number(e.amount);
    for (const s of students) if (s.joined_at) oy(String(s.joined_at).slice(0, 7)).yangi += 1;
    oy(davr);
    for (const o of Object.values(map)) {
      o.chiqim = o.maosh + o.xarajat;
      o.foyda = o.tushum - o.chiqim;
    }
    return Object.values(map).sort((a, b) => a.davr.localeCompare(b.davr));
  }, [payments, salaries, expenses, students, davr]);

  const joriy = oylar.find((o) => o.davr === davr) ?? { davr, hisoblangan: 0, tushum: 0, maosh: 0, xarajat: 0, chiqim: 0, foyda: 0, yangi: 0 };
  const grafikOylar = oylar.slice(-6);
  const oyXarajatlari = expenses
    .filter((e) => String(e.spent_at).slice(0, 7) === davr)
    .sort((a, b) => String(b.spent_at).localeCompare(String(a.spent_at)));
  const oyMaoshlari = salaries.filter((s) => s.period === davr);

  async function maoshTola() {
    if (!kalkTeacher || kalkCount === null || kalkRate === '' || Number(kalkRate) <= 0) return;
    const jamiSumma = kalkCount * Number(kalkRate);
    const { error } = await supabase.from('teacher_salaries').upsert({
      teacher_id: kalkTeacher,
      period: davr,
      amount: jamiSumma,
      student_count: kalkCount,
      rate: Number(kalkRate),
      paid_at: new Date().toISOString().slice(0, 10),
    }, { onConflict: 'teacher_id,period' });
    if (error) return alert('Xato: ' + error.message);
    alert(`${teachers.find((t) => t.id === kalkTeacher)?.full_name}: ${kalkCount} o'quvchi × ${som(Number(kalkRate))} = ${som(jamiSumma)} — ${davr} uchun yozildi.`);
    setKalkRate('');
    load();
  }

  return (
    <div>
      <div className="screen-only">
        <div className="page-head">
          <h1>Hisobotlar</h1>
          <div className="row-gap">
            <input type="month" value={davr} onChange={(e) => setDavr(e.target.value)} />
            <button className="btn" onClick={() => window.print()}>🖨 Chop etish</button>
          </div>
        </div>

        <div className="stat-row">
          <div className="stat-card"><div className="stat-n" style={{ color: RANG.tushum }}>{som(joriy.tushum)}</div><div className="stat-t">Tushum ({davr})</div></div>
          <div className="stat-card"><div className="stat-n" style={{ color: RANG.chiqim }}>{som(joriy.maosh)}</div><div className="stat-t">O'qituvchi maoshlari</div></div>
          <div className="stat-card"><div className="stat-n" style={{ color: RANG.chiqim }}>{som(joriy.xarajat)}</div><div className="stat-t">Boshqa xarajatlar</div></div>
          <div className="stat-card"><div className="stat-n" style={{ color: joriy.foyda >= 0 ? RANG.foyda : '#dc2626' }}>{som(joriy.foyda)}</div><div className="stat-t">Sof foyda</div></div>
        </div>

        <div className="card">
          <div className="row-between">
            <h2>Oylar taqqoslash (oxirgi {grafikOylar.length} oy)</h2>
            <div className="legend">
              <span className="legend-chip"><i style={{ background: RANG.tushum }} />Tushum</span>
              <span className="legend-chip"><i style={{ background: RANG.chiqim }} />Chiqim</span>
              <span className="legend-chip"><i style={{ background: RANG.foyda }} />Foyda</span>
            </div>
          </div>
          {yuklandi && <BarChart oylar={grafikOylar} />}
        </div>

        <div className="grid2">
          <div className="card">
            <h2>O'qituvchi maoshini hisoblash — {davr}</h2>
            <div className="form-grid">
              <label>O'qituvchi
                <select value={kalkTeacher} onChange={(e) => setKalkTeacher(e.target.value)}>
                  <option value="">— Tanlang —</option>
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </label>
              <label>Bir o'quvchi uchun summa (so'm)
                <input type="number" value={kalkRate} onChange={(e) => setKalkRate(e.target.value === '' ? '' : Number(e.target.value))} min="0" step="1" />
              </label>
            </div>
            {kalkTeacher && (
              <div className="kalk-line">
                <span><b>{kalkCount ?? '…'}</b> o'quvchi × <b>{kalkRate === '' ? '_____' : som(Number(kalkRate))}</b> =</span>
                <span className="kalk-total">{kalkCount !== null && kalkRate !== '' ? som(kalkCount * Number(kalkRate)) : '—'}</span>
                <button className="btn" disabled={kalkCount === null || kalkRate === '' || Number(kalkRate) <= 0} onClick={maoshTola}>To'lash va yozish</button>
              </div>
            )}
            <p className="muted small">
              O'quvchilar soni o'qituvchining faol guruhlaridagi faol o'quvchilardan avtomatik yig'iladi.
              To'langan maosh Xarajatlar bo'limida ham ko'rinadi. Xato bo'lsa — shu o'qituvchini qayta tanlab,
              to'g'ri stavka bilan qayta to'lang: shu oy yozuvi almashadi.
            </p>
            <table>
              <thead><tr><th>To'langan ({davr})</th><th>O'quvchi</th><th>Stavka</th><th>Summa</th><th>Sana</th></tr></thead>
              <tbody>
                {oyMaoshlari.map((m) => (
                  <tr key={m.teacher_id}>
                    <td><b>{teachers.find((t) => t.id === m.teacher_id)?.full_name ?? m.teacher_id}</b></td>
                    <td>{m.student_count ?? '—'}</td>
                    <td>{m.rate ? som(m.rate) : '—'}</td>
                    <td><b>{som(m.amount)}</b></td>
                    <td>{sana(m.paid_at)}</td>
                  </tr>
                ))}
                {oyMaoshlari.length === 0 && <tr><td colSpan={5} className="muted">Bu oyda hali maosh to'lanmagan.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="row-between">
              <h2>Xarajatlar — {davr}</h2>
              <Link to="/xarajatlar" className="btn-sm">Boshqarish →</Link>
            </div>
            <table>
              <thead><tr><th>Sana</th><th>Nomi</th><th>Miqdori</th></tr></thead>
              <tbody>
                {oyXarajatlari.map((e, i) => (
                  <tr key={i}><td>{sana(e.spent_at)}</td><td>{e.name}</td><td>{som(e.amount)}</td></tr>
                ))}
                {oyXarajatlari.length === 0 && <tr><td colSpan={3} className="muted">Bu oyda xarajat yozuvi yo'q.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2>Oyma-oy jadval</h2>
          <table>
            <thead><tr><th>Oy</th><th>Hisoblangan</th><th>Tushum</th><th>Maoshlar</th><th>Xarajatlar</th><th>Sof foyda</th><th>Yangi o'quvchilar</th></tr></thead>
            <tbody>
              {[...oylar].reverse().slice(0, 12).map((o) => (
                <tr key={o.davr} className={o.davr === davr ? 'today' : ''}>
                  <td className="mono"><b>{o.davr}</b></td>
                  <td>{som(o.hisoblangan)}</td>
                  <td>{som(o.tushum)}</td>
                  <td>{som(o.maosh)}</td>
                  <td>{som(o.xarajat)}</td>
                  <td style={{ color: o.foyda >= 0 ? RANG.foyda : '#dc2626', fontWeight: 700 }}>{som(o.foyda)}</td>
                  <td>{o.yangi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================== CHOP ETISH KO'RINISHI ==================== */}
      <div className="print-only">
        <h1 style={{ marginBottom: 4 }}>IELTSBridge — oylik moliyaviy hisobot</h1>
        <p style={{ marginBottom: 16 }}>Davr: <b>{oyNomi(davr)} ({davr})</b> · Chop etilgan sana: {sana(new Date().toISOString().slice(0, 10))}</p>

        <h3>1. Umumiy ko'rsatkichlar</h3>
        <table className="print-table">
          <tbody>
            <tr><td>Hisoblangan to'lovlar</td><td>{som(joriy.hisoblangan)}</td></tr>
            <tr><td>Tushum (to'langan)</td><td>{som(joriy.tushum)}</td></tr>
            <tr><td>Qarzdorlik</td><td>{som(joriy.hisoblangan - joriy.tushum)}</td></tr>
            <tr><td>O'qituvchi maoshlari</td><td>{som(joriy.maosh)}</td></tr>
            <tr><td>Boshqa xarajatlar</td><td>{som(joriy.xarajat)}</td></tr>
            <tr><td>Jami chiqim</td><td>{som(joriy.chiqim)}</td></tr>
            <tr><td><b>Sof foyda</b></td><td><b>{som(joriy.foyda)}</b></td></tr>
            <tr><td>Yangi o'quvchilar</td><td>{joriy.yangi} ta</td></tr>
          </tbody>
        </table>

        <h3>2. O'qituvchi maoshlari</h3>
        <table className="print-table">
          <thead><tr><th>O'qituvchi</th><th>Summa</th><th>To'langan sana</th></tr></thead>
          <tbody>
            {teachers.map((t) => {
              const s = oyMaoshlari.find((x) => x.teacher_id === t.id);
              return <tr key={t.id}><td>{t.full_name}</td><td>{s ? som(s.amount) : '—'}</td><td>{s ? sana(s.paid_at) : '—'}</td></tr>;
            })}
            <tr><td><b>Jami</b></td><td colSpan={2}><b>{som(joriy.maosh)}</b></td></tr>
          </tbody>
        </table>

        <h3>3. Boshqa xarajatlar</h3>
        <table className="print-table">
          <thead><tr><th>Sana</th><th>Nomi</th><th>Miqdori</th></tr></thead>
          <tbody>
            {oyXarajatlari.map((e, i) => (
              <tr key={i}><td>{sana(e.spent_at)}</td><td>{e.name}</td><td>{som(e.amount)}</td></tr>
            ))}
            <tr><td colSpan={2}><b>Jami</b></td><td><b>{som(joriy.xarajat)}</b></td></tr>
          </tbody>
        </table>

        <h3>4. Oylar taqqoslash</h3>
        <table className="print-table">
          <thead><tr><th>Oy</th><th>Tushum</th><th>Maoshlar</th><th>Xarajatlar</th><th>Sof foyda</th><th>Yangi o'quvchilar</th></tr></thead>
          <tbody>
            {[...oylar].reverse().slice(0, 12).map((o) => (
              <tr key={o.davr}><td>{o.davr}</td><td>{som(o.tushum)}</td><td>{som(o.maosh)}</td><td>{som(o.xarajat)}</td><td>{som(o.foyda)}</td><td>{o.yangi}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==================== GRAFIK: guruhlangan ustunlar ====================

function BarChart({ oylar }: { oylar: OyHisobot[] }) {
  if (oylar.length === 0 || oylar.every((o) => !o.tushum && !o.chiqim)) {
    return <p className="muted">Grafik uchun hali ma'lumot yo'q — to'lovlar va xarajatlar kiritilgach paydo bo'ladi.</p>;
  }
  const W = 720, H = 260, L = 62, R = 8, T = 12, B = 30;
  const plotW = W - L - R, plotH = H - T - B;
  const maxV = Math.max(1, ...oylar.map((o) => Math.max(o.tushum, o.chiqim, o.foyda)));
  const minV = Math.min(0, ...oylar.map((o) => o.foyda));
  const span = maxV - minV;
  const y = (v: number) => T + ((maxV - v) / span) * plotH;
  const y0 = y(0);

  // panjara chiziqlari uchun "yoqimli" qadam
  const step = niceStep(span / 4);
  const ticks: number[] = [];
  for (let t = Math.ceil(minV / step) * step; t <= maxV + 1e-9; t += step) ticks.push(t);

  const n = oylar.length;
  const groupW = plotW / n;
  const barW = Math.min(26, Math.max(10, (groupW - 28) / 3));
  const seriya: { key: 'tushum' | 'chiqim' | 'foyda'; nomi: string; rang: string }[] = [
    { key: 'tushum', nomi: 'Tushum', rang: RANG.tushum },
    { key: 'chiqim', nomi: 'Chiqim', rang: RANG.chiqim },
    { key: 'foyda', nomi: 'Foyda', rang: RANG.foyda },
  ];

  // baza chizig'iga yopishgan, faqat tashqi uchi 3px yumaloq ustun
  function barPath(x: number, v: number): string {
    const w = barW, r = Math.min(3, w / 2);
    if (Math.abs(v) < 1e-9) return '';
    const yt = y(v);
    if (v > 0) {
      const h = Math.max(1, y0 - yt);
      const yy = y0 - h;
      return `M${x},${y0} L${x},${yy + r} Q${x},${yy} ${x + r},${yy} L${x + w - r},${yy} Q${x + w},${yy} ${x + w},${yy + r} L${x + w},${y0} Z`;
    }
    const h = Math.max(1, yt - y0);
    const yy = y0 + h;
    return `M${x},${y0} L${x},${yy - r} Q${x},${yy} ${x + r},${yy} L${x + w - r},${yy} Q${x + w},${yy} ${x + w},${yy - r} L${x + w},${y0} Z`;
  }

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Oylik tushum, chiqim va foyda taqqoslash grafigi">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={t === 0 ? '#94a3b8' : '#e8edf3'} strokeWidth={t === 0 ? 1.2 : 1} />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#64748b">{qisqaSom(t)}</text>
          </g>
        ))}
        {oylar.map((o, i) => {
          const gx = L + i * groupW;
          const startX = gx + (groupW - (barW * 3 + 4)) / 2;
          return (
            <g key={o.davr}>
              {seriya.map((s, j) => (
                <path key={s.key} d={barPath(startX + j * (barW + 2), o[s.key])} fill={s.rang}>
                  <title>{`${oyNomi(o.davr)} · ${s.nomi}: ${som(o[s.key])}`}</title>
                </path>
              ))}
              <text x={gx + groupW / 2} y={H - 10} textAnchor="middle" fontSize="11.5" fill="#334155">{oyNomi(o.davr)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function niceStep(raw: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(1, raw))));
  const d = raw / pow;
  if (d <= 1) return pow;
  if (d <= 2) return 2 * pow;
  if (d <= 5) return 5 * pow;
  return 10 * pow;
}
