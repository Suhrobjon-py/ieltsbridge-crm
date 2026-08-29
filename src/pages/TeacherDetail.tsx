import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { som, sana, holat, KUNLAR } from '../lib/format';
import Badge from '../components/Badge';

export default function TeacherDetail() {
  const { id } = useParams();
  const [t, setT] = useState<any>(null);
  const [guruhlar, setGuruhlar] = useState<any[]>([]);
  const [soni, setSoni] = useState<Record<string, number>>({});
  const [maoshlar, setMaoshlar] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [tc, gr, sal] = await Promise.all([
        supabase.from('teachers').select('*').eq('id', id).single(),
        supabase.from('groups').select('*, levels(name)').or(`teacher_id.eq.${id},support_teacher_id.eq.${id}`).order('start_date', { ascending: false }),
        supabase.from('teacher_salaries').select('*').eq('teacher_id', id).order('period', { ascending: false }),
      ]);
      setT(tc.data);
      const gs = gr.data ?? [];
      setGuruhlar(gs);
      setMaoshlar(sal.data ?? []);
      if (gs.length) {
        const { data: en } = await supabase.from('enrollments').select('group_id').eq('status', 'faol').in('group_id', gs.map((g: any) => g.id));
        const m: Record<string, number> = {};
        for (const e of en ?? []) m[e.group_id] = (m[e.group_id] ?? 0) + 1;
        setSoni(m);
      }
    })();
  }, [id]);

  if (!t) return <p className="muted">Yuklanmoqda…</p>;

  const faolGuruhlar = guruhlar.filter((g) => ['rejada', 'faol', 'imtihon'].includes(g.status));
  const jamiOquvchi = faolGuruhlar.reduce((s, g) => s + (soni[g.id] ?? 0), 0);

  return (
    <div>
      <div className="page-head">
        <h1>{t.full_name} <span className="mono muted">({t.id})</span></h1>
        <Badge s={t.status} />
      </div>

      <div className="grid2">
        <div className="card">
          <h2>Ma'lumotlar</h2>
          <div className="kv"><span>Telefon</span><b className="mono">{t.phone}</b></div>
          <div className="kv"><span>Fanlari</span><b>{t.levels || '—'}</b></div>
          <div className="kv"><span>Daraja</span><b>{holat(t.degree)}</b></div>
          <div className="kv"><span>Ishga olingan</span><b>{sana(t.hire_date)}</b></div>
          <div className="kv"><span>Faol guruhlari</span><b>{faolGuruhlar.length} ta</b></div>
          <div className="kv"><span>Jami faol o'quvchilari</span><b>{jamiOquvchi} ta</b></div>
        </div>

        <div className="card">
          <h2>Maosh tarixi</h2>
          {maoshlar.length === 0 ? <p className="muted">Hali maosh yozuvi yo'q. Hisoblash: Hisobotlar bo'limida.</p> : (
            <table>
              <thead><tr><th>Davr</th><th>O'quvchi</th><th>Stavka</th><th>Summa</th><th>Sana</th></tr></thead>
              <tbody>
                {maoshlar.map((m) => (
                  <tr key={m.id}>
                    <td className="mono">{m.period}</td>
                    <td>{m.student_count ?? '—'}</td>
                    <td>{m.rate ? som(m.rate) : '—'}</td>
                    <td><b>{som(m.amount)}</b></td>
                    <td>{sana(m.paid_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Guruhlari</h2>
        <table>
          <thead><tr><th>Guruh</th><th>Bosqich</th><th>Roli</th><th>Jadval</th><th>Holat</th><th>Faol o'quvchilar</th></tr></thead>
          <tbody>
            {guruhlar.map((g) => (
              <tr key={g.id}>
                <td><Link to={`/guruhlar/${g.id}`} className="mono"><b>{g.id}</b></Link></td>
                <td>{g.levels?.name ?? g.level_code}</td>
                <td>{g.teacher_id === id ? <span className="badge badge-green">Asosiy</span> : <span className="badge badge-blue">Yordamchi</span>}</td>
                <td>{KUNLAR[g.days_pattern]} · {String(g.start_time).slice(0, 5)}</td>
                <td><Badge s={g.status} /></td>
                <td><b>{soni[g.id] ?? 0}</b> / {g.capacity}</td>
              </tr>
            ))}
            {guruhlar.length === 0 && <tr><td colSpan={6} className="muted">Bu o'qituvchiga guruh biriktirilmagan.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
