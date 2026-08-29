import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { som, sana, holat, riskHolat, CHURN_SABABLAR } from '../lib/format';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import Confirm from '../components/Confirm';
import { useRole } from '../lib/role';

export default function StudentDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { canDelete } = useRole();
  const superadmin = canDelete('oquvchilar');
  const [ochirTasdiq, setOchirTasdiq] = useState(false);
  const [s, setS] = useState<any>(null);
  const [azolik, setAzolik] = useState<any[]>([]);
  const [tolovlar, setTolovlar] = useState<any[]>([]);
  const [progress, setProgress] = useState<any[]>([]);
  const [natijalar, setNatijalar] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [tahrirModal, setTahrirModal] = useState(false);
  const [f, setF] = useState<any>(null);
  const [tXato, setTXato] = useState('');
  const [guruhModal, setGuruhModal] = useState(false);
  const [guruhlar, setGuruhlar] = useState<any[]>([]);
  const [tanlanganGuruh, setTanlanganGuruh] = useState('');
  const [chegirma, setChegirma] = useState(0);
  const [gXato, setGXato] = useState('');
  const [churnModal, setChurnModal] = useState(false);
  const [churnSabab, setChurnSabab] = useState('');
  const [riskRows, setRiskRows] = useState<any[]>([]);

  async function load() {
    const [st, en, pay, pr, ar, lv] = await Promise.all([
      supabase.from('students').select('*').eq('id', id).single(),
      supabase.from('enrollments').select('*, groups(id, level_code, status, start_time, days_pattern)').eq('student_id', id).order('enrolled_at', { ascending: false }),
      supabase.from('payments').select('*').eq('student_id', id).order('period', { ascending: false }),
      supabase.from('v_oquvchi_progress').select('*').eq('student_id', id),
      supabase.from('assessment_results').select('*, assessments(title)').eq('student_id', id).order('taken_at', { ascending: false }),
      supabase.from('levels').select('code, name').order('sort_order'),
    ]);
    setS(st.data);
    setAzolik(en.data ?? []);
    setTolovlar(pay.data ?? []);
    setProgress(pr.data ?? []);
    setNatijalar(ar.data ?? []);
    setLevels(lv.data ?? []);
    supabase.from('v_student_risk').select('*').eq('student_id', id).then(({ data }) => setRiskRows(data ?? []));
  }
  useEffect(() => { load(); }, [id]);

  async function holatOzgar(status: string) {
    if (status === 'ketgan') {
      setChurnSabab('');
      setChurnModal(true);
      return;
    }
    await supabase.from('students').update({ status }).eq('id', id);
    setS({ ...s, status });
  }

  async function churnSaqla(e: React.FormEvent) {
    e.preventDefault();
    if (!churnSabab) return;
    const { error } = await supabase.from('students').update({
      status: 'ketgan', churn_reason: churnSabab,
      churned_at: new Date().toISOString().slice(0, 10),
    }).eq('id', id);
    if (error) return alert('Xato: ' + error.message);
    setChurnModal(false);
    load();
  }

  function tahrirOch() {
    setTXato('');
    setF({
      first_name: s.first_name,
      last_name: s.last_name,
      phone: s.phone,
      birth_date: s.birth_date ?? '',
      parent_name: s.parent_name ?? '',
      parent_phone: s.parent_phone ?? '',
      source: s.source ?? '',
      current_level_code: s.current_level_code ?? '',
      joined_at: s.joined_at,
      note: s.note ?? '',
    });
    setTahrirModal(true);
  }

  async function tahrirSaqla(e: React.FormEvent) {
    e.preventDefault();
    setTXato('');
    const body = {
      ...f,
      birth_date: f.birth_date || null,
      parent_name: f.parent_name || null,
      parent_phone: f.parent_phone || null,
      source: f.source || null,
      current_level_code: f.current_level_code || null,
      note: f.note || null,
    };
    const { error } = await supabase.from('students').update(body).eq('id', id);
    if (error) return setTXato(error.message);
    setTahrirModal(false);
    load();
  }

  async function guruhOch() {
    setGXato('');
    const { data } = await supabase.from('groups').select('id, level_code, status, start_time, days_pattern').in('status', ['rejada', 'faol']).order('start_date', { ascending: false });
    const bor = new Set(azolik.filter((a) => a.status === 'faol').map((a) => a.group_id));
    setGuruhlar((data ?? []).filter((g) => !bor.has(g.id)));
    setTanlanganGuruh('');
    setChegirma(0);
    setGuruhModal(true);
  }

  async function guruhgaQosh(e: React.FormEvent) {
    e.preventDefault();
    setGXato('');
    if (!tanlanganGuruh) return setGXato('Guruh tanlang');
    const { error } = await supabase.from('enrollments').insert({ student_id: id, group_id: tanlanganGuruh, discount_pct: chegirma });
    if (error) return setGXato(error.message);
    setGuruhModal(false);
    load();
  }

  async function oquvchiOchir() {
    setOchirTasdiq(false);
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) {
      if (error.code === '23503') return alert("O'chirib bo'lmadi: bu o'quvchiga to'lovlar, davomat yoki boshqa yozuvlar bog'langan. Uni o'chirish o'rniga holatini 'Ketgan' qiling — tarix saqlanadi.");
      if (error.code === '42501') return alert("O'chirish faqat Superadmin uchun.");
      return alert('Xato: ' + error.message);
    }
    nav('/oquvchilar');
  }

  if (!s) return <p className="muted">Yuklanmoqda…</p>;

  const prMap: Record<string, any> = {};
  for (const p of progress) prMap[p.group_id] = p;

  return (
    <div>
      <div className="page-head">
        <h1>{s.first_name} {s.last_name} <span className="mono muted">({s.id})</span></h1>
        <div className="row-gap">
          <button className="btn-sm" onClick={tahrirOch}>✎ Tahrirlash</button>
          <select className="sel-inline" value={s.status} onChange={(e) => holatOzgar(e.target.value)}>
            {['faol', 'pauza', 'bitirgan', 'ketgan'].map((h) => <option key={h} value={h}>{holat(h)}</option>)}
          </select>
          {superadmin && <button className="btn-sm btn-danger" onClick={() => setOchirTasdiq(true)}>O'chirish</button>}
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <h2>Ma'lumotlar</h2>
          <div className="kv"><span>Telefon</span><b className="mono">{s.phone}</b></div>
          <div className="kv"><span>Tug'ilgan sana</span><b>{sana(s.birth_date)}</b></div>
          <div className="kv"><span>Ota-ona</span><b>{s.parent_name ?? '—'} {s.parent_phone ? `· ${s.parent_phone}` : ''}</b></div>
          <div className="kv"><span>Manba</span><b>{s.source ? holat(s.source) : '—'}</b></div>
          <div className="kv"><span>Joriy bosqich</span><b>{s.current_level_code ?? '—'}</b></div>
          <div className="kv"><span>Kelgan sana</span><b>{sana(s.joined_at)}</b></div>
          {s.note && <div className="kv"><span>Izoh</span><b>{s.note}</b></div>}
          {riskRows.length > 0 && (() => {
            const r = riskRows.reduce((m, x) => (x.score < m.score ? x : m), riskRows[0]);
            const h = riskHolat(r.score);
            return (
              <div className="kv"><span>Xavf bali</span>
                <b><span className={'badge badge-' + h.rang}>{r.score} · {h.label}</span>
                {r.score < 70 && <span className="muted small"> ({r.kelmagan_14} qoldirish/14k{r.qarz_bor ? ' · qarz bor' : ''}{r.ketma_ket ? ` · ${r.ketma_ket} ketma-ket` : ''})</span>}</b>
              </div>
            );
          })()}
          {s.status === 'ketgan' && (
            <div className="kv"><span>Churn</span><b className="red">{s.churn_reason ? holat(s.churn_reason) : '—'} · {sana(s.churned_at)}{s.winback ? ` · Qaytarish: ${holat(s.winback)}` : ''}</b></div>
          )}
        </div>

        <div className="card">
          <div className="row-between">
            <h2>Guruhlar</h2>
            <button className="btn-sm" onClick={guruhOch}>+ Guruhga qo'shish</button>
          </div>
          {azolik.length === 0 ? <p className="muted">Hali guruhga biriktirilmagan.</p> : (
            <table>
              <thead><tr><th>Guruh</th><th>Holat</th><th>Chegirma</th><th>Davomat</th><th>O'rt. test</th></tr></thead>
              <tbody>
                {azolik.map((a) => (
                  <tr key={a.id}>
                    <td><Link to={`/guruhlar/${a.group_id}`}>{a.group_id}</Link></td>
                    <td>
                      <select className="sel-inline" value={a.status} onChange={async (e) => {
                        await supabase.from('enrollments').update({
                          status: e.target.value,
                          left_at: e.target.value === 'faol' ? null : new Date().toISOString().slice(0, 10),
                        }).eq('id', a.id);
                        load();
                      }}>
                        {['faol', 'yakunladi', 'kochirildi', 'tashlab_ketdi', 'chetlashtirildi'].map((h) => <option key={h} value={h}>{holat(h)}</option>)}
                      </select>
                    </td>
                    <td>{a.discount_pct ? a.discount_pct + '%' : '—'}</td>
                    <td>{prMap[a.group_id]?.davomat_pct != null ? prMap[a.group_id].davomat_pct + '%' : '—'}</td>
                    <td>{prMap[a.group_id]?.ortacha_test != null ? prMap[a.group_id].ortacha_test + '%' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="muted small">Guruhni almashtirish: eski a'zolikni "Ko'chirildi" qiling va "+ Guruhga qo'shish" bilan yangisiga yozing.</p>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <h2>To'lovlar</h2>
          {tolovlar.length === 0 ? <p className="muted">To'lov yozuvi yo'q.</p> : (
            <table>
              <thead><tr><th>Davr</th><th>Summa</th><th>To'langan</th><th>Holat</th><th>Sana</th></tr></thead>
              <tbody>
                {tolovlar.map((p) => (
                  <tr key={p.id}>
                    <td className="mono">{p.period}</td>
                    <td>{som(p.amount_due)}</td>
                    <td>{som(p.amount_paid)}</td>
                    <td><Badge s={p.status} /></td>
                    <td>{sana(p.paid_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2>Test natijalari</h2>
          {natijalar.length === 0 ? <p className="muted">Hali natija yo'q.</p> : (
            <table>
              <thead><tr><th>Test</th><th>Natija</th><th>O'tdi</th><th>Sana</th></tr></thead>
              <tbody>
                {natijalar.map((n) => (
                  <tr key={n.id}>
                    <td>{n.assessments?.title ?? n.assessment_code} <span className="mono muted small">{n.assessment_code}</span></td>
                    <td><b>{Number(n.score_pct)}%</b></td>
                    <td>{n.passed ? <Badge s="otildi" /> : <Badge s="kelmadi" />}</td>
                    <td>{sana(n.taken_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {tahrirModal && f && (
        <Modal title={`O'quvchini tahrirlash — ${s.id}`} onClose={() => setTahrirModal(false)}>
          <form onSubmit={tahrirSaqla} className="form-grid">
            <label>Ismi
              <input value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} required autoFocus />
            </label>
            <label>Familiyasi
              <input value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} required />
            </label>
            <label>Telefon
              <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} required />
            </label>
            <label>Tug'ilgan sana
              <input type="date" value={f.birth_date} onChange={(e) => setF({ ...f, birth_date: e.target.value })} />
            </label>
            <label>Ota-ona ismi
              <input value={f.parent_name} onChange={(e) => setF({ ...f, parent_name: e.target.value })} />
            </label>
            <label>Ota-ona telefoni
              <input value={f.parent_phone} onChange={(e) => setF({ ...f, parent_phone: e.target.value })} />
            </label>
            <label>Joriy bosqich
              <select value={f.current_level_code} onChange={(e) => setF({ ...f, current_level_code: e.target.value })}>
                <option value="">— Tanlanmagan —</option>
                {levels.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
              </select>
            </label>
            <label>Kelgan sana
              <input type="date" value={f.joined_at} onChange={(e) => setF({ ...f, joined_at: e.target.value })} required />
            </label>
            <label className="span2">Izoh
              <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
            </label>
            {tXato && <div className="err span2">{tXato}</div>}
            <button className="btn span2">Saqlash</button>
          </form>
        </Modal>
      )}

      {churnModal && (
        <Modal title={`O'quvchi ketmoqda — ${s.first_name} ${s.last_name}`} onClose={() => setChurnModal(false)}>
          <form onSubmit={churnSaqla} className="form-grid">
            <label className="span2">Ketish sababi (majburiy)
              <select value={churnSabab} onChange={(e) => setChurnSabab(e.target.value)} required>
                <option value="">— Tanlang —</option>
                {CHURN_SABABLAR.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <p className="muted small span2">Sabab churn analitikasiga saqlanadi; o'quvchi "Ketganlar / Qaytarish" ro'yxatiga tushadi — u yerdan qaytarish jarayonini yuritasiz.</p>
            <button className="btn span2" disabled={!churnSabab}>Saqlash</button>
          </form>
        </Modal>
      )}

      {ochirTasdiq && (
        <Confirm
          text={`${s.first_name} ${s.last_name} (${s.id}) butunlay o'chirilsinmi? O'chirishga ishonchingiz komilmi?`}
          onHa={oquvchiOchir}
          onYoq={() => setOchirTasdiq(false)}
        />
      )}

      {guruhModal && (
        <Modal title="Guruhga qo'shish" onClose={() => setGuruhModal(false)}>
          <form onSubmit={guruhgaQosh} className="form-grid">
            <label className="span2">Guruh
              <select value={tanlanganGuruh} onChange={(e) => setTanlanganGuruh(e.target.value)} required>
                <option value="">— Tanlang —</option>
                {guruhlar.map((g) => (
                  <option key={g.id} value={g.id}>{g.id} · {String(g.start_time).slice(0, 5)} · {holat(g.status)}</option>
                ))}
              </select>
            </label>
            <label>Chegirma (%)
              <input type="number" value={chegirma} onChange={(e) => setChegirma(Number(e.target.value))} min="0" max="100" />
            </label>
            {gXato && <div className="err span2">{gXato}</div>}
            <button className="btn span2">Qo'shish</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
