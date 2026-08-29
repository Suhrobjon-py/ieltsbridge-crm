import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { som, sana, joriyDavr } from '../lib/format';
import Modal from '../components/Modal';
import Confirm from '../components/Confirm';
import { useRole } from '../lib/role';

function keyingiOy(davr: string): string {
  const [y, m] = davr.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

export default function Expenses() {
  const { canDelete } = useRole();
  const [davr, setDavr] = useState(joriyDavr());
  const [rows, setRows] = useState<any[]>([]);
  const [maoshlar, setMaoshlar] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [modal, setModal] = useState<null | { id?: number }>(null);
  const [nomi, setNomi] = useState('');
  const [miqdor, setMiqdor] = useState<number | ''>('');
  const [xato, setXato] = useState('');
  const [ochirTasdiq, setOchirTasdiq] = useState(false);

  async function load() {
    const [ex, sal, tc] = await Promise.all([
      supabase.from('expenses').select('*')
        .gte('spent_at', `${davr}-01`).lt('spent_at', `${keyingiOy(davr)}-01`)
        .order('spent_at', { ascending: false }).order('id', { ascending: false }),
      supabase.from('teacher_salaries').select('*').eq('period', davr),
      supabase.from('teachers').select('id, full_name'),
    ]);
    setRows(ex.data ?? []);
    setMaoshlar(sal.data ?? []);
    setTeachers(tc.data ?? []);
  }
  useEffect(() => { load(); }, [davr]);

  function yangiOch() {
    setModal({});
    setNomi('');
    setMiqdor('');
    setXato('');
  }

  function tahrirOch(r: any) {
    setModal({ id: r.id });
    setNomi(r.name);
    setMiqdor(Number(r.amount));
    setXato('');
  }

  async function saqla(e: React.FormEvent) {
    e.preventDefault();
    setXato('');
    const body = { name: nomi.trim(), amount: miqdor === '' ? 0 : miqdor };
    if (!body.name) return setXato('Nomini kiriting');
    const q = modal?.id
      ? supabase.from('expenses').update(body).eq('id', modal.id)
      : supabase.from('expenses').insert(body);
    const { error } = await q;
    if (error) return setXato(error.message);
    setModal(null);
    load();
  }

  async function ochir() {
    setOchirTasdiq(false);
    if (!modal?.id) return;
    const { error } = await supabase.from('expenses').delete().eq('id', modal.id);
    if (error) {
      if (error.code === '42501') return setXato("O'chirish faqat Superadmin uchun ruxsat etilgan.");
      return setXato(error.message);
    }
    setModal(null);
    load();
  }

  const tName = (id: string) => teachers.find((t) => t.id === id)?.full_name ?? id;
  const jamiXarajat = rows.reduce((s, r) => s + Number(r.amount), 0);
  const jamiMaosh = maoshlar.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div>
      <div className="page-head">
        <h1>Xarajatlar</h1>
        <div className="row-gap">
          <input type="month" value={davr} onChange={(e) => setDavr(e.target.value)} />
          <button className="btn btn-plus" title="Yangi xarajat qo'shish" onClick={yangiOch}>+</button>
        </div>
      </div>

      <div className="card">
        <div className="row-between">
          <h2>{davr} oyi</h2>
          <div className="muted">
            Xarajatlar: <b>{som(jamiXarajat)}</b> · Maoshlar: <b>{som(jamiMaosh)}</b> · Jami: <b>{som(jamiXarajat + jamiMaosh)}</b>
          </div>
        </div>
        <table>
          <thead><tr><th>Sana</th><th>Nomi</th><th>Miqdori</th><th></th></tr></thead>
          <tbody>
            {maoshlar.map((m) => (
              <tr key={'m' + m.id}>
                <td>{sana(m.paid_at)}</td>
                <td><span className="badge badge-blue">Maosh</span> <b>{tName(m.teacher_id)}</b>{m.student_count ? <span className="muted small"> ({m.student_count} o'quvchi × {som(m.rate)})</span> : null}</td>
                <td>{som(m.amount)}</td>
                <td><Link to="/hisobotlar" className="muted small">Hisobotlarda boshqariladi</Link></td>
              </tr>
            ))}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{sana(r.spent_at)}</td>
                <td><b>{r.name}</b></td>
                <td>{som(r.amount)}</td>
                <td><button className="btn-ghost small" onClick={() => tahrirOch(r)}>Tahrirlash</button></td>
              </tr>
            ))}
            {rows.length === 0 && maoshlar.length === 0 && (
              <tr><td colSpan={4} className="muted">Bu oyda xarajat yozuvi yo'q. Yuqoridagi "+" bilan qo'shing.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal.id ? 'Xarajatni tahrirlash' : 'Yangi xarajat'} onClose={() => setModal(null)}>
          <form onSubmit={saqla} className="form-grid">
            <label className="span2">Xarajat nomi
              <input value={nomi} onChange={(e) => setNomi(e.target.value)} placeholder="Masalan: Internet, Ijara, Kanstovar..." required autoFocus />
            </label>
            <label className="span2">Miqdori (so'm)
              <input type="number" value={miqdor} onChange={(e) => setMiqdor(e.target.value === '' ? '' : Number(e.target.value))} min="0" step="1" required />
            </label>
            {xato && <div className="err span2">{xato}</div>}
            <div className="row-between span2">
              {modal.id && canDelete('xarajatlar') ? <button type="button" className="btn-sm btn-danger" onClick={() => setOchirTasdiq(true)}>O'chirish</button> : <span />}
              <button className="btn">Saqlash</button>
            </div>
          </form>
        </Modal>
      )}

      {ochirTasdiq && (
        <Confirm
          text={`"${nomi}" xarajatini o'chirishga ishonchingiz komilmi?`}
          onHa={ochir}
          onYoq={() => setOchirTasdiq(false)}
        />
      )}
    </div>
  );
}
