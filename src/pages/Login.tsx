import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [parol, setParol] = useState('');
  const [xato, setXato] = useState('');
  const [loading, setLoading] = useState(false);

  async function kirish(e: React.FormEvent) {
    e.preventDefault();
    setXato('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: parol });
    setLoading(false);
    if (error) setXato("Kirish muvaffaqiyatsiz: email yoki parol noto'g'ri");
  }

  return (
    <div className="center-wrap">
      <form className="card login-card" onSubmit={kirish}>
        <div className="logo-big">IELTS<span>Bridge</span> CRM</div>
        <p className="muted">Xodimlar uchun boshqaruv tizimi</p>
        <label>Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
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
