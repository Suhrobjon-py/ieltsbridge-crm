import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { sana, holat, KUNLAR } from '../lib/format';
import Modal from '../components/Modal';
import Confirm from '../components/Confirm';
import { useRole } from '../lib/role';

const MANBALAR = ['instagram', 'telegram', 'tavsiya', 'dostlar', 'boshqa'];
const BOSH = { first_name: '', last_name: '', phone: '', phone2: '', source: 'instagram', subject: 'General' };

export default function Leads() {
  const { superadmin } = useRole();
  const [tab, setTab] = useState<'yangi' | 'kelmaydi' | 'yozildi'>('yangi');
  const [rows, setRows] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [f, setF] = useState<any>(BOSH);
  const [xato, setXato] = useState('');
  const [ochirLead, setOchirLead] = useState<any>(null);

  // "Kelmadi" oynasi
  const [kelmadiLead, setKelmadiLead] = useState<any>(null);
  const [izoh, setIzoh] = useState('');

  // "Guruhga biriktirish" oynasi
  const [birikLead, setBirikLead] = useState<any>(null);
  const [guruhlar, setGuruhlar] = useState<any[]>([]);
  const [tanlanganGuruh, setTanlanganGuruh] = useState('');
  const [bXato, setBXato] = useState('');

  async function load() {
    const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false }).order('id', { ascending: false });
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function saqla(e: React.FormEvent) {
    e.preventDefault();
    setXato('');
    const { error } = await supabase.from('leads').insert({ ...f, phone2: f.phone2 || null });
    if (error) return setXato(error.message);
    setModal(false);
    setF(BOSH);
    load();
  }

  async function kelmadiSaqla(e: React.FormEvent) {
    e.preventDefault();
    if (!izoh.trim()) return;
    await supabase.from('leads').update({ status: 'kelmaydi', note: izoh.trim() }).eq('id', kelmadiLead.id);
    setKelmadiLead(null);
    setIzoh('');
    load();
  }

  async function birikOch(lead: any) {
    setBXato('');
    setTanlanganGuruh('');
    const { data } = await supabase
      .from('groups')
      .select('id, level_code, status, start_time, days_pattern, capacity, levels(name)')
      .in('status', ['rejada', 'faol'])
      .order('start_date', { ascending: false });
    setGuruhlar(data ?? []);
    setBirikLead(lead);
  }

  async function birikSaqla(e: React.FormEvent) {
    e.preventDefault();
    setBXato('');
    if (!tanlanganGuruh) return setBXato('Guruh tanlang');
    const g = guruhlar.find((x) => x.id === tanlanganGuruh);
    const note = [birikLead.phone2 ? `Qo'shimcha tel: ${birikLead.phone2}` : '', `Lid: ${birikLead.id}`].filter(Boolean).join(' · ');
    const { data: stu, error: e1 } = await supabase.from('students').insert({
      first_name: birikLead.first_name,
      last_name: birikLead.last_name || '—',
      phone: birikLead.phone,
      source: birikLead.source,
      current_level_code: g?.level_code ?? null,
      note,
    }).select('id').single();
    if (e1) return setBXato(e1.message);
    const { error: e2 } = await supabase.from('enrollments').insert({ student_id: stu.id, group_id: tanlanganGuruh });
    if (e2) return setBXato(e2.message);
    await supabase.from('leads').update({ status: 'yozildi', student_id: stu.id }).eq('id', birikLead.id);
    setBirikLead(null);
    load();
    alert(`${birikLead.first_name} ${birikLead.last_name} → ${stu.id} sifatida ${tanlanganGuruh} guruhiga yozildi.`);
  }

  const yangi = rows.filter((r) => r.status === 'yangi');
  const kelmaydi = rows.filter((r) => r.status === 'kelmaydi');
  const yozildi = rows.filter((r) => r.status === 'yozildi');
  const korsatiladigan = tab === 'yangi' ? yangi : tab === 'kelmaydi' ? kelmaydi : yozildi;

  return (
    <div>
      <div className="page-head">
        <h1>Lidlar</h1>
        <button className="btn" onClick={() => { setF(BOSH); setXato(''); setModal(true); }}>+ Yangi lid</button>
      </div>

      <div className="tabs">
        <button className={tab === 'yangi' ? 'tab on' : 'tab'} onClick={() => setTab('yangi')}>Qo'ng'iroq kutilmoqda ({yangi.length})</button>
        <button className={tab === 'kelmaydi' ? 'tab on' : 'tab'} onClick={() => setTab('kelmaydi')}>Kelmaydiganlar ({kelmaydi.length})</button>
        <button className={tab === 'yozildi' ? 'tab on' : 'tab'} onClick={() => setTab('yozildi')}>Yozilganlar ({yozildi.length})</button>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>ID</th><th>Ismi</th><th>Familiyasi</th><th>Telefon</th><th>Qanday topgan</th><th>Fan</th><th>Yaratilgan</th>
              {tab === 'kelmaydi' && <th>Nega kelmadi</th>}
              {tab === 'yozildi' && <th>O'quvchi</th>}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {korsatiladigan.map((r) => (
              <tr key={r.id}>
                <td className="mono">{r.id}</td>
                <td><b>{r.first_name}</b></td>
                <td><b>{r.last_name || '—'}</b></td>
                <td className="mono">{r.phone}{r.phone2 ? <div className="muted small">{r.phone2}</div> : null}</td>
                <td>{holat(r.source)}</td>
                <td>{r.subject ?? '—'}</td>
                <td>{sana(r.created_at)}</td>
                {tab === 'kelmaydi' && <td className="small">{r.note ?? '—'}</td>}
                {tab === 'yozildi' && <td>{r.student_id ? <Link to={`/oquvchilar/${r.student_id}`} className="mono">{r.student_id}</Link> : '—'}</td>}
                <td>
                  <div className="row-gap">
                    {tab === 'yangi' && (
                      <>
                        <button className="btn-sm" onClick={() => birikOch(r)}>Guruhga biriktirish</button>
                        <button className="btn-sm btn-danger" onClick={() => { setKelmadiLead(r); setIzoh(''); }}>Kelmadi</button>
                      </>
                    )}
                    {superadmin && <button className="btn-ghost small red" onClick={() => setOchirLead(r)}>O'chirish</button>}
                  </div>
                </td>
              </tr>
            ))}
            {korsatiladigan.length === 0 && (
              <tr><td colSpan={10} className="muted">
                {tab === 'yangi' ? "Qo'ng'iroq kutayotgan lid yo'q. \"+ Yangi lid\" bilan qo'shing." :
                 tab === 'kelmaydi' ? "Kelmaydiganlar ro'yxati bo'sh." : "Hali guruhga yozilgan lid yo'q."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title="Yangi lid (resepshn ro'yxati)" onClose={() => setModal(false)}>
          <form onSubmit={saqla} className="form-grid">
            <label>Ismi
              <input value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} required autoFocus />
            </label>
            <label>Familiyasi
              <input value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} required />
            </label>
            <label>Telefon
              <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+998 90 123 45 67" required />
            </label>
            <label>Qo'shimcha telefon (ixtiyoriy)
              <input value={f.phone2} onChange={(e) => setF({ ...f, phone2: e.target.value })} placeholder="bo'lsa kiriting" />
            </label>
            <label>Qanday topgan
              <select value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>
                {MANBALAR.map((m) => <option key={m} value={m}>{holat(m)}</option>)}
              </select>
            </label>
            <label>Fan
              <select value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })}>
                <option value="General">General (ingliz tili)</option>
                <option value="IELTS">IELTS</option>
              </select>
            </label>
            {xato && <div className="err span2">{xato}</div>}
            <button className="btn span2">Saqlash</button>
          </form>
        </Modal>
      )}

      {kelmadiLead && (
        <Modal title={`Kelmadi — ${kelmadiLead.first_name} ${kelmadiLead.last_name}`} onClose={() => setKelmadiLead(null)}>
          <form onSubmit={kelmadiSaqla} className="form-grid">
            <label className="span2">Nima uchun kelmadi? (majburiy)
              <textarea
                value={izoh}
                onChange={(e) => setIzoh(e.target.value)}
                rows={3}
                placeholder="Masalan: narx to'g'ri kelmadi / boshqa markazni tanladi / vaqti mos emas..."
                required
              />
            </label>
            <p className="muted small span2">Lid o'chirilmaydi — "Kelmaydiganlar" ro'yxatida izoh bilan saqlanadi.</p>
            <button className="btn span2" disabled={!izoh.trim()}>Saqlash</button>
          </form>
        </Modal>
      )}

      {birikLead && (
        <Modal title={`Guruhga biriktirish — ${birikLead.first_name} ${birikLead.last_name}`} onClose={() => setBirikLead(null)}>
          <form onSubmit={birikSaqla} className="form-grid">
            <label className="span2">Guruh
              <select value={tanlanganGuruh} onChange={(e) => setTanlanganGuruh(e.target.value)} required>
                <option value="">— Tanlang —</option>
                {guruhlar.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.id} · {g.levels?.name} · {KUNLAR[g.days_pattern]} {String(g.start_time).slice(0, 5)} · {holat(g.status)}
                  </option>
                ))}
              </select>
            </label>
            <p className="muted small span2">
              Lid avtomatik o'quvchiga aylantiriladi (bosqich guruhdan olinadi) va guruhga yoziladi.
              {guruhlar.length === 0 && " Hozircha ochiq guruh yo'q — avval Guruhlar bo'limida guruh oching."}
            </p>
            {bXato && <div className="err span2">{bXato}</div>}
            <button className="btn span2" disabled={!guruhlar.length}>Biriktirish</button>
          </form>
        </Modal>
      )}

      {ochirLead && (
        <Confirm
          text={`${ochirLead.first_name} ${ochirLead.last_name} (${ochirLead.id}) lidini o'chirishga ishonchingiz komilmi?`}
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
