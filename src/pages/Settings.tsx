import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Modal from '../components/Modal';
import Confirm from '../components/Confirm';
import { useRole } from '../lib/role';

export default function Settings() {
  const { role, superadmin } = useRole();
  const [fanlar, setFanlar] = useState<any[]>([]);
  const [modal, setModal] = useState<null | { id?: number }>(null);
  const [nomi, setNomi] = useState('');
  const [xato, setXato] = useState('');
  const [ochirFan, setOchirFan] = useState<any>(null);

  async function load() {
    const { data } = await supabase.from('subjects').select('*').order('id');
    setFanlar(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function saqla(e: React.FormEvent) {
    e.preventDefault();
    setXato('');
    if (!nomi.trim()) return;
    const q = modal?.id
      ? supabase.from('subjects').update({ name: nomi.trim() }).eq('id', modal.id)
      : supabase.from('subjects').insert({ name: nomi.trim() });
    const { error } = await q;
    if (error) return setXato(error.code === '23505' ? 'Bu fan allaqachon mavjud' : error.message);
    setModal(null);
    load();
  }

  async function faollikOzgar(f: any) {
    await supabase.from('subjects').update({ faol: !f.faol }).eq('id', f.id);
    load();
  }

  async function ochir() {
    const f = ochirFan;
    setOchirFan(null);
    const { error } = await supabase.from('subjects').delete().eq('id', f.id);
    if (error) return alert(error.code === '42501' ? "O'chirish faqat Bosh admin uchun." : 'Xato: ' + error.message);
    load();
  }

  return (
    <div>
      <div className="page-head"><h1>Sozlamalar</h1></div>

      <div className="grid2">
        <div className="card">
          <div className="row-between">
            <h2>Fanlar</h2>
            <button className="btn btn-plus" title="Yangi fan" onClick={() => { setNomi(''); setXato(''); setModal({}); }}>+</button>
          </div>
          <p className="muted small">
            Lidlar va o'qituvchilar shu ro'yxatdagi fanlarga bog'lanadi. Ingliz tili yo'nalishi (General/IELTS)
            bosqichli o'quv dasturi bilan ishlaydi; boshqa fanlar uchun lid/sinov jarayoni to'liq ishlaydi.
          </p>
          <table>
            <thead><tr><th>Fan</th><th>Holati</th><th></th></tr></thead>
            <tbody>
              {fanlar.map((f) => (
                <tr key={f.id}>
                  <td><b>{f.name}</b></td>
                  <td>
                    <button className={'badge badge-' + (f.faol ? 'green' : 'gray')} style={{ border: 'none', cursor: 'pointer' }}
                      onClick={() => faollikOzgar(f)} title="Bosib faollikni almashtiring">
                      {f.faol ? 'Faol' : "O'chirilgan"}
                    </button>
                  </td>
                  <td>
                    <div className="row-gap">
                      <button className="btn-ghost small" onClick={() => { setNomi(f.name); setXato(''); setModal({ id: f.id }); }}>Tahrirlash</button>
                      {superadmin && <button className="btn-ghost small red" onClick={() => setOchirFan(f)}>O'chirish</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2>Tizim haqida</h2>
          <div className="kv"><span>Sizning rolingiz</span><b>{role === 'superadmin' ? 'Bosh admin (Superadmin)' : 'Admin'}</b></div>
          <div className="kv"><span>Bosh admin huquqi</span><b>Barcha bo'limlarda o'chirish</b></div>
          <div className="kv"><span>Admin huquqi</span><b>Qo'shish va tahrirlash (o'chirishsiz)</b></div>
          <p className="muted small" style={{ marginTop: 10 }}>
            Yangi xodimga rol berish hozircha bazadagi <span className="mono">staff_roles</span> jadvali orqali.
            Demo ma'lumotlarni olib tashlash: <span className="mono">supabase/demo_ochirish.sql</span>.
          </p>
        </div>
      </div>

      {modal && (
        <Modal title={modal.id ? 'Fanni tahrirlash' : 'Yangi fan'} onClose={() => setModal(null)}>
          <form onSubmit={saqla} className="form-grid">
            <label className="span2">Fan nomi
              <input value={nomi} onChange={(e) => setNomi(e.target.value)} placeholder="Masalan: Matematika, Rus tili, Arab tili..." required autoFocus />
            </label>
            {xato && <div className="err span2">{xato}</div>}
            <button className="btn span2">Saqlash</button>
          </form>
        </Modal>
      )}

      {ochirFan && (
        <Confirm text={`"${ochirFan.name}" fani o'chirilsinmi?`} onHa={ochir} onYoq={() => setOchirFan(null)} />
      )}
    </div>
  );
}
