import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { sana, holat } from '../lib/format';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import Confirm from '../components/Confirm';
import { useRole } from '../lib/role';

const HOLATLAR = ['yangi', 'aloqa_qilindi', 'sinov_belgilandi', 'sinovga_keldi', 'yozildi', 'yoqotildi'];
const MANBALAR = ['instagram', 'telegram', 'tavsiya', 'dostlar', 'boshqa'];

export default function Leads() {
  const { superadmin } = useRole();
  const [ochirLead, setOchirLead] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [f, setF] = useState<any>({ full_name: '', phone: '', source: 'instagram', interested_level: '', note: '' });
  const [xato, setXato] = useState('');

  async function load() {
    const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false }).order('id', { ascending: false });
    setRows(data ?? []);
  }
  useEffect(() => {
    load();
    supabase.from('levels').select('code,name').order('sort_order').then(({ data }) => setLevels(data ?? []));
  }, []);

  async function saqla(e: React.FormEvent) {
    e.preventDefault();
    setXato('');
    const { error } = await supabase.from('leads').insert({ ...f, interested_level: f.interested_level || null });
    if (error) return setXato(error.message);
    setModal(false);
    setF({ full_name: '', phone: '', source: 'instagram', interested_level: '', note: '' });
    load();
  }

  async function holatOzgar(id: string, status: string) {
    await supabase.from('leads').update({ status }).eq('id', id);
    load();
  }

  async function oquvchigaAylantir(lead: any) {
    const parts = String(lead.full_name).trim().split(/\s+/);
    const first = parts[0] ?? lead.full_name;
    const last = parts.slice(1).join(' ') || '—';
    const { data, error } = await supabase
      .from('students')
      .insert({ first_name: first, last_name: last, phone: lead.phone, source: lead.source, current_level_code: lead.interested_level })
      .select('id')
      .single();
    if (error) return alert('Xato: ' + error.message);
    await supabase.from('leads').update({ status: 'yozildi', student_id: data.id }).eq('id', lead.id);
    load();
    alert(`${lead.full_name} o'quvchi sifatida qo'shildi (${data.id}). Endi uni guruhga biriktiring.`);
  }

  return (
    <div>
      <div className="page-head">
        <h1>Lidlar</h1>
        <button className="btn" onClick={() => setModal(true)}>+ Yangi lid</button>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>ID</th><th>Ism</th><th>Telefon</th><th>Manba</th><th>Bosqich</th><th>Holat</th><th>Sinov</th><th>Yaratilgan</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="mono">{r.id}</td>
                <td><b>{r.full_name}</b>{r.note ? <div className="muted small">{r.note}</div> : null}</td>
                <td className="mono">{r.phone}</td>
                <td>{holat(r.source) === r.source ? r.source : holat(r.source)}</td>
                <td>{r.interested_level ?? '—'}</td>
                <td>
                  <select className="sel-inline" value={r.status} onChange={(e) => holatOzgar(r.id, e.target.value)}>
                    {HOLATLAR.map((h) => <option key={h} value={h}>{holat(h)}</option>)}
                  </select>
                </td>
                <td>{sana(r.trial_date)}</td>
                <td>{sana(r.created_at)}</td>
                <td>
                  <div className="row-gap">
                    {r.status !== 'yozildi' && r.status !== 'yoqotildi' && (
                      <button className="btn-sm" onClick={() => oquvchigaAylantir(r)}>O'quvchiga aylantirish</button>
                    )}
                    {r.student_id && <Badge s="yozildi" />}
                    {superadmin && <button className="btn-ghost small red" onClick={() => setOchirLead(r)}>O'chirish</button>}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={9} className="muted">Hozircha lid yo'q. "+ Yangi lid" bilan qo'shing.</td></tr>}
          </tbody>
        </table>
      </div>

      {ochirLead && (
        <Confirm
          text={`${ochirLead.full_name} (${ochirLead.id}) lidini o'chirishga ishonchingiz komilmi?`}
          onHa={async () => {
            const { error } = await supabase.from('leads').delete().eq('id', ochirLead.id);
            setOchirLead(null);
            if (error) return alert(error.code === '42501' ? "O'chirish faqat Superadmin uchun." : 'Xato: ' + error.message);
            load();
          }}
          onYoq={() => setOchirLead(null)}
        />
      )}

      {modal && (
        <Modal title="Yangi lid" onClose={() => setModal(false)}>
          <form onSubmit={saqla} className="form-grid">
            <label>Ism-familiya
              <input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} required autoFocus />
            </label>
            <label>Telefon
              <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+998 90 123 45 67" required />
            </label>
            <label>Manba
              <select value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>
                {MANBALAR.map((m) => <option key={m} value={m}>{holat(m)}</option>)}
              </select>
            </label>
            <label>Qiziqqan bosqich
              <select value={f.interested_level} onChange={(e) => setF({ ...f, interested_level: e.target.value })}>
                <option value="">— Noma'lum —</option>
                {levels.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
              </select>
            </label>
            <label className="span2">Izoh
              <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
            </label>
            {xato && <div className="err span2">{xato}</div>}
            <button className="btn span2">Saqlash</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
