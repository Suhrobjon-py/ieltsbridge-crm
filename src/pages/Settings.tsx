import { useEffect, useState } from 'react';
import { supabase, signupClient, loginToEmail, LOGIN_DOMEN } from '../lib/supabase';
import { holat, BOLIMLAR, ROLLAR } from '../lib/format';
import Modal from '../components/Modal';
import Confirm from '../components/Confirm';
import { useRole } from '../lib/role';

const DARAJALAR: [string, string][] = [['', "Yo'q"], ['korish', "Ko'rish"], ['tahrirlash', 'Tahrirlash'], ['ochirish', "O'chirish"]];

// Rol bo'yicha tayyor huquq to'plamlari
const PRESETLAR: Record<string, Record<string, string>> = {
  admin: {
    boshqaruv: 'tahrirlash', lidlar: 'tahrirlash', sinovlar: 'tahrirlash', muammolar: 'korish',
    oquvchilar: 'tahrirlash', guruhlar: 'tahrirlash', xonalar: 'tahrirlash', oqituvchilar: 'tahrirlash',
    tolovlar: 'tahrirlash', xarajatlar: 'tahrirlash', hisobotlar: 'tahrirlash', sozlamalar: 'korish',
  },
  reseption: {
    boshqaruv: 'korish', lidlar: 'tahrirlash', sinovlar: 'tahrirlash', muammolar: 'korish',
    oquvchilar: 'tahrirlash', guruhlar: 'korish', xonalar: 'korish', tolovlar: 'tahrirlash',
  },
  call_markaz: { boshqaruv: 'korish', lidlar: 'tahrirlash', sinovlar: 'tahrirlash' },
  oqituvchi: {}, // o'z guruhlari avtomatik ochiladi (baza siyosati orqali)
};

function parolYasa(): string {
  const harflar = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
  const raqamlar = '23456789';
  let p = '';
  for (let i = 0; i < 6; i++) p += harflar[Math.floor(Math.random() * harflar.length)];
  for (let i = 0; i < 3; i++) p += raqamlar[Math.floor(Math.random() * raqamlar.length)];
  return p;
}

export default function Settings() {
  const { role, superadmin, canManage, canDelete } = useRole();
  const [fanlar, setFanlar] = useState<any[]>([]);
  const [xodimlar, setXodimlar] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);

  // fan modali
  const [fanModal, setFanModal] = useState<null | { id?: number }>(null);
  const [nomi, setNomi] = useState('');
  const [fanXato, setFanXato] = useState('');
  const [ochirFan, setOchirFan] = useState<any>(null);

  // xodim modali
  const [xModal, setXModal] = useState<null | { email?: string }>(null);
  const [xf, setXf] = useState<any>(null);
  const [xXato, setXXato] = useState('');
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);
  const [yangiKirish, setYangiKirish] = useState<null | { login: string; parol: string }>(null);
  const [ochirXodim, setOchirXodim] = useState<any>(null);

  const boshqaraOladi = superadmin || canManage;

  async function load() {
    const [f, x, t] = await Promise.all([
      supabase.from('subjects').select('*').order('id'),
      supabase.from('staff_roles').select('*').order('id'),
      supabase.from('teachers').select('id, full_name').eq('status', 'faol').order('id'),
    ]);
    setFanlar(f.data ?? []);
    setXodimlar(x.data ?? []);
    setTeachers(t.data ?? []);
  }
  useEffect(() => { load(); }, []);

  // ---------- fanlar ----------
  async function fanSaqla(e: React.FormEvent) {
    e.preventDefault();
    setFanXato('');
    if (!nomi.trim()) return;
    const q = fanModal?.id
      ? supabase.from('subjects').update({ name: nomi.trim() }).eq('id', fanModal.id)
      : supabase.from('subjects').insert({ name: nomi.trim() });
    const { error } = await q;
    if (error) return setFanXato(error.code === '23505' ? 'Bu fan allaqachon mavjud' : error.message);
    setFanModal(null);
    load();
  }

  // ---------- xodimlar ----------
  function xodimYangi() {
    setXXato('');
    setYangiKirish(null);
    setXf({
      full_name: '', login: '', role: 'reseption', teacher_id: '',
      can_manage_users: false, perms: { ...PRESETLAR.reseption },
    });
    setXModal({});
  }

  function xodimTahrir(x: any) {
    setXXato('');
    setYangiKirish(null);
    setXf({
      full_name: x.full_name ?? '', login: x.email, role: x.role, teacher_id: x.teacher_id ?? '',
      can_manage_users: x.can_manage_users, perms: { ...(x.perms ?? {}) },
    });
    setXModal({ email: x.email });
  }

  function rolTanla(r: string) {
    setXf((old: any) => ({ ...old, role: r, perms: { ...(PRESETLAR[r] ?? {}) }, teacher_id: r === 'oqituvchi' ? old.teacher_id : '' }));
  }

  function permOzgar(bolim: string, daraja: string) {
    setXf((old: any) => {
      const perms = { ...old.perms };
      if (daraja) perms[bolim] = daraja; else delete perms[bolim];
      return { ...old, perms };
    });
  }

  async function xodimSaqla(e: React.FormEvent) {
    e.preventDefault();
    setXXato('');
    if (xf.role === 'oqituvchi' && !xf.teacher_id) return setXXato("O'qituvchi rolida o'qituvchini tanlang");
    setSaqlanmoqda(true);
    try {
      const body = {
        full_name: xf.full_name || null,
        role: xf.role,
        teacher_id: xf.role === 'oqituvchi' ? xf.teacher_id : null,
        can_manage_users: superadmin ? xf.can_manage_users : false,
        perms: xf.perms,
      };
      if (xModal?.email) {
        const { error } = await supabase.from('staff_roles').update(body).eq('email', xModal.email);
        if (error) throw error;
        setXModal(null);
      } else {
        if (!xf.login.trim()) throw new Error('Login kiriting');
        const email = loginToEmail(xf.login);
        const parol = parolYasa();
        const { error: e1 } = await signupClient().auth.signUp({ email, password: parol });
        if (e1) throw new Error(e1.message.includes('already registered') ? 'Bu login band' : e1.message);
        const { error: e2 } = await supabase.from('staff_roles').insert({ email, ...body });
        if (e2) throw e2;
        setYangiKirish({ login: xf.login.includes('@') ? email : xf.login.trim().toLowerCase(), parol });
      }
      load();
    } catch (err: any) {
      setXXato(err.message ?? String(err));
    } finally {
      setSaqlanmoqda(false);
    }
  }

  async function xodimOchir() {
    const x = ochirXodim;
    setOchirXodim(null);
    const { error } = await supabase.from('staff_roles').delete().eq('email', x.email);
    if (error) return alert(error.code === '42501' ? "O'chirish faqat Bosh admin uchun." : 'Xato: ' + error.message);
    alert("Huquqlar o'chirildi. Kirish akkauntini butunlay o'chirish uchun: Supabase → Authentication → Users.");
    load();
  }

  return (
    <div>
      <div className="page-head"><h1>Sozlamalar</h1></div>

      {boshqaraOladi && (
        <div className="card">
          <div className="row-between">
            <h2>Foydalanuvchilar va huquqlar</h2>
            <button className="btn" onClick={xodimYangi}>+ Yangi foydalanuvchi</button>
          </div>
          <p className="muted small">
            Har foydalanuvchiga bo'limma-bo'lim huquq belgilanadi: Yo'q (bo'lim ko'rinmaydi) → Ko'rish → Tahrirlash → O'chirish.
            Huquqlar baza darajasida tekshiriladi. Login va parol avtomatik yaratiladi — bir marta ko'rsatiladi.
          </p>
          <table>
            <thead><tr><th>Ism</th><th>Login</th><th>Rol</th><th>Bo'limlar</th><th>Rol boshqaruvi</th><th></th></tr></thead>
            <tbody>
              {xodimlar.map((x) => (
                <tr key={x.email}>
                  <td><b>{x.full_name ?? '—'}</b>{x.teacher_id ? <span className="muted small"> · {x.teacher_id}</span> : null}</td>
                  <td className="mono small">{x.email.endsWith('@' + LOGIN_DOMEN) ? x.email.split('@')[0] : x.email}</td>
                  <td><span className={'badge badge-' + (x.role === 'superadmin' ? 'green' : 'blue')}>{holat(x.role)}</span></td>
                  <td className="small">
                    {x.role === 'superadmin' ? 'Hammasi' :
                     x.role === 'oqituvchi' && !Object.keys(x.perms ?? {}).length ? "O'z guruhlari" :
                     Object.entries(x.perms ?? {}).map(([b, d]) => `${BOLIMLAR.find(([k]) => k === b)?.[1] ?? b}: ${holat(d as string)}`).join(' · ') || '—'}
                  </td>
                  <td>{x.can_manage_users ? '✅' : '—'}</td>
                  <td>
                    {x.role !== 'superadmin' && (
                      <div className="row-gap">
                        <button className="btn-ghost small" onClick={() => xodimTahrir(x)}>Tahrirlash</button>
                        {superadmin && <button className="btn-ghost small red" onClick={() => setOchirXodim(x)}>O'chirish</button>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid2">
        <div className="card">
          <div className="row-between">
            <h2>Fanlar</h2>
            <button className="btn btn-plus" title="Yangi fan" onClick={() => { setNomi(''); setFanXato(''); setFanModal({}); }}>+</button>
          </div>
          <table>
            <thead><tr><th>Fan</th><th>Holati</th><th></th></tr></thead>
            <tbody>
              {fanlar.map((f) => (
                <tr key={f.id}>
                  <td><b>{f.name}</b></td>
                  <td>
                    <button className={'badge badge-' + (f.faol ? 'green' : 'gray')} style={{ border: 'none', cursor: 'pointer' }}
                      onClick={async () => { await supabase.from('subjects').update({ faol: !f.faol }).eq('id', f.id); load(); }}>
                      {f.faol ? 'Faol' : "O'chirilgan"}
                    </button>
                  </td>
                  <td>
                    <div className="row-gap">
                      <button className="btn-ghost small" onClick={() => { setNomi(f.name); setFanXato(''); setFanModal({ id: f.id }); }}>Tahrirlash</button>
                      {canDelete('sozlamalar') && <button className="btn-ghost small red" onClick={() => setOchirFan(f)}>O'chirish</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2>Tizim haqida</h2>
          <div className="kv"><span>Sizning rolingiz</span><b>{holat(role)}</b></div>
          <div className="kv"><span>Bosh admin</span><b>Hamma narsa + o'chirish + rol berish</b></div>
          <div className="kv"><span>Rol boshqaruvi huquqi</span><b>Foydalanuvchi yaratish (superadmindan tashqari)</b></div>
          <div className="kv"><span>O'qituvchi</span><b>Faqat o'z guruhlari: davomat + baho</b></div>
          <p className="muted small" style={{ marginTop: 10 }}>
            Yangi xodimning logini: <span className="mono">login@{LOGIN_DOMEN}</span> ko'rinishida saqlanadi —
            kirishda faqat loginni yozish kifoya. Parolni tiklash: Supabase → Authentication → Users.
          </p>
        </div>
      </div>

      {/* ---------- XODIM MODALI ---------- */}
      {xModal && xf && (
        <Modal wide title={xModal.email ? `Huquqlarni tahrirlash — ${xf.full_name || xModal.email}` : 'Yangi foydalanuvchi'} onClose={() => setXModal(null)}>
          {yangiKirish ? (
            <div>
              <div className="insight" style={{ fontSize: 15 }}>
                ✅ Foydalanuvchi yaratildi! Ushbu ma'lumotlarni <b>hozir yozib oling</b> — parol qayta ko'rsatilmaydi:
                <div style={{ marginTop: 10, fontSize: 18 }} className="mono">
                  Login: <b>{yangiKirish.login}</b><br />Parol: <b>{yangiKirish.parol}</b>
                </div>
              </div>
              <button className="btn" onClick={() => setXModal(null)}>Yopish</button>
            </div>
          ) : (
            <form onSubmit={xodimSaqla} className="form-grid">
              <label>Ism-familiya
                <input value={xf.full_name} onChange={(e) => setXf({ ...xf, full_name: e.target.value })} required autoFocus={!xModal.email} />
              </label>
              {!xModal.email ? (
                <label>Login (yoki to'liq email)
                  <input value={xf.login} onChange={(e) => setXf({ ...xf, login: e.target.value })} placeholder="masalan: aziza" required />
                </label>
              ) : (
                <label>Login<input value={xf.login} disabled /></label>
              )}
              <label>Rol
                <select value={xf.role} onChange={(e) => rolTanla(e.target.value)}>
                  {ROLLAR.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              {xf.role === 'oqituvchi' ? (
                <label>Qaysi o'qituvchi
                  <select value={xf.teacher_id} onChange={(e) => setXf({ ...xf, teacher_id: e.target.value })} required>
                    <option value="">— Tanlang —</option>
                    {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                  </select>
                </label>
              ) : superadmin ? (
                <label className="check-line" style={{ alignSelf: 'end', paddingBottom: 8 }}>
                  <input type="checkbox" checked={xf.can_manage_users} onChange={(e) => setXf({ ...xf, can_manage_users: e.target.checked })} />
                  Rol boshqaruvi huquqi (filial admini)
                </label>
              ) : <span />}

              {xf.role === 'oqituvchi' ? (
                <p className="muted small span2">
                  O'qituvchi avtomatik faqat <b>o'ziga biriktirilgan guruhlarni</b> ko'radi, davomat va baho kirita oladi.
                  Qo'shimcha bo'lim kerak bo'lsa, quyida belgilang.
                </p>
              ) : null}

              <div className="span2">
                <b className="small">Bo'lim huquqlari:</b>
                <table style={{ marginTop: 6 }}>
                  <thead><tr><th>Bo'lim</th>{DARAJALAR.map(([v, l]) => <th key={v}>{l}</th>)}</tr></thead>
                  <tbody>
                    {BOLIMLAR.map(([b, nom]) => (
                      <tr key={b}>
                        <td><b>{nom}</b></td>
                        {DARAJALAR.map(([v]) => (
                          <td key={v}>
                            <input type="radio" name={'perm-' + b} checked={(xf.perms[b] ?? '') === v} onChange={() => permOzgar(b, v)} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {xXato && <div className="err span2">{xXato}</div>}
              <button className="btn span2" disabled={saqlanmoqda}>
                {saqlanmoqda ? 'Saqlanmoqda…' : xModal.email ? 'Saqlash' : 'Yaratish (parol avtomatik)'}
              </button>
            </form>
          )}
        </Modal>
      )}

      {fanModal && (
        <Modal title={fanModal.id ? 'Fanni tahrirlash' : 'Yangi fan'} onClose={() => setFanModal(null)}>
          <form onSubmit={fanSaqla} className="form-grid">
            <label className="span2">Fan nomi
              <input value={nomi} onChange={(e) => setNomi(e.target.value)} placeholder="Masalan: Matematika, Rus tili..." required autoFocus />
            </label>
            {fanXato && <div className="err span2">{fanXato}</div>}
            <button className="btn span2">Saqlash</button>
          </form>
        </Modal>
      )}

      {ochirFan && (
        <Confirm text={`"${ochirFan.name}" fani o'chirilsinmi?`} onYoq={() => setOchirFan(null)}
          onHa={async () => {
            const f = ochirFan; setOchirFan(null);
            const { error } = await supabase.from('subjects').delete().eq('id', f.id);
            if (error) return alert(error.code === '42501' ? "O'chirish huquqi yo'q." : 'Xato: ' + error.message);
            load();
          }} />
      )}

      {ochirXodim && (
        <Confirm text={`${ochirXodim.full_name ?? ochirXodim.email} foydalanuvchisining huquqlari o'chirilsinmi?`}
          onHa={xodimOchir} onYoq={() => setOchirXodim(null)} />
      )}
    </div>
  );
}
