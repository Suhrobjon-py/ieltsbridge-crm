import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { sana, holat, KUNLAR, nechaKunOldin, bugunISO, LEAD_BOSQICHLAR, MANBALAR, RAD_SABABLAR } from '../lib/format';
import Modal from '../components/Modal';
import Confirm from '../components/Confirm';
import { useRole } from '../lib/role';

const BOSH = { first_name: '', last_name: '', phone: '', phone2: '', parent_name: '', source: 'instagram_ads', subject: 'General', manager: '', priority: 'orta', birth_year: '' };

// Kartaning signal rangi: yashil=yaxshi, sariq=e'tibor, to'q sariq=muammo, qizil=kritik
function signal(l: any): string {
  const bugun = bugunISO();
  const yopiq = l.status === 'sotuv_yopildi' || l.status === 'rad_etdi';
  if (yopiq) return 'green';
  if (l.next_followup_at && l.next_followup_at < bugun) {
    const kech = Math.floor((Date.now() - new Date(l.next_followup_at).getTime()) / 86400000);
    return kech >= 3 ? 'red' : 'orange';
  }
  const soat = (Date.now() - new Date(l.last_contact_at ?? l.created_at).getTime()) / 3600000;
  if (l.status === 'yangi' && soat > 24) return 'red';
  if (soat > 48) return 'yellow';
  return 'green';
}

export default function Leads() {
  const { superadmin } = useRole();
  const [rows, setRows] = useState<any[]>([]);
  const [korinish, setKorinish] = useState<'kanban' | 'jadval'>('kanban');
  const [qidiruv, setQidiruv] = useState('');
  const [fManba, setFManba] = useState('');
  const [fManager, setFManager] = useState('');
  const [fPriority, setFPriority] = useState('');

  const [modal, setModal] = useState(false);
  const [f, setF] = useState<any>(BOSH);
  const [xato, setXato] = useState('');
  const [ochirLead, setOchirLead] = useState<any>(null);

  // Detal oynasi
  const [detal, setDetal] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [lidTrials, setLidTrials] = useState<any[]>([]);
  const [df, setDf] = useState<any>(null);

  // Maxsus o'tish oynalari
  const [radLead, setRadLead] = useState<any>(null);
  const [radSabab, setRadSabab] = useState('');
  const [radIzoh, setRadIzoh] = useState('');
  const [sotuvLead, setSotuvLead] = useState<any>(null);
  const [guruhlar, setGuruhlar] = useState<any[]>([]);
  const [tanlanganGuruh, setTanlanganGuruh] = useState('');
  const [sXato, setSXato] = useState('');
  const [trialLead, setTrialLead] = useState<any>(null);
  const [tf, setTf] = useState<any>({ trial_date: '', trial_time: '18:00', group_id: '' });

  const [tortilayotgan, setTortilayotgan] = useState<string | null>(null);

  const [fanlar, setFanlar] = useState<string[]>(['General', 'IELTS']);

  async function load() {
    const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    setRows(data ?? []);
  }
  useEffect(() => {
    load();
    supabase.from('subjects').select('name').eq('faol', true).order('id')
      .then(({ data }) => { if (data?.length) setFanlar(data.map((x) => x.name)); });
  }, []);

  const managerlar = useMemo(() => [...new Set(rows.map((r) => r.manager).filter(Boolean))].sort(), [rows]);

  const filtrlangan = useMemo(() => rows.filter((r) => {
    if (fManba && r.source !== fManba) return false;
    if (fManager && r.manager !== fManager) return false;
    if (fPriority && r.priority !== fPriority) return false;
    if (qidiruv.trim()) {
      const q = qidiruv.trim().toLowerCase();
      const matn = `${r.first_name} ${r.last_name} ${r.phone} ${r.phone2 ?? ''} ${r.id}`.toLowerCase();
      if (!matn.includes(q)) return false;
    }
    return true;
  }), [rows, fManba, fManager, fPriority, qidiruv]);

  // ---------- yangi lid ----------
  async function saqla(e: React.FormEvent) {
    e.preventDefault();
    setXato('');
    const body = { ...f, phone2: f.phone2 || null, parent_name: f.parent_name || null, manager: f.manager || null, birth_year: f.birth_year ? Number(f.birth_year) : null };
    const { error } = await supabase.from('leads').insert(body);
    if (error) return setXato(error.message);
    setModal(false);
    setF(BOSH);
    load();
  }

  // ---------- holat o'tkazish (drag-drop va tugmalar) ----------
  async function holatga(lead: any, status: string) {
    if (status === lead.status) return;
    if (status === 'rad_etdi') { setRadLead(lead); setRadSabab(''); setRadIzoh(''); return; }
    if (status === 'sotuv_yopildi') { return sotuvOch(lead); }
    if (status === 'sinovga_yozildi') { return trialOch(lead); }
    const { error } = await supabase.from('leads').update({ status }).eq('id', lead.id);
    if (error) return alert('Xato: ' + error.message);
    load();
    if (detal?.id === lead.id) detalYangila(lead.id);
  }

  async function radSaqla(e: React.FormEvent) {
    e.preventDefault();
    if (!radSabab) return;
    const { error } = await supabase.from('leads').update({
      status: 'rad_etdi', lost_reason: radSabab,
      note: radIzoh.trim() ? radIzoh.trim() : radLead.note,
    }).eq('id', radLead.id);
    if (error) return alert('Xato: ' + error.message);
    setRadLead(null);
    load();
    if (detal) detalYangila(radLead.id);
  }

  async function sotuvOch(lead: any) {
    setSXato('');
    setTanlanganGuruh('');
    const { data } = await supabase.from('groups')
      .select('id, level_code, status, start_time, days_pattern, levels(name)')
      .in('status', ['rejada', 'faol']).order('start_date', { ascending: false });
    setGuruhlar(data ?? []);
    setSotuvLead(lead);
  }

  async function sotuvSaqla(e: React.FormEvent) {
    e.preventDefault();
    setSXato('');
    if (!tanlanganGuruh) return setSXato('Guruh tanlang');
    const g = guruhlar.find((x) => x.id === tanlanganGuruh);
    const note = [sotuvLead.phone2 ? `Qo'shimcha tel: ${sotuvLead.phone2}` : '', `Lid: ${sotuvLead.id}`].filter(Boolean).join(' · ');
    const { data: stu, error: e1 } = await supabase.from('students').insert({
      first_name: sotuvLead.first_name, last_name: sotuvLead.last_name || '—',
      phone: sotuvLead.phone, parent_name: sotuvLead.parent_name, parent_phone: null,
      source: sotuvLead.source, current_level_code: g?.level_code ?? null, note,
    }).select('id').single();
    if (e1) return setSXato(e1.message);
    const { error: e2 } = await supabase.from('enrollments').insert({ student_id: stu.id, group_id: tanlanganGuruh });
    if (e2) return setSXato(e2.message);
    await supabase.from('leads').update({ status: 'sotuv_yopildi', student_id: stu.id }).eq('id', sotuvLead.id);
    await supabase.from('lead_events').insert({ lead_id: sotuvLead.id, event_type: 'sotuv', body: `Sotuv yopildi: ${stu.id} → ${tanlanganGuruh}` });
    await supabase.from('trials').update({ status: 'sotuvga_otkazildi' }).eq('lead_id', sotuvLead.id).in('status', ['keldi', 'muvaffaqiyatli']);
    setSotuvLead(null);
    load();
    if (detal) detalYangila(sotuvLead.id);
    alert(`${sotuvLead.first_name} → ${stu.id} sifatida ${tanlanganGuruh} guruhiga yozildi 🎉`);
  }

  async function trialOch(lead: any) {
    const { data } = await supabase.from('groups')
      .select('id, level_code, start_time, days_pattern')
      .in('status', ['rejada', 'faol']).order('start_date', { ascending: false });
    setGuruhlar(data ?? []);
    setTf({ trial_date: bugunISO(), trial_time: '18:00', group_id: '' });
    setTrialLead(lead);
  }

  async function trialSaqla(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from('trials').insert({
      lead_id: trialLead.id, trial_date: tf.trial_date, trial_time: tf.trial_time,
      group_id: tf.group_id || null,
    });
    if (error) return alert('Xato: ' + error.message);
    setTrialLead(null);
    load();
    if (detal) detalYangila(trialLead.id);
  }

  // ---------- detal + timeline ----------
  async function detalOch(lead: any) {
    setDetal(lead);
    setDf({
      parent_name: lead.parent_name ?? '', manager: lead.manager ?? '', priority: lead.priority,
      interest: lead.interest ?? '', next_followup_at: lead.next_followup_at ?? '', birth_year: lead.birth_year ?? '',
      subject: lead.subject ?? 'General', source: lead.source,
    });
    detalYangila(lead.id);
  }

  async function detalYangila(leadId: string) {
    const [ev, tr, ld] = await Promise.all([
      supabase.from('lead_events').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(50),
      supabase.from('trials').select('*').eq('lead_id', leadId).order('trial_date', { ascending: false }),
      supabase.from('leads').select('*').eq('id', leadId).single(),
    ]);
    setEvents(ev.data ?? []);
    setLidTrials(tr.data ?? []);
    if (ld.data) setDetal(ld.data);
  }

  async function detalSaqla() {
    const body = {
      parent_name: df.parent_name || null, manager: df.manager || null, priority: df.priority,
      interest: df.interest || null, next_followup_at: df.next_followup_at || null,
      birth_year: df.birth_year ? Number(df.birth_year) : null, subject: df.subject, source: df.source,
    };
    const { error } = await supabase.from('leads').update(body).eq('id', detal.id);
    if (error) return alert('Xato: ' + error.message);
    load();
    detalYangila(detal.id);
  }

  async function aloqaQayd(turi: string, sarlavha: string) {
    const izoh = prompt(sarlavha + ' — qisqa izoh:');
    if (izoh === null) return;
    await supabase.from('lead_events').insert({ lead_id: detal.id, event_type: turi, body: izoh || sarlavha });
    const yangilash: any = { last_contact_at: new Date().toISOString() };
    if (detal.status === 'yangi') yangilash.status = 'birinchi_aloqa';
    await supabase.from('leads').update(yangilash).eq('id', detal.id);
    load();
    detalYangila(detal.id);
  }

  const EV_ICON: Record<string, string> = { yaratildi: '✦', status: '⇄', qongiroq: '📞', sms: '✉', izoh: '📝', sinov: '🎓', sotuv: '💰', menejer: '👤' };

  return (
    <div>
      <div className="page-head">
        <h1>Lidlar <span className="muted small">({filtrlangan.length})</span></h1>
        <div className="row-gap">
          <div className="tabs" style={{ margin: 0 }}>
            <button className={korinish === 'kanban' ? 'tab on' : 'tab'} onClick={() => setKorinish('kanban')}>Doska</button>
            <button className={korinish === 'jadval' ? 'tab on' : 'tab'} onClick={() => setKorinish('jadval')}>Jadval</button>
          </div>
          <button className="btn" onClick={() => { setF(BOSH); setXato(''); setModal(true); }}>+ Yangi lid</button>
        </div>
      </div>

      <div className="filter-row">
        <input className="search" placeholder="Qidirish: ism, telefon…" value={qidiruv} onChange={(e) => setQidiruv(e.target.value)} />
        <select value={fManba} onChange={(e) => setFManba(e.target.value)}>
          <option value="">Barcha manbalar</option>
          {MANBALAR.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={fManager} onChange={(e) => setFManager(e.target.value)}>
          <option value="">Barcha menejerlar</option>
          {managerlar.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={fPriority} onChange={(e) => setFPriority(e.target.value)}>
          <option value="">Barcha muhimliklar</option>
          <option value="yuqori">Yuqori</option><option value="orta">O'rta</option><option value="past">Past</option>
        </select>
        <span className="legend" style={{ marginLeft: 'auto' }}>
          <span className="legend-chip"><i style={{ background: '#22c55e' }} />Yaxshi</span>
          <span className="legend-chip"><i style={{ background: '#eab308' }} />E'tibor</span>
          <span className="legend-chip"><i style={{ background: '#f59e0b' }} />Muammo</span>
          <span className="legend-chip"><i style={{ background: '#ef4444' }} />Kritik</span>
        </span>
      </div>

      {korinish === 'kanban' ? (
        <div className="kanban">
          {LEAD_BOSQICHLAR.map(([kod, nom]) => {
            const ustun = filtrlangan.filter((r) => r.status === kod);
            return (
              <div
                key={kod}
                className={'kcol' + (kod === 'sotuv_yopildi' ? ' kcol-win' : '') + (kod === 'rad_etdi' ? ' kcol-lost' : '')}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const lead = rows.find((r) => r.id === tortilayotgan);
                  setTortilayotgan(null);
                  if (lead) holatga(lead, kod);
                }}
              >
                <div className="kcol-head">{nom} <span className="kcol-n">{ustun.length}</span></div>
                <div className="kcol-body">
                  {ustun.map((l) => (
                    <div
                      key={l.id}
                      className={'kcard sig-' + signal(l)}
                      draggable
                      onDragStart={() => setTortilayotgan(l.id)}
                      onClick={() => detalOch(l)}
                    >
                      <div className="kcard-top">
                        <span className="avatar">{(l.first_name[0] ?? '') + (l.last_name?.[0] ?? '')}</span>
                        <b>{l.first_name} {l.last_name}</b>
                        <span className={'pri pri-' + l.priority} title={'Muhimlik: ' + holat(l.priority)} />
                      </div>
                      <div className="kcard-line mono">{l.phone}</div>
                      <div className="kcard-line">
                        <span className="chip">{l.subject ?? '—'}</span>
                        <span className="chip chip-src">{holat(l.source)}</span>
                      </div>
                      <div className="kcard-meta">
                        <span title="Mas'ul menejer">👤 {l.manager ?? '—'}</span>
                        <span title="Oxirgi aloqa">🕐 {nechaKunOldin(l.last_contact_at ?? l.created_at)}</span>
                      </div>
                      {l.next_followup_at && (
                        <div className={'kcard-fup' + (l.next_followup_at < bugunISO() ? ' kech' : '')}>
                          ⏰ Keyingi aloqa: {sana(l.next_followup_at)}{l.next_followup_at < bugunISO() ? " — MUDDATI O'TGAN" : ''}
                        </div>
                      )}
                    </div>
                  ))}
                  {ustun.length === 0 && <div className="kcol-bosh">bo'sh</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <table>
            <thead><tr><th>ID</th><th>Ism</th><th>Telefon</th><th>Fan</th><th>Manba</th><th>Menejer</th><th>Bosqich</th><th>Muhimlik</th><th>Keyingi aloqa</th><th>Oxirgi aloqa</th><th></th></tr></thead>
            <tbody>
              {filtrlangan.map((l) => (
                <tr key={l.id} className="clickable" onClick={() => detalOch(l)}>
                  <td className="mono">{l.id}</td>
                  <td><b>{l.first_name} {l.last_name}</b>{l.parent_name ? <div className="muted small">Ota-ona: {l.parent_name}</div> : null}</td>
                  <td className="mono">{l.phone}</td>
                  <td>{l.subject ?? '—'}</td>
                  <td>{holat(l.source)}</td>
                  <td>{l.manager ?? '—'}</td>
                  <td><span className={'badge badge-' + (l.status === 'sotuv_yopildi' ? 'green' : l.status === 'rad_etdi' ? 'red' : 'blue')}>{holat(l.status)}</span></td>
                  <td>{holat(l.priority)}</td>
                  <td className={l.next_followup_at && l.next_followup_at < bugunISO() ? 'red' : ''}>{sana(l.next_followup_at)}</td>
                  <td>{nechaKunOldin(l.last_contact_at ?? l.created_at)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {superadmin && <button className="btn-ghost small red" onClick={() => setOchirLead(l)}>O'chirish</button>}
                  </td>
                </tr>
              ))}
              {filtrlangan.length === 0 && <tr><td colSpan={11} className="muted">Lid topilmadi.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------- YANGI LID ---------- */}
      {modal && (
        <Modal title="Yangi lid" onClose={() => setModal(false)}>
          <form onSubmit={saqla} className="form-grid">
            <label>Ismi<input value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} required autoFocus /></label>
            <label>Familiyasi<input value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} required /></label>
            <label>Telefon<input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+998 90 123 45 67" required /></label>
            <label>Qo'shimcha telefon<input value={f.phone2} onChange={(e) => setF({ ...f, phone2: e.target.value })} placeholder="ixtiyoriy" /></label>
            <label>Ota-ona ismi<input value={f.parent_name} onChange={(e) => setF({ ...f, parent_name: e.target.value })} /></label>
            <label>Tug'ilgan yil<input type="number" value={f.birth_year} onChange={(e) => setF({ ...f, birth_year: e.target.value })} min="1950" max="2022" placeholder="2010" /></label>
            <label>Manba
              <select value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>
                {MANBALAR.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label>Fan
              <select value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })}>
                {fanlar.map((fn) => <option key={fn} value={fn}>{fn}</option>)}
              </select>
            </label>
            <label>Mas'ul menejer
              <input value={f.manager} onChange={(e) => setF({ ...f, manager: e.target.value })} list="managerlar" placeholder="ism" />
              <datalist id="managerlar">{managerlar.map((m) => <option key={m} value={m} />)}</datalist>
            </label>
            <label>Muhimlik
              <select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>
                <option value="yuqori">Yuqori</option><option value="orta">O'rta</option><option value="past">Past</option>
              </select>
            </label>
            {xato && <div className="err span2">{xato}</div>}
            <button className="btn span2">Saqlash</button>
          </form>
        </Modal>
      )}

      {/* ---------- LID DETAL + TIMELINE ---------- */}
      {detal && df && (
        <Modal wide title={`${detal.first_name} ${detal.last_name} · ${detal.id}`} onClose={() => setDetal(null)}>
          <div className="detal-grid">
            <div>
              <div className="row-gap" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
                <span className={'badge badge-' + (detal.status === 'sotuv_yopildi' ? 'green' : detal.status === 'rad_etdi' ? 'red' : 'blue')}>{holat(detal.status)}</span>
                <span className="mono small">{detal.phone}</span>
                {detal.phone2 && <span className="mono small muted">{detal.phone2}</span>}
                {detal.student_id && <Link to={`/oquvchilar/${detal.student_id}`} className="mono small">{detal.student_id} →</Link>}
              </div>

              <div className="row-gap" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
                <button className="btn-sm" onClick={() => aloqaQayd('qongiroq', "Qo'ng'iroq qilindi")}>📞 Qo'ng'iroq</button>
                <button className="btn-sm" onClick={() => aloqaQayd('sms', 'SMS yuborildi')}>✉ SMS</button>
                <button className="btn-sm" onClick={() => aloqaQayd('izoh', 'Izoh')}>📝 Izoh</button>
                <button className="btn-sm" onClick={() => trialOch(detal)}>🎓 Sinovga yozish</button>
                <button className="btn-sm" style={{ background: '#dcfce7', borderColor: '#22c55e', color: '#166534' }} onClick={() => sotuvOch(detal)}>💰 Sotuvni yopish</button>
                <button className="btn-sm btn-danger" onClick={() => { setRadLead(detal); setRadSabab(''); setRadIzoh(''); }}>Rad etdi</button>
              </div>

              <div className="form-grid">
                <label>Bosqich
                  <select value={detal.status} onChange={(e) => holatga(detal, e.target.value)}>
                    {LEAD_BOSQICHLAR.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </label>
                <label>Mas'ul menejer
                  <input value={df.manager} onChange={(e) => setDf({ ...df, manager: e.target.value })} list="managerlar" />
                </label>
                <label>Ota-ona<input value={df.parent_name} onChange={(e) => setDf({ ...df, parent_name: e.target.value })} /></label>
                <label>Tug'ilgan yil<input type="number" value={df.birth_year} onChange={(e) => setDf({ ...df, birth_year: e.target.value })} /></label>
                <label>Manba
                  <select value={df.source} onChange={(e) => setDf({ ...df, source: e.target.value })}>
                    {MANBALAR.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </label>
                <label>Fan
                  <select value={df.subject} onChange={(e) => setDf({ ...df, subject: e.target.value })}>
                    {!fanlar.includes(df.subject) && df.subject && <option value={df.subject}>{df.subject}</option>}
                    {fanlar.map((fn) => <option key={fn} value={fn}>{fn}</option>)}
                  </select>
                </label>
                <label>Muhimlik
                  <select value={df.priority} onChange={(e) => setDf({ ...df, priority: e.target.value })}>
                    <option value="yuqori">Yuqori</option><option value="orta">O'rta</option><option value="past">Past</option>
                  </select>
                </label>
                <label>Qiziqish darajasi
                  <select value={df.interest} onChange={(e) => setDf({ ...df, interest: e.target.value })}>
                    <option value="">—</option><option value="yuqori">Yuqori</option><option value="orta">O'rta</option><option value="past">Past</option>
                  </select>
                </label>
                <label>Keyingi aloqa sanasi<input type="date" value={df.next_followup_at} onChange={(e) => setDf({ ...df, next_followup_at: e.target.value })} /></label>
                <button type="button" className="btn" style={{ alignSelf: 'end' }} onClick={detalSaqla}>Saqlash</button>
              </div>

              {detal.note && <p className="muted small" style={{ marginTop: 10 }}>Izoh: {detal.note}</p>}
              {detal.lost_reason && <p className="red small" style={{ marginTop: 6 }}>Rad sababi: {holat(detal.lost_reason)}</p>}

              {lidTrials.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <b className="small">Sinov darslari:</b>
                  {lidTrials.map((t) => (
                    <div key={t.id} className="small" style={{ padding: '4px 0' }}>
                      {sana(t.trial_date)} {t.trial_time ? String(t.trial_time).slice(0, 5) : ''} · {t.group_id ?? '—'} ·{' '}
                      <span className={'badge badge-' + (['keldi', 'muvaffaqiyatli', 'sotuvga_otkazildi'].includes(t.status) ? 'green' : t.status === 'kelmadi' ? 'red' : 'blue')}>{holat(t.status)}</span>
                      {t.noshow_reason && <span className="red"> ({holat(t.noshow_reason)})</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="timeline">
              <b className="small muted">VAQT CHIZIG'I</b>
              {events.map((ev) => (
                <div key={ev.id} className="tl-item">
                  <span className="tl-icon">{EV_ICON[ev.event_type] ?? '•'}</span>
                  <div>
                    <div className="small">{ev.body}</div>
                    <div className="muted" style={{ fontSize: 11 }}>{new Date(ev.created_at).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}{ev.created_by ? ` · ${ev.created_by}` : ''}</div>
                  </div>
                </div>
              ))}
              {events.length === 0 && <p className="muted small">Hozircha yozuv yo'q.</p>}
            </div>
          </div>
        </Modal>
      )}

      {/* ---------- RAD ETISH ---------- */}
      {radLead && (
        <Modal title={`Rad etdi — ${radLead.first_name} ${radLead.last_name}`} onClose={() => setRadLead(null)}>
          <form onSubmit={radSaqla} className="form-grid">
            <label className="span2">Sabab (majburiy)
              <select value={radSabab} onChange={(e) => setRadSabab(e.target.value)} required>
                <option value="">— Tanlang —</option>
                {RAD_SABABLAR.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="span2">Izoh
              <textarea value={radIzoh} onChange={(e) => setRadIzoh(e.target.value)} rows={2} placeholder="qo'shimcha tafsilot (ixtiyoriy)" />
            </label>
            <button className="btn span2" disabled={!radSabab}>Saqlash</button>
          </form>
        </Modal>
      )}

      {/* ---------- SOTUV YOPISH ---------- */}
      {sotuvLead && (
        <Modal title={`Sotuvni yopish — ${sotuvLead.first_name} ${sotuvLead.last_name}`} onClose={() => setSotuvLead(null)}>
          <form onSubmit={sotuvSaqla} className="form-grid">
            <label className="span2">Guruh
              <select value={tanlanganGuruh} onChange={(e) => setTanlanganGuruh(e.target.value)} required>
                <option value="">— Tanlang —</option>
                {guruhlar.map((g) => <option key={g.id} value={g.id}>{g.id} · {g.levels?.name} · {KUNLAR[g.days_pattern]} {String(g.start_time).slice(0, 5)}</option>)}
              </select>
            </label>
            <p className="muted small span2">Lid o'quvchiga aylantiriladi, guruhga yoziladi va pipeline "Sotuv yopildi" bo'ladi.</p>
            {sXato && <div className="err span2">{sXato}</div>}
            <button className="btn span2" disabled={!guruhlar.length}>Yopish 💰</button>
          </form>
        </Modal>
      )}

      {/* ---------- SINOVGA YOZISH ---------- */}
      {trialLead && (
        <Modal title={`Sinov darsiga yozish — ${trialLead.first_name} ${trialLead.last_name}`} onClose={() => setTrialLead(null)}>
          <form onSubmit={trialSaqla} className="form-grid">
            <label>Sana<input type="date" value={tf.trial_date} onChange={(e) => setTf({ ...tf, trial_date: e.target.value })} required /></label>
            <label>Vaqt<input type="time" value={tf.trial_time} onChange={(e) => setTf({ ...tf, trial_time: e.target.value })} required /></label>
            <label className="span2">Guruh (ixtiyoriy)
              <select value={tf.group_id} onChange={(e) => setTf({ ...tf, group_id: e.target.value })}>
                <option value="">— Tanlanmagan —</option>
                {guruhlar.map((g) => <option key={g.id} value={g.id}>{g.id} · {KUNLAR[g.days_pattern]} {String(g.start_time).slice(0, 5)}</option>)}
              </select>
            </label>
            <button className="btn span2">Yozish</button>
          </form>
        </Modal>
      )}

      {ochirLead && (
        <Confirm
          text={`${ochirLead.first_name} ${ochirLead.last_name} (${ochirLead.id}) o'chirilsinmi?`}
          onHa={async () => {
            const { error } = await supabase.from('leads').delete().eq('id', ochirLead.id);
            setOchirLead(null);
            if (error) return alert(error.code === '42501' ? "O'chirish faqat Superadmin uchun." : 'Xato: ' + error.message);
            load();
          }}
          onYoq={() => setOchirLead(null)}
        />
      )}
    </div>
  );
}
