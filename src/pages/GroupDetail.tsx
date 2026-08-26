import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { som, sana, KUNLAR, bugunISO, holat } from '../lib/format';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import TimeSelect from '../components/TimeSelect';

const DAVOMAT = ['keldi', 'kechikdi', 'kelmadi', 'sababli'];

export default function GroupDetail() {
  const { id } = useParams();
  const [g, setG] = useState<any>(null);
  const [tab, setTab] = useState<'jurnal' | 'oquvchilar'>('jurnal');
  const [azolik, setAzolik] = useState<any[]>([]);
  const [jurnal, setJurnal] = useState<any[]>([]);
  const [progress, setProgress] = useState<Record<string, any>>({});
  const [qoshishModal, setQoshishModal] = useState(false);
  const [nomzodlar, setNomzodlar] = useState<any[]>([]);
  const [tanlangan, setTanlangan] = useState('');
  const [chegirma, setChegirma] = useState(0);
  const [ochiqSessiya, setOchiqSessiya] = useState<any>(null);
  const [davomat, setDavomat] = useState<Record<string, string>>({});
  const [xato, setXato] = useState('');
  const [teachers, setTeachers] = useState<any[]>([]);
  const [ruxsat, setRuxsat] = useState<Record<string, any>>({});
  const [sozModal, setSozModal] = useState(false);
  const [sf, setSf] = useState<any>(null);
  const [sXato, setSXato] = useState('');

  const [davHolat, setDavHolat] = useState<Record<string, any>>({});

  async function load() {
    const [gr, en, se, pr, tc, rx, dh] = await Promise.all([
      supabase.from('groups').select('*, teachers!groups_teacher_id_fkey(full_name), support:teachers!groups_support_teacher_id_fkey(full_name), levels(name)').eq('id', id).single(),
      supabase.from('enrollments').select('*, students(id, first_name, last_name, phone)').eq('group_id', id).order('id'),
      supabase.from('v_guruh_jurnali').select('*').eq('group_id', id).order('session_date'),
      supabase.from('v_oquvchi_progress').select('*').eq('group_id', id),
      supabase.from('teachers').select('id, full_name, degree').eq('status', 'faol').order('id'),
      supabase.from('v_ilova_ruxsat').select('*').eq('group_id', id),
      supabase.from('v_davomat_holat').select('*').eq('group_id', id),
    ]);
    setG(gr.data);
    setAzolik(en.data ?? []);
    setJurnal(se.data ?? []);
    const pm: Record<string, any> = {};
    for (const p of pr.data ?? []) pm[p.student_id] = p;
    setProgress(pm);
    setTeachers(tc.data ?? []);
    const rm: Record<string, any> = {};
    for (const r of rx.data ?? []) rm[r.student_id] = r;
    setRuxsat(rm);
    const dm: Record<string, any> = {};
    for (const d of dh.data ?? []) dm[d.student_id] = d;
    setDavHolat(dm);
  }
  useEffect(() => { load(); }, [id]);

  // Test natijalari CRM'da kiritilmaydi — o'qituvchi mobil ilovasi assessment_results ga
  // yozadi, hukmni (o'tdi/qayta/takrorlaydi) bazadagi trg_natija triggeri chiqaradi.

  function sozOch() {
    setSXato('');
    setSf({
      teacher_id: g.teacher_id,
      support_id: g.support_teacher_id ?? '',
      room_id: g.room_id ?? '',
      days_pattern: g.days_pattern,
      start_time: String(g.start_time).slice(0, 5),
      start_date: g.start_date,
      monthly_fee: Number(g.monthly_fee),
      capacity: g.capacity,
      status: g.status,
    });
    setSozModal(true);
  }

  async function sozSaqla(e: React.FormEvent) {
    e.preventDefault();
    setSXato('');
    let room = null;
    if (String(sf.room_id).trim()) {
      room = String(sf.room_id).trim().toUpperCase();
      await supabase.from('rooms').upsert({ id: room, name: room }, { onConflict: 'id' });
    }
    const jadvalOzgardi = sf.days_pattern !== g.days_pattern || sf.start_date !== g.start_date;
    const { error } = await supabase.from('groups').update({
      teacher_id: sf.teacher_id,
      support_teacher_id: sf.support_id || null,
      room_id: room,
      days_pattern: sf.days_pattern,
      start_time: sf.start_time,
      start_date: sf.start_date,
      monthly_fee: sf.monthly_fee,
      capacity: sf.capacity,
      status: sf.status,
    }).eq('id', id);
    if (error) return setSXato(error.message);
    if (jadvalOzgardi) {
      const { data: n, error: e2 } = await supabase.rpc('reschedule_sessions', { p_group_id: id });
      if (e2) return setSXato('Jadvalni qayta hisoblashda xato: ' + e2.message);
      alert(`Jadval yangilandi: ${n} ta rejadagi dars yangi kunlarga ko'chirildi (o'tilgan darslar joyida qoldi).`);
    }
    setSozModal(false);
    load();
  }

  async function nomzodlarniYukla() {
    const { data } = await supabase.from('students').select('id, first_name, last_name').eq('status', 'faol').order('id');
    const bor = new Set(azolik.map((a) => a.student_id));
    setNomzodlar((data ?? []).filter((s) => !bor.has(s.id)));
    setQoshishModal(true);
  }

  async function oquvchiQosh(e: React.FormEvent) {
    e.preventDefault();
    setXato('');
    if (!tanlangan) return setXato("O'quvchi tanlang");
    const { error } = await supabase.from('enrollments').insert({ student_id: tanlangan, group_id: id, discount_pct: chegirma });
    if (error) return setXato(error.message);
    setQoshishModal(false);
    setTanlangan('');
    setChegirma(0);
    load();
  }

  async function sessiyaOch(s: any) {
    setOchiqSessiya(s);
    const { data } = await supabase.from('attendance').select('student_id, status').eq('session_id', s.id);
    const d: Record<string, string> = {};
    for (const a of azolik.filter((x) => x.status === 'faol')) d[a.student_id] = 'keldi';
    for (const row of data ?? []) d[row.student_id] = row.status;
    setDavomat(d);
  }

  async function davomatSaqla() {
    const rows = Object.entries(davomat).map(([student_id, status]) => ({ session_id: ochiqSessiya.id, student_id, status }));
    const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'session_id,student_id' });
    if (error) return alert('Xato: ' + error.message);
    await supabase.from('sessions').update({ status: 'otildi' }).eq('id', ochiqSessiya.id);
    setOchiqSessiya(null);
    load();
  }

  if (!g) return <p className="muted">Yuklanmoqda…</p>;

  const bugun = bugunISO();
  const faolAzolar = azolik.filter((a) => a.status === 'faol');

  return (
    <div>
      <div className="page-head">
        <h1 className="mono">{g.id}</h1>
        <div className="row-gap">
          <Badge s={g.status} />
          <button className="btn-sm" onClick={sozOch}>⚙ Sozlamalar</button>
        </div>
      </div>
      <div className="card group-info">
        <div className="kv"><span>Bosqich</span><b>{g.levels?.name}</b></div>
        <div className="kv"><span>O'qituvchi (Main)</span><b>{g.teachers?.full_name}</b></div>
        <div className="kv"><span>Yordamchi (Support)</span><b>{g.support?.full_name ?? '—'}</b></div>
        <div className="kv"><span>Jadval</span><b>{KUNLAR[g.days_pattern]} · {String(g.start_time).slice(0, 5)}</b></div>
        <div className="kv"><span>Davr</span><b>{sana(g.start_date)} — {sana(g.end_date_planned)}</b></div>
        <div className="kv"><span>Narx</span><b>{som(g.monthly_fee)}/oy</b></div>
        <div className="kv"><span>O'quvchilar</span><b>{faolAzolar.length} / {g.capacity}</b></div>
      </div>

      <div className="tabs">
        <button className={tab === 'jurnal' ? 'tab on' : 'tab'} onClick={() => setTab('jurnal')}>Dars jurnali ({jurnal.length})</button>
        <button className={tab === 'oquvchilar' ? 'tab on' : 'tab'} onClick={() => setTab('oquvchilar')}>O'quvchilar ({faolAzolar.length})</button>
      </div>

      {tab === 'oquvchilar' && (
        <div className="card">
          <div className="row-between">
            <h2>Guruh o'quvchilari</h2>
            <button className="btn" onClick={nomzodlarniYukla}>+ O'quvchi qo'shish</button>
          </div>
          <table>
            <thead><tr><th>ID</th><th>Ism</th><th>Telefon</th><th>Chegirma</th><th>Davomat</th><th>O'rt. test</th><th>Ilova</th><th>Reyting</th><th>Holat</th></tr></thead>
            <tbody>
              {azolik.map((a) => (
                <tr key={a.id}>
                  <td className="mono">{a.student_id}</td>
                  <td><Link to={`/oquvchilar/${a.student_id}`}><b>{a.students?.first_name} {a.students?.last_name}</b></Link></td>
                  <td className="mono">{a.students?.phone}</td>
                  <td>{a.discount_pct ? a.discount_pct + '%' : '—'}</td>
                  <td>
                    {progress[a.student_id]?.davomat_pct != null ? progress[a.student_id].davomat_pct + '%' : '—'}
                    {davHolat[a.student_id]?.ogohlantirish && (
                      <span className="badge badge-amber" style={{ marginLeft: 6 }}
                        title={`${davHolat[a.student_id].ketma_ket} ta ketma-ket qoldirdi — yana ${davHolat[a.student_id].chetlashtirishgacha} ta qoldirsa avtomatik chetlashtiriladi (ilovada ogohlantirish chiqadi)`}>
                        ⚠ {davHolat[a.student_id].ketma_ket}
                      </span>
                    )}
                  </td>
                  <td>{progress[a.student_id]?.ortacha_test != null ? progress[a.student_id].ortacha_test + '%' : '—'}</td>
                  <td>
                    {a.status === 'faol' && ruxsat[a.student_id] ? (
                      ruxsat[a.student_id].ilova_ochiq ? (
                        <span className="badge badge-green" title={`Kelgan darslar: ${ruxsat[a.student_id].kelgan_darslar} · Joriy oy to'lovi: ${ruxsat[a.student_id].tolov_foizi}%`}>Ochiq</span>
                      ) : (
                        <span className="badge badge-red" title={`${ruxsat[a.student_id].kelgan_darslar} darsga kelgan, joriy oy to'lovi ${ruxsat[a.student_id].tolov_foizi}% (kamida 49% kerak)`}>Bloklangan</span>
                      )
                    ) : '—'}
                  </td>
                  <td>{progress[a.student_id]?.reyting_ball ?? 0}</td>
                  <td>
                    <select className="sel-inline" value={a.status} onChange={async (e) => {
                      await supabase.from('enrollments').update({ status: e.target.value, left_at: e.target.value === 'faol' ? null : bugun }).eq('id', a.id);
                      load();
                    }}>
                      {['faol', 'yakunladi', 'kochirildi', 'tashlab_ketdi', 'chetlashtirildi'].map((h) => <option key={h} value={h}>{holat(h)}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
              {azolik.length === 0 && <tr><td colSpan={9} className="muted">Guruhda hali o'quvchi yo'q.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'jurnal' && (
        <div className="card">
          <h2>Dars jurnali <span className="muted small">(qatorni bosib davomat kiriting)</span></h2>
          <table>
            <thead><tr><th>Sana</th><th>Dars</th><th>Mavzu</th><th>Turi</th><th>Holat</th></tr></thead>
            <tbody>
              {jurnal.map((s) => (
                <tr key={s.id} className={'clickable' + (s.session_date === bugun ? ' today' : '')} onClick={() => sessiyaOch(s)}>
                  <td>{sana(s.session_date)}{s.session_date === bugun ? ' · BUGUN' : ''}</td>
                  <td className="mono">{s.lesson_code}</td>
                  <td>{s.unit_sarlavha ? `${s.unit_sarlavha} — ` : ''}{s.dars_sarlavha ?? s.grammar_topic}</td>
                  <td>{holat(s.lesson_type)}</td>
                  <td><Badge s={s.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sozModal && sf && (
        <Modal title={`Guruh sozlamalari — ${g.id}`} onClose={() => setSozModal(false)}>
          <form onSubmit={sozSaqla} className="form-grid">
            <label>Asosiy o'qituvchi (Main)
              <select value={sf.teacher_id} onChange={(e) => setSf({ ...sf, teacher_id: e.target.value })}>
                {teachers.filter((t) => t.degree !== 'support' || t.id === sf.teacher_id).map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
            </label>
            <label>Yordamchi (Support)
              <select value={sf.support_id} onChange={(e) => setSf({ ...sf, support_id: e.target.value })}>
                <option value="">— Yo'q —</option>
                {teachers.filter((t) => t.degree === 'support').map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
            </label>
            <label>Xona
              <input value={sf.room_id} onChange={(e) => setSf({ ...sf, room_id: e.target.value })} placeholder="XONA-1" />
            </label>
            <label>Dars kunlari
              <select value={sf.days_pattern} onChange={(e) => setSf({ ...sf, days_pattern: e.target.value })}>
                <option value="DCJ">Dushanba · Chorshanba · Juma</option>
                <option value="SPS">Seshanba · Payshanba · Shanba</option>
              </select>
            </label>
            <label>Dars vaqti
              <TimeSelect value={sf.start_time} onChange={(v) => setSf({ ...sf, start_time: v })} />
            </label>
            <label>Boshlanish sanasi
              <input type="date" value={sf.start_date} onChange={(e) => setSf({ ...sf, start_date: e.target.value })} required />
            </label>
            <label>Oylik narx (so'm)
              <input type="number" value={sf.monthly_fee} onChange={(e) => setSf({ ...sf, monthly_fee: Number(e.target.value) })} step="1" min="0" required />
            </label>
            <label>Sig'im
              <input type="number" value={sf.capacity} onChange={(e) => setSf({ ...sf, capacity: Number(e.target.value) })} min="1" max="30" />
            </label>
            <label>Holat
              <select value={sf.status} onChange={(e) => setSf({ ...sf, status: e.target.value })}>
                {['rejada', 'faol', 'imtihon', 'yakunlangan', 'bekor'].map((h) => <option key={h} value={h}>{holat(h)}</option>)}
              </select>
            </label>
            <p className="muted small span2">
              Dars kunlari yoki boshlanish sanasi o'zgarsa, rejadagi darslar avtomatik yangi kunlarga
              ko'chiriladi; o'tib bo'lgan darslar tarixda qoladi. Oylik narx o'zgarishi faqat KEYIN
              yaratiladigan to'lovlarga ta'sir qiladi.
            </p>
            {sXato && <div className="err span2">{sXato}</div>}
            <button className="btn span2">Saqlash</button>
          </form>
        </Modal>
      )}

      {qoshishModal && (
        <Modal title="Guruhga o'quvchi qo'shish" onClose={() => setQoshishModal(false)}>
          <form onSubmit={oquvchiQosh} className="form-grid">
            <label className="span2">O'quvchi
              <select value={tanlangan} onChange={(e) => setTanlangan(e.target.value)} required>
                <option value="">— Tanlang —</option>
                {nomzodlar.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.id})</option>)}
              </select>
            </label>
            <label>Chegirma (%)
              <input type="number" value={chegirma} onChange={(e) => setChegirma(Number(e.target.value))} min="0" max="100" />
            </label>
            {xato && <div className="err span2">{xato}</div>}
            <button className="btn span2">Qo'shish</button>
          </form>
        </Modal>
      )}

      {ochiqSessiya && (
        <Modal wide title={`Davomat — ${sana(ochiqSessiya.session_date)} · ${ochiqSessiya.lesson_code}`} onClose={() => setOchiqSessiya(null)}>
          <p className="muted">{ochiqSessiya.unit_sarlavha} — {ochiqSessiya.dars_sarlavha ?? ochiqSessiya.grammar_topic}</p>
          {faolAzolar.length === 0 ? <p className="muted">Guruhda faol o'quvchi yo'q.</p> : (
            <>
              <table>
                <thead><tr><th>O'quvchi</th><th>Davomat</th></tr></thead>
                <tbody>
                  {faolAzolar.map((a) => (
                    <tr key={a.student_id}>
                      <td><b>{a.students?.first_name} {a.students?.last_name}</b> <span className="mono muted small">{a.student_id}</span></td>
                      <td>
                        <div className="seg">
                          {DAVOMAT.map((d) => (
                            <button
                              key={d}
                              type="button"
                              className={'seg-btn seg-' + d + (davomat[a.student_id] === d ? ' on' : '')}
                              onClick={() => setDavomat({ ...davomat, [a.student_id]: d })}
                            >{holat(d)}</button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="btn" style={{ marginTop: 12 }} onClick={davomatSaqla}>Saqlash (dars o'tildi deb belgilanadi)</button>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
