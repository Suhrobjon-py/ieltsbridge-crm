import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { sana, holat, riskHolat, WINBACK_BOSQICHLAR } from '../lib/format';
import Modal from '../components/Modal';
import Badge from '../components/Badge';

export default function Students() {
  const [rows, setRows] = useState<any[]>([]);
  const [risk, setRisk] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [tab, setTab] = useState<'faol' | 'ketgan'>('faol');
  const [qidiruv, setQidiruv] = useState('');
  const [modal, setModal] = useState(false);
  const [f, setF] = useState<any>({ first_name: '', last_name: '', phone: '', parent_name: '', parent_phone: '', current_level_code: '', birth_date: '' });
  const [xato, setXato] = useState('');

  async function load() {
    const [s, r] = await Promise.all([
      supabase.from('students').select('*').order('id', { ascending: false }).limit(500),
      supabase.from('v_student_risk').select('*'),
    ]);
    setRows(s.data ?? []);
    setRisk(r.data ?? []);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    supabase.from('levels').select('code,name').order('sort_order').then(({ data }) => setLevels(data ?? []));
  }, []);

  // har o'quvchi uchun eng past score (bir nechta guruh bo'lsa)
  const riskMap = useMemo(() => {
    const m: Record<string, any> = {};
    for (const r of risk) {
      if (!m[r.student_id] || r.score < m[r.student_id].score) m[r.student_id] = r;
    }
    return m;
  }, [risk]);

  const filtrlangan = rows.filter((r) => {
    if (tab === 'faol' ? r.status === 'ketgan' : r.status !== 'ketgan') return false;
    if (qidiruv.trim()) {
      const q = qidiruv.trim().toLowerCase();
      if (!`${r.first_name} ${r.last_name} ${r.phone} ${r.id}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const ketganlar = rows.filter((r) => r.status === 'ketgan');
  const winStat = useMemo(() => ({
    aloqa: ketganlar.filter((s) => s.winback).length,
    qiziqdi: ketganlar.filter((s) => ['qiziqdi', 'taklif_berildi', 'qaytdi'].includes(s.winback)).length,
    qaytdi: ketganlar.filter((s) => s.winback === 'qaytdi').length,
  }), [rows]);

  async function saqla(e: React.FormEvent) {
    e.preventDefault();
    setXato('');
    const body = { ...f, current_level_code: f.current_level_code || null, birth_date: f.birth_date || null, parent_name: f.parent_name || null, parent_phone: f.parent_phone || null };
    const { error } = await supabase.from('students').insert(body);
    if (error) return setXato(error.message);
    setModal(false);
    setF({ first_name: '', last_name: '', phone: '', parent_name: '', parent_phone: '', current_level_code: '', birth_date: '' });
    load();
  }

  async function winbackOzgar(id: string, v: string) {
    const body: any = { winback: v || null };
    if (v === 'qaytdi') body.status = 'faol';
    const { error } = await supabase.from('students').update(body).eq('id', id);
    if (error) return alert('Xato: ' + error.message);
    load();
    if (v === 'qaytdi') alert("O'quvchi FAOL holatga qaytarildi 🎉 — endi uni guruhga qayta biriktiring.");
  }

  return (
    <div>
      <div className="page-head">
        <h1>O'quvchilar</h1>
        <div className="row-gap">
          <input className="search" placeholder="Qidirish: ism, telefon, ID…" value={qidiruv} onChange={(e) => setQidiruv(e.target.value)} />
          <button className="btn" onClick={() => setModal(true)}>+ Yangi o'quvchi</button>
        </div>
      </div>

      <div className="tabs">
        <button className={tab === 'faol' ? 'tab on' : 'tab'} onClick={() => setTab('faol')}>O'quvchilar ({rows.filter((r) => r.status !== 'ketgan').length})</button>
        <button className={tab === 'ketgan' ? 'tab on' : 'tab'} onClick={() => setTab('ketgan')}>Ketganlar / Qaytarish ({ketganlar.length})</button>
      </div>

      {tab === 'ketgan' && ketganlar.length > 0 && (
        <div className="stat-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="stat-card"><div className="stat-n">{ketganlar.length}</div><div className="stat-t">Ketganlar</div></div>
          <div className="stat-card"><div className="stat-n">{winStat.aloqa}</div><div className="stat-t">Aloqa qilingan</div></div>
          <div className="stat-card"><div className="stat-n">{winStat.qiziqdi}</div><div className="stat-t">Qiziqqan</div></div>
          <div className="stat-card"><div className="stat-n" style={{ color: '#22c55e' }}>{winStat.qaytdi}</div><div className="stat-t">Qaytgan · {ketganlar.length ? Math.round((100 * winStat.qaytdi) / ketganlar.length) : 0}%</div></div>
        </div>
      )}

      <div className="card">
        <table>
          {tab === 'faol' ? (
            <>
              <thead><tr><th>ID</th><th>Ism-familiya</th><th>Telefon</th><th>Bosqich</th><th>Holat</th><th>Xavf bali</th><th>Kelgan</th></tr></thead>
              <tbody>
                {filtrlangan.map((r) => {
                  const rk = riskMap[r.id];
                  return (
                    <tr key={r.id}>
                      <td className="mono">{r.id}</td>
                      <td><Link to={`/oquvchilar/${r.id}`}><b>{r.first_name} {r.last_name}</b></Link></td>
                      <td className="mono">{r.phone}</td>
                      <td>{r.current_level_code ?? '—'}</td>
                      <td><Badge s={r.status} /></td>
                      <td>
                        {rk ? (
                          <span className={'badge badge-' + riskHolat(rk.score).rang}
                            title={`14 kunda qoldirgan: ${rk.kelmagan_14} · ketma-ket: ${rk.ketma_ket} · qarz: ${rk.qarz_bor ? 'bor' : "yo'q"}`}>
                            {rk.score} · {riskHolat(rk.score).label}
                          </span>
                        ) : <span className="muted small">guruhsiz</span>}
                      </td>
                      <td>{sana(r.joined_at)}</td>
                    </tr>
                  );
                })}
                {filtrlangan.length === 0 && <tr><td colSpan={7} className="muted">O'quvchi topilmadi.</td></tr>}
              </tbody>
            </>
          ) : (
            <>
              <thead><tr><th>ID</th><th>Ism-familiya</th><th>Telefon</th><th>Ketgan sana</th><th>Sabab</th><th>Qaytarish bosqichi</th></tr></thead>
              <tbody>
                {filtrlangan.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.id}</td>
                    <td><Link to={`/oquvchilar/${r.id}`}><b>{r.first_name} {r.last_name}</b></Link></td>
                    <td className="mono">{r.phone}</td>
                    <td>{sana(r.churned_at)}</td>
                    <td>{r.churn_reason ? holat(r.churn_reason) : '—'}</td>
                    <td>
                      <select className="sel-inline" value={r.winback ?? ''} onChange={(e) => winbackOzgar(r.id, e.target.value)}>
                        <option value="">— Boshlanmagan —</option>
                        {WINBACK_BOSQICHLAR.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
                {filtrlangan.length === 0 && <tr><td colSpan={6} className="muted">Ketgan o'quvchi yo'q 🎉</td></tr>}
              </tbody>
            </>
          )}
        </table>
      </div>

      {modal && (
        <Modal title="Yangi o'quvchi" onClose={() => setModal(false)}>
          <form onSubmit={saqla} className="form-grid">
            <label>Ismi<input value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} required autoFocus /></label>
            <label>Familiyasi<input value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} required /></label>
            <label>Telefon<input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} required /></label>
            <label>Tug'ilgan sana<input type="date" value={f.birth_date} onChange={(e) => setF({ ...f, birth_date: e.target.value })} /></label>
            <label>Ota-ona ismi<input value={f.parent_name} onChange={(e) => setF({ ...f, parent_name: e.target.value })} /></label>
            <label>Ota-ona telefoni<input value={f.parent_phone} onChange={(e) => setF({ ...f, parent_phone: e.target.value })} /></label>
            <label>Bosqich
              <select value={f.current_level_code} onChange={(e) => setF({ ...f, current_level_code: e.target.value })}>
                <option value="">— Tanlanmagan —</option>
                {levels.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
              </select>
            </label>
            {xato && <div className="err span2">{xato}</div>}
            <button className="btn span2">Saqlash</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
