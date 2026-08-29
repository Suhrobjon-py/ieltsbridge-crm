import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { sana, holat, bugunISO, TRIAL_HOLATLAR, NOSHOW_SABABLAR } from '../lib/format';
import Modal from '../components/Modal';

export default function Trials() {
  const [rows, setRows] = useState<any[]>([]);
  const [tab, setTab] = useState<'hammasi' | 'bugun' | 'kelmadi'>('hammasi');
  const [noshow, setNoshow] = useState<any>(null);
  const [nsSabab, setNsSabab] = useState('');
  const [qayta, setQayta] = useState<any>(null);
  const [qSana, setQSana] = useState('');
  const [qVaqt, setQVaqt] = useState('18:00');
  const [feedback, setFeedback] = useState<any>(null);
  const [fbMatn, setFbMatn] = useState('');

  async function load() {
    const { data } = await supabase.from('trials')
      .select('*, leads(id, first_name, last_name, phone, subject, manager), groups(id), teachers(full_name)')
      .order('trial_date', { ascending: false }).limit(400);
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  const bugun = bugunISO();
  const stat = useMemo(() => {
    const oy30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const oxirgi = rows.filter((t) => t.trial_date >= oy30 && t.trial_date <= bugun);
    const yakun = oxirgi.filter((t) => ['keldi', 'kelmadi', 'muvaffaqiyatli', 'sotuvga_otkazildi'].includes(t.status));
    const keldi = yakun.filter((t) => t.status !== 'kelmadi').length;
    const kelmadi = yakun.filter((t) => t.status === 'kelmadi').length;
    const sabablar: Record<string, number> = {};
    for (const t of rows.filter((x) => x.status === 'kelmadi' && x.noshow_reason)) {
      sabablar[t.noshow_reason] = (sabablar[t.noshow_reason] ?? 0) + 1;
    }
    const topSabab = Object.entries(sabablar).sort((a, b) => b[1] - a[1])[0];
    return {
      booked: oxirgi.length, keldi, kelmadi,
      rate: keldi + kelmadi > 0 ? Math.round((100 * keldi) / (keldi + kelmadi)) : null,
      sabablar: Object.entries(sabablar).sort((a, b) => b[1] - a[1]),
      topSabab,
    };
  }, [rows]);

  const korsat = rows.filter((t) => {
    if (tab === 'bugun') return t.trial_date === bugun && !['kelmadi', 'sotuvga_otkazildi'].includes(t.status);
    if (tab === 'kelmadi') return t.status === 'kelmadi';
    return true;
  });

  async function holatOzgar(t: any, status: string) {
    if (status === 'kelmadi') { setNoshow(t); setNsSabab(''); return; }
    if (status === 'qayta_yozildi') { setQayta(t); setQSana(bugun); setQVaqt(String(t.trial_time ?? '18:00').slice(0, 5)); return; }
    const { error } = await supabase.from('trials').update({ status }).eq('id', t.id);
    if (error) return alert('Xato: ' + error.message);
    load();
  }

  async function noshowSaqla(e: React.FormEvent) {
    e.preventDefault();
    if (!nsSabab) return;
    const { error } = await supabase.from('trials').update({ status: 'kelmadi', noshow_reason: nsSabab }).eq('id', noshow.id);
    if (error) return alert('Xato: ' + error.message);
    setNoshow(null);
    load();
  }

  async function qaytaSaqla(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from('trials').update({ status: 'qayta_yozildi' }).eq('id', qayta.id);
    const { error } = await supabase.from('trials').insert({
      lead_id: qayta.lead_id, group_id: qayta.group_id, teacher_id: qayta.teacher_id,
      trial_date: qSana, trial_time: qVaqt,
    });
    if (error) return alert('Xato: ' + error.message);
    setQayta(null);
    load();
  }

  async function fbSaqla(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from('trials').update({ feedback: fbMatn || null }).eq('id', feedback.id);
    if (error) return alert('Xato: ' + error.message);
    setFeedback(null);
    load();
  }

  const maxSabab = stat.sabablar[0]?.[1] ?? 1;

  return (
    <div>
      <div className="page-head"><h1>Sinov darslari</h1></div>

      <div className="stat-row">
        <div className="stat-card"><div className="stat-n">{stat.booked}</div><div className="stat-t">Yozilgan (30 kun)</div></div>
        <div className="stat-card"><div className="stat-n" style={{ color: '#22c55e' }}>{stat.keldi}</div><div className="stat-t">Kelgan</div></div>
        <div className="stat-card"><div className="stat-n" style={{ color: '#ef4444' }}>{stat.kelmadi}</div><div className="stat-t">Kelmaganlar</div></div>
        <div className="stat-card"><div className="stat-n">{stat.rate !== null ? stat.rate + '%' : '—'}</div><div className="stat-t">Kelish darajasi</div></div>
      </div>

      {stat.topSabab && stat.rate !== null && stat.rate < 75 && (
        <div className="insight">
          💡 <b>Xulosa:</b> Sinovga kelmaslik darajasi yuqori ({100 - stat.rate}%). Eng asosiy sabab: <b>{holat(stat.topSabab[0])}</b> ({stat.topSabab[1]} marta).
          {stat.topSabab[0] === 'vaqt_mos_kelmadi' && " Tavsiya: kechki va dam olish kunlari uchun sinov slotlarini ko'paytiring."}
          {stat.topSabab[0] === 'unutgan' && ' Tavsiya: sinovdan bir kun oldin va 2 soat oldin eslatma yuborishni yo‘lga qo‘ying.'}
        </div>
      )}

      {stat.sabablar.length > 0 && (
        <div className="card">
          <h2>Kelmaslik sabablari</h2>
          {stat.sabablar.map(([s, n]) => (
            <div key={s} className="hbar-row">
              <span className="hbar-label">{holat(s)}</span>
              <div className="hbar"><div className="hbar-fill" style={{ width: `${(n / maxSabab) * 100}%`, background: '#ef4444' }} /></div>
              <b>{n}</b>
            </div>
          ))}
        </div>
      )}

      <div className="tabs">
        <button className={tab === 'hammasi' ? 'tab on' : 'tab'} onClick={() => setTab('hammasi')}>Hammasi ({rows.length})</button>
        <button className={tab === 'bugun' ? 'tab on' : 'tab'} onClick={() => setTab('bugun')}>Bugun ({rows.filter((t) => t.trial_date === bugun && !['kelmadi', 'sotuvga_otkazildi'].includes(t.status)).length})</button>
        <button className={tab === 'kelmadi' ? 'tab on' : 'tab'} onClick={() => setTab('kelmadi')}>Kelmaganlar ({rows.filter((t) => t.status === 'kelmadi').length})</button>
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Sana</th><th>Vaqt</th><th>O'quvchi</th><th>Telefon</th><th>Fan</th><th>Guruh</th><th>O'qituvchi</th><th>Menejer</th><th>Holat</th>{tab === 'kelmadi' && <th>Sabab</th>}<th>Feedback</th></tr></thead>
          <tbody>
            {korsat.map((t) => (
              <tr key={t.id} className={t.trial_date === bugun ? 'today' : ''}>
                <td>{sana(t.trial_date)}{t.trial_date === bugun ? ' · BUGUN' : ''}</td>
                <td>{t.trial_time ? String(t.trial_time).slice(0, 5) : '—'}</td>
                <td><b>{t.leads?.first_name} {t.leads?.last_name}</b></td>
                <td className="mono">{t.leads?.phone}</td>
                <td>{t.leads?.subject ?? '—'}</td>
                <td className="mono small">{t.group_id ?? '—'}</td>
                <td>{t.teachers?.full_name ?? '—'}</td>
                <td>{t.leads?.manager ?? '—'}</td>
                <td>
                  <select className="sel-inline" value={t.status} onChange={(e) => holatOzgar(t, e.target.value)}>
                    {TRIAL_HOLATLAR.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </td>
                {tab === 'kelmadi' && <td className="red small">{t.noshow_reason ? holat(t.noshow_reason) : '—'}</td>}
                <td>
                  <button className="btn-ghost small" onClick={() => { setFeedback(t); setFbMatn(t.feedback ?? ''); }}>
                    {t.feedback ? '📝 bor' : '+ yozish'}
                  </button>
                </td>
              </tr>
            ))}
            {korsat.length === 0 && <tr><td colSpan={11} className="muted">Sinov darsi yo'q. Lidlar sahifasida "Sinovga yozish" tugmasidan foydalaning.</td></tr>}
          </tbody>
        </table>
      </div>

      {noshow && (
        <Modal title={`Sinovga kelmadi — ${noshow.leads?.first_name} ${noshow.leads?.last_name}`} onClose={() => setNoshow(null)}>
          <form onSubmit={noshowSaqla} className="form-grid">
            <label className="span2">Sabab (majburiy)
              <select value={nsSabab} onChange={(e) => setNsSabab(e.target.value)} required>
                <option value="">— Tanlang —</option>
                {NOSHOW_SABABLAR.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <p className="muted small span2">Sabab analitikaga saqlanadi — tizim eng ko'p uchraydigan muammoni avtomatik aniqlaydi.</p>
            <button className="btn span2" disabled={!nsSabab}>Saqlash</button>
          </form>
        </Modal>
      )}

      {qayta && (
        <Modal title="Sinovni qayta belgilash" onClose={() => setQayta(null)}>
          <form onSubmit={qaytaSaqla} className="form-grid">
            <label>Yangi sana<input type="date" value={qSana} onChange={(e) => setQSana(e.target.value)} required /></label>
            <label>Vaqt<input type="time" value={qVaqt} onChange={(e) => setQVaqt(e.target.value)} required /></label>
            <p className="muted small span2">Eski yozuv "Qayta yozildi" bo'ladi, yangi sana bilan yangi sinov ochiladi.</p>
            <button className="btn span2">Belgilash</button>
          </form>
        </Modal>
      )}

      {feedback && (
        <Modal title="Sinov darsi fikri" onClose={() => setFeedback(null)}>
          <form onSubmit={fbSaqla} className="form-grid">
            <label className="span2">O'qituvchi fikri
              <textarea value={fbMatn} onChange={(e) => setFbMatn(e.target.value)} rows={3} placeholder="Darsdagi taassurot, saviya, tavsiya..." />
            </label>
            <button className="btn span2">Saqlash</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
