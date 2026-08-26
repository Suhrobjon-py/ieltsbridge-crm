import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { sana, holat } from '../lib/format';
import Modal from '../components/Modal';
import Confirm from '../components/Confirm';
import { useRole } from '../lib/role';

const BOSH = { full_name: '', phone: '', general: true, ielts: false, degree: 'main', hire_date: '' };

export default function Teachers() {
  const { superadmin } = useRole();
  const [rows, setRows] = useState<any[]>([]);
  const [modal, setModal] = useState<null | { id?: string }>(null);
  const [f, setF] = useState<any>(BOSH);
  const [xato, setXato] = useState('');
  const [ochirId, setOchirId] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.from('teachers').select('*').order('id');
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  function yangiOch() {
    setF(BOSH);
    setXato('');
    setModal({});
  }

  function tahrirOch(r: any) {
    setF({
      full_name: r.full_name,
      phone: r.phone,
      general: String(r.levels).includes('General'),
      ielts: String(r.levels).includes('IELTS'),
      degree: r.degree ?? 'main',
      hire_date: r.hire_date ?? '',
    });
    setXato('');
    setModal({ id: r.id });
  }

  async function saqla(e: React.FormEvent) {
    e.preventDefault();
    setXato('');
    if (!f.general && !f.ielts) return setXato('Kamida bitta bosqich tanlang (General yoki IELTS)');
    const body = {
      full_name: f.full_name,
      phone: f.phone,
      levels: [f.general && 'General', f.ielts && 'IELTS'].filter(Boolean).join(','),
      degree: f.degree,
      hire_date: f.hire_date || null,
    };
    const q = modal?.id
      ? supabase.from('teachers').update(body).eq('id', modal.id)
      : supabase.from('teachers').insert(body);
    const { error } = await q;
    if (error) return setXato(error.message);
    setModal(null);
    load();
  }

  async function ochir() {
    if (!ochirId) return;
    const { error } = await supabase.from('teachers').delete().eq('id', ochirId);
    setOchirId(null);
    if (error) {
      if (error.code === '23503') return alert("O'chirib bo'lmadi: bu o'qituvchiga guruhlar yoki boshqa yozuvlar bog'langan. Avval ularni boshqa o'qituvchiga o'tkazing yoki holatini 'ketgan' qiling.");
      return alert('Xato: ' + error.message);
    }
    load();
  }

  async function holatOzgar(id: string, status: string) {
    await supabase.from('teachers').update({ status }).eq('id', id);
    load();
  }

  return (
    <div>
      <div className="page-head">
        <h1>O'qituvchilar</h1>
        <button className="btn" onClick={yangiOch}>+ Yangi o'qituvchi</button>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>ID</th><th>Ism-familiya</th><th>Telefon</th><th>Bosqichlari</th><th>Daraja</th><th>Ishga olingan</th><th>Holat</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="mono">{r.id}</td>
                <td><Link to={`/oqituvchilar/${r.id}`}><b>{r.full_name}</b></Link></td>
                <td className="mono">{r.phone}</td>
                <td>{r.levels || '—'}</td>
                <td>{r.degree === 'support' ? <span className="badge badge-blue">Support</span> : <span className="badge badge-green">Main</span>}</td>
                <td>{sana(r.hire_date)}</td>
                <td>
                  <select className="sel-inline" value={r.status} onChange={(e) => holatOzgar(r.id, e.target.value)}>
                    {['faol', 'tatil', 'ketgan'].map((h) => <option key={h} value={h}>{holat(h)}</option>)}
                  </select>
                </td>
                <td>
                  <div className="row-gap">
                    <button className="btn-ghost small" onClick={() => tahrirOch(r)}>Tahrirlash</button>
                    {superadmin && <button className="btn-ghost small red" onClick={() => setOchirId(r.id)}>O'chirish</button>}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="muted">Hozircha o'qituvchi yo'q.</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal.id ? `O'qituvchini tahrirlash — ${modal.id}` : "Yangi o'qituvchi"} onClose={() => setModal(null)}>
          <form onSubmit={saqla} className="form-grid">
            <label>Ism-familiya
              <input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} required autoFocus />
            </label>
            <label>Telefon
              <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} required />
            </label>
            <label className="span2">Bosqichlari
              <div className="row-gap" style={{ paddingTop: 4 }}>
                <label className="check-line"><input type="checkbox" checked={f.general} onChange={(e) => setF({ ...f, general: e.target.checked })} /> General (Beginner - Advanced)</label>
                <label className="check-line"><input type="checkbox" checked={f.ielts} onChange={(e) => setF({ ...f, ielts: e.target.checked })} /> IELTS</label>
              </div>
            </label>
            <label>Daraja
              <select value={f.degree} onChange={(e) => setF({ ...f, degree: e.target.value })}>
                <option value="main">Asosiy (Main)</option>
                <option value="support">Yordamchi (Support)</option>
              </select>
            </label>
            <label>Ishga olingan sana
              <input type="date" value={f.hire_date} onChange={(e) => setF({ ...f, hire_date: e.target.value })} />
            </label>
            {xato && <div className="err span2">{xato}</div>}
            <button className="btn span2">Saqlash</button>
          </form>
        </Modal>
      )}

      {ochirId && (
        <Confirm
          text={`${rows.find((r) => r.id === ochirId)?.full_name ?? ochirId} o'chirilsinmi? O'chirishga ishonchingiz komilmi?`}
          onHa={ochir}
          onYoq={() => setOchirId(null)}
        />
      )}
    </div>
  );
}
