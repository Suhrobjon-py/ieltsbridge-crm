import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { sana } from '../lib/format';
import Modal from '../components/Modal';
import Badge from '../components/Badge';

export default function Students() {
  const [rows, setRows] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [qidiruv, setQidiruv] = useState('');
  const [modal, setModal] = useState(false);
  const [f, setF] = useState<any>({ first_name: '', last_name: '', phone: '', parent_name: '', parent_phone: '', current_level_code: '', birth_date: '' });
  const [xato, setXato] = useState('');

  async function load() {
    let q = supabase.from('students').select('*').order('id', { ascending: false }).limit(300);
    if (qidiruv.trim()) {
      const s = qidiruv.trim();
      q = q.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,phone.ilike.%${s}%,id.ilike.%${s}%`);
    }
    const { data } = await q;
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, [qidiruv]);
  useEffect(() => {
    supabase.from('levels').select('code,name').order('sort_order').then(({ data }) => setLevels(data ?? []));
  }, []);

  async function saqla(e: React.FormEvent) {
    e.preventDefault();
    setXato('');
    const body = { ...f, current_level_code: f.current_level_code || null, birth_date: f.birth_date || null };
    const { error } = await supabase.from('students').insert(body);
    if (error) return setXato(error.message);
    setModal(false);
    setF({ first_name: '', last_name: '', phone: '', parent_name: '', parent_phone: '', current_level_code: '', birth_date: '' });
    load();
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
      <div className="card">
        <table>
          <thead><tr><th>ID</th><th>Ism-familiya</th><th>Telefon</th><th>Bosqich</th><th>Holat</th><th>Kelgan</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="mono">{r.id}</td>
                <td><Link to={`/oquvchilar/${r.id}`}><b>{r.first_name} {r.last_name}</b></Link></td>
                <td className="mono">{r.phone}</td>
                <td>{r.current_level_code ?? '—'}</td>
                <td><Badge s={r.status} /></td>
                <td>{sana(r.joined_at)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="muted">O'quvchi topilmadi.</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title="Yangi o'quvchi" onClose={() => setModal(false)}>
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
            <label>Tug'ilgan sana
              <input type="date" value={f.birth_date} onChange={(e) => setF({ ...f, birth_date: e.target.value })} />
            </label>
            <label>Ota-ona ismi
              <input value={f.parent_name} onChange={(e) => setF({ ...f, parent_name: e.target.value })} />
            </label>
            <label>Ota-ona telefoni
              <input value={f.parent_phone} onChange={(e) => setF({ ...f, parent_phone: e.target.value })} />
            </label>
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
