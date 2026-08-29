import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { som, sana, KUNLAR, uchOyKeyin, holat } from '../lib/format';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import TimeSelect from '../components/TimeSelect';

export default function Groups() {
  const nav = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [f, setF] = useState<any>({ level_code: 'BEG', teacher_id: '', support_id: '', days_pattern: 'DCJ', start_time: '18:00', start_date: '', monthly_fee: 400000, capacity: 12, room_id: '' });
  const [xato, setXato] = useState('');
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);

  async function load() {
    const { data } = await supabase.from('groups')
      .select('*, teachers!groups_teacher_id_fkey(full_name), support:teachers!groups_support_teacher_id_fkey(full_name), levels(name)')
      .order('start_date', { ascending: false });
    setRows(data ?? []);
  }
  const [rooms, setRooms] = useState<any[]>([]);
  useEffect(() => {
    load();
    supabase.from('levels').select('code,name').order('sort_order').then(({ data }) => setLevels(data ?? []));
    supabase.from('teachers').select('id,full_name,degree').eq('status', 'faol').order('id').then(({ data }) => setTeachers(data ?? []));
    supabase.from('rooms').select('id,name').order('id').then(({ data }) => setRooms(data ?? []));
  }, []);

  const mains = teachers.filter((t) => t.degree !== 'support');
  const supports = teachers.filter((t) => t.degree === 'support');

  async function saqla(e: React.FormEvent) {
    e.preventDefault();
    setXato('');
    if (!f.teacher_id) return setXato("O'qituvchi tanlang (avval O'qituvchilar sahifasida qo'shing)");
    if (!f.start_date) return setXato('Boshlanish sanasini kiriting');
    setSaqlanmoqda(true);
    try {
      const { data: gid, error: e1 } = await supabase.rpc('make_group_id', { p_level: f.level_code, p_start: f.start_date });
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('groups').insert({
        id: gid,
        level_code: f.level_code,
        teacher_id: f.teacher_id,
        support_teacher_id: f.support_id || null,
        room_id: f.room_id || null,
        days_pattern: f.days_pattern,
        start_time: f.start_time,
        start_date: f.start_date,
        end_date_planned: uchOyKeyin(f.start_date),
        status: 'rejada',
        capacity: f.capacity,
        monthly_fee: f.monthly_fee,
      });
      if (e2) throw e2;
      const { data: n, error: e3 } = await supabase.rpc('generate_sessions', { p_group_id: gid });
      if (e3) throw e3;
      setModal(false);
      alert(`Guruh yaratildi: ${gid}. ${n} ta dars jadvalga qo'yildi (${KUNLAR[f.days_pattern]}).`);
      nav(`/guruhlar/${gid}`);
    } catch (err: any) {
      setXato(err.message ?? String(err));
    } finally {
      setSaqlanmoqda(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Guruhlar</h1>
        <button className="btn" onClick={() => setModal(true)}>+ Yangi guruh</button>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>ID</th><th>Bosqich</th><th>O'qituvchi</th><th>Jadval</th><th>Boshlanish</th><th>Narx/oy</th><th>Holat</th></tr></thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.id}>
                <td><Link to={`/guruhlar/${g.id}`} className="mono"><b>{g.id}</b></Link></td>
                <td>{g.levels?.name ?? g.level_code}</td>
                <td>{g.teachers?.full_name ?? g.teacher_id}{g.support?.full_name ? <div className="muted small">+ {g.support.full_name}</div> : null}</td>
                <td>{KUNLAR[g.days_pattern]} · {String(g.start_time).slice(0, 5)}</td>
                <td>{sana(g.start_date)}</td>
                <td>{som(g.monthly_fee)}</td>
                <td>
                  <select className="sel-inline" value={g.status} onChange={async (e) => { await supabase.from('groups').update({ status: e.target.value }).eq('id', g.id); load(); }}>
                    {['rejada', 'faol', 'imtihon', 'yakunlangan', 'bekor'].map((h) => <option key={h} value={h}>{holat(h)}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="muted">Hozircha guruh yo'q. Avval o'qituvchi qo'shing, keyin guruh oching.</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title="Yangi guruh (36 ta dars avtomatik rejalashtiriladi)" onClose={() => setModal(false)}>
          <form onSubmit={saqla} className="form-grid">
            <label>Bosqich
              <select value={f.level_code} onChange={(e) => setF({ ...f, level_code: e.target.value })}>
                {levels.map((l) => <option key={l.code} value={l.code}>{l.name} ({l.code})</option>)}
              </select>
            </label>
            <label>Asosiy o'qituvchi *
              <select value={f.teacher_id} onChange={(e) => setF({ ...f, teacher_id: e.target.value })} required>
                <option value="">— Tanlang —</option>
                {mains.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
            </label>
            <label>Yordamchi o'qituvchi
              <select value={f.support_id} onChange={(e) => setF({ ...f, support_id: e.target.value })}>
                <option value="">— Yo'q —</option>
                {supports.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
            </label>
            <label>Dars kunlari
              <select value={f.days_pattern} onChange={(e) => setF({ ...f, days_pattern: e.target.value })}>
                <option value="DCJ">Dushanba · Chorshanba · Juma</option>
                <option value="SPS">Seshanba · Payshanba · Shanba</option>
              </select>
            </label>
            <label>Dars vaqti
              <TimeSelect value={f.start_time} onChange={(v) => setF({ ...f, start_time: v })} />
            </label>
            <label>Boshlanish sanasi
              <input type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} required />
            </label>
            <label>Oylik narx (so'm)
              <input type="number" value={f.monthly_fee} onChange={(e) => setF({ ...f, monthly_fee: Number(e.target.value) })} step="1" min="0" required />
            </label>
            <label>Sig'im
              <input type="number" value={f.capacity} onChange={(e) => setF({ ...f, capacity: Number(e.target.value) })} min="1" max="30" />
            </label>
            <label>Xona (ixtiyoriy)
              <select value={f.room_id} onChange={(e) => setF({ ...f, room_id: e.target.value })}>
                <option value="">— Tanlanmagan —</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
            {xato && <div className="err span2">{xato}</div>}
            <button className="btn span2" disabled={saqlanmoqda}>{saqlanmoqda ? 'Yaratilmoqda…' : 'Guruhni yaratish'}</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
