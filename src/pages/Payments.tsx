import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { som, sana, joriyDavr } from '../lib/format';
import Modal from '../components/Modal';
import Badge from '../components/Badge';

const USULLAR: [string, string][] = [
  ['naqd', 'Naqd'],
  ['karta', 'Karta'],
  ['click', 'Click'],
  ['payme', 'Payme'],
];

export default function Payments() {
  const [tab, setTab] = useState<'oylik' | 'qarzdorlar'>('oylik');
  const [davr, setDavr] = useState(joriyDavr());
  const [rows, setRows] = useState<any[]>([]);
  const [qarzdorlar, setQarzdorlar] = useState<any[]>([]);
  const [qabul, setQabul] = useState<any>(null);
  const [summa, setSumma] = useState(0);
  const [usul, setUsul] = useState('naqd');
  const [band, setBand] = useState(false);
  const [tuzat, setTuzat] = useState<any>(null);
  const [tSumma, setTSumma] = useState(0);
  const [tUsul, setTUsul] = useState('');

  async function load() {
    const [p, q] = await Promise.all([
      supabase.from('payments').select('*, students(first_name, last_name)').eq('period', davr).order('status').order('id'),
      supabase.from('v_qarzdorlar').select('*').order('period'),
    ]);
    setRows(p.data ?? []);
    setQarzdorlar(q.data ?? []);
  }
  useEffect(() => { load(); }, [davr]);

  async function oylikYarat() {
    setBand(true);
    const { data, error } = await supabase.rpc('generate_monthly_payments', { p_period: davr });
    setBand(false);
    if (error) return alert('Xato: ' + error.message);
    alert(`${davr} uchun ${data} ta yangi to'lov yozuvi yaratildi.`);
    load();
  }

  function qabulOch(p: any) {
    setQabul(p);
    setSumma(Number(p.amount_due) - Number(p.amount_paid));
    setUsul('naqd');
  }

  async function qabulQil(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc('receive_payment', {
      p_payment_id: qabul.id,
      p_amount: summa,
      p_method: usul,
      p_received_by: null,
    });
    if (error) return alert('Xato: ' + error.message);
    setQabul(null);
    load();
  }

  function tuzatOch(p: any) {
    setTuzat(p);
    setTSumma(Number(p.amount_paid));
    setTUsul('');
  }

  async function tuzatSaqla(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc('correct_payment', {
      p_payment_id: tuzat.id,
      p_amount_paid: tSumma,
      p_method: tUsul || null,
    });
    if (error) return alert('Xato: ' + error.message);
    setTuzat(null);
    load();
  }

  const jami = rows.reduce((s, r) => s + Number(r.amount_due), 0);
  const tushdi = rows.reduce((s, r) => s + Number(r.amount_paid), 0);

  return (
    <div>
      <div className="page-head">
        <h1>To'lovlar</h1>
        <div className="row-gap">
          <input type="month" value={davr} onChange={(e) => setDavr(e.target.value)} />
          <button className="btn" onClick={oylikYarat} disabled={band}>{band ? '…' : `${davr} to'lovlarini yaratish`}</button>
        </div>
      </div>

      <div className="tabs">
        <button className={tab === 'oylik' ? 'tab on' : 'tab'} onClick={() => setTab('oylik')}>Oylik ro'yxat ({rows.length})</button>
        <button className={tab === 'qarzdorlar' ? 'tab on' : 'tab'} onClick={() => setTab('qarzdorlar')}>Qarzdorlar ({qarzdorlar.length})</button>
      </div>

      {tab === 'oylik' && (
        <div className="card">
          <div className="row-between">
            <h2>{davr} oyi</h2>
            <div className="muted">Reja: <b>{som(jami)}</b> · Tushdi: <b>{som(tushdi)}</b></div>
          </div>
          <table>
            <thead><tr><th>ID</th><th>O'quvchi</th><th>Guruh</th><th>Summa</th><th>To'langan</th><th>Holat</th><th>Sana</th><th></th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.id}</td>
                  <td><Link to={`/oquvchilar/${p.student_id}`}><b>{p.students?.first_name} {p.students?.last_name}</b></Link></td>
                  <td className="mono">{p.group_id}</td>
                  <td>{som(p.amount_due)}</td>
                  <td>{som(p.amount_paid)}</td>
                  <td><Badge s={p.status} /></td>
                  <td>{sana(p.paid_at)}</td>
                  <td>
                    <div className="row-gap">
                      {p.status !== 'tolangan' && <button className="btn-sm" onClick={() => qabulOch(p)}>Qabul qilish</button>}
                      {Number(p.amount_paid) > 0 && <button className="btn-ghost small" onClick={() => tuzatOch(p)}>To'g'rilash</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="muted">
                  {davr} uchun to'lov yozuvlari hali yaratilmagan — yuqoridagi tugmani bosing
                  (har bir faol a'zolik uchun chegirma hisobga olingan yozuv ochiladi).
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'qarzdorlar' && (
        <div className="card">
          <h2>Qarzdorlar (barcha davrlar)</h2>
          <table>
            <thead><tr><th>O'quvchi</th><th>Telefon</th><th>Guruh</th><th>Davr</th><th>Qarz</th><th>Holat</th></tr></thead>
            <tbody>
              {qarzdorlar.map((q, i) => (
                <tr key={i}>
                  <td><Link to={`/oquvchilar/${q.student_id}`}><b>{q.oquvchi}</b></Link></td>
                  <td className="mono">{q.phone}</td>
                  <td className="mono">{q.group_id}</td>
                  <td className="mono">{q.period}</td>
                  <td><b className="red">{som(q.qarz)}</b></td>
                  <td><Badge s={q.status} /></td>
                </tr>
              ))}
              {qarzdorlar.length === 0 && <tr><td colSpan={6} className="muted">Qarzdorlar yo'q 🎉</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tuzat && (
        <Modal title={`To'lovni to'g'rilash — ${tuzat.students?.first_name} ${tuzat.students?.last_name}`} onClose={() => setTuzat(null)}>
          <p className="muted">
            {tuzat.id} · {tuzat.period} · oylik summa: <b>{som(tuzat.amount_due)}</b> · hozir yozilgan: <b>{som(tuzat.amount_paid)}</b>
          </p>
          <form onSubmit={tuzatSaqla} className="form-grid">
            <label>To'g'ri summa (jami to'langan, so'm)
              <input
                type="number"
                value={tSumma}
                onChange={(e) => setTSumma(Number(e.target.value))}
                min="0"
                max={Number(tuzat.amount_due)}
                step="1"
                required
                autoFocus
              />
            </label>
            <label>Usul (ixtiyoriy)
              <select value={tUsul} onChange={(e) => setTUsul(e.target.value)}>
                <option value="">— O'zgartirmaslik —</option>
                {USULLAR.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <p className="muted small span2">
              Bu yerda xato kiritilgan to'lov TO'LIQ qiymatga almashtiriladi (qo'shilmaydi).
              0 yozsangiz to'lov bekor bo'lib, "Kutilmoqda" holatiga qaytadi. Holat va qarz avtomatik qayta hisoblanadi.
            </p>
            <button className="btn span2">Saqlash</button>
          </form>
        </Modal>
      )}

      {qabul && (
        <Modal title={`To'lov qabul qilish — ${qabul.students?.first_name} ${qabul.students?.last_name}`} onClose={() => setQabul(null)}>
          <p className="muted">{qabul.id} · {qabul.period} · qolgan qarz: <b>{som(Number(qabul.amount_due) - Number(qabul.amount_paid))}</b></p>
          <form onSubmit={qabulQil} className="form-grid">
            <label>Summa (so'm)
              <input
                type="number"
                value={summa}
                onChange={(e) => setSumma(Number(e.target.value))}
                min="1"
                max={Number(qabul.amount_due) - Number(qabul.amount_paid)}
                step="1"
                required
                autoFocus
              />
            </label>
            <label>Usul
              <select value={usul} onChange={(e) => setUsul(e.target.value)}>
                {USULLAR.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <p className="muted small span2">
              Qisman to'lash mumkin: kamroq summa kiritsangiz, qolgani "Qisman" holatida qarz bo'lib turadi
              va Qarzdorlar ro'yxatida ko'rinadi. Ortiqcha summa kiritib bo'lmaydi.
            </p>
            <button className="btn span2">Qabul qilish</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
