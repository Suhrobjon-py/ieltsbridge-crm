import { useState } from 'react';
import { supabase, loginToEmail, LOKAL } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [parol, setParol] = useState('');
  const [xato, setXato] = useState('');
  const [loading, setLoading] = useState(false);

  async function kirish(e: React.FormEvent) {
    e.preventDefault();
    setXato('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: loginToEmail(email), password: parol });
    setLoading(false);
    if (error) setXato("Kirish muvaffaqiyatsiz: login yoki parol noto'g'ri");
  }

  return (
    <div className="center-wrap">
      <form className="card login-card" onSubmit={kirish}>
        <div className="logo-big">IELTS<span>Bridge</span> CRM</div>
        <p className="muted">Xodimlar uchun boshqaruv tizimi{LOKAL ? ' · LOKAL rejim (internetsiz)' : ''}</p>
        {LOKAL && <p className="muted small">Birinchi kirish: <b className="mono">admin</b> / <b className="mono">admin123</b> — keyin parolni almashtiring</p>}
        <label>Login yoki email
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="masalan: aziza" required autoFocus />
        </label>
        <label>Parol
          <input type="password" value={parol} onChange={(e) => setParol(e.target.value)} required />
        </label>
        {xato && <div className="err">{xato}</div>}
        <button className="btn" disabled={loading}>{loading ? 'Kirilmoqda…' : 'Kirish'}</button>
      </form>
    </div>
  );
}
