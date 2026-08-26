import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { som, sana, bugunISO, joriyDavr, holat } from '../lib/format';
import Badge from '../components/Badge';

export default function Dashboard() {
  const [stat, setStat] = useState<any>(null);
  const [bugungi, setBugungi] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [stu, grp, qarz, pay, ses] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact', head: true }).eq('status', 'faol'),
        supabase.from('groups').select('id', { count: 'exact', head: true }).eq('status', 'faol'),
        supabase.from('v_qarzdorlar').select('qarz'),
        supabase.from('payments').select('amount_paid').eq('period', joriyDavr()),
        supabase.from('v_guruh_jurnali').select('*').eq('session_date', bugunISO()).order('group_id'),
      ]);
      setStat({
        oquvchilar: stu.count ?? 0,
        guruhlar: grp.count ?? 0,
        qarzdorlar: qarz.data?.length ?? 0,
        qarz_summa: (qarz.data ?? []).reduce((s: number, r: any) => s + Number(r.qarz || 0), 0),
        oy_tushum: (pay.data ?? []).reduce((s: number, r: any) => s + Number(r.amount_paid || 0), 0),
      });
      setBugungi(ses.data ?? []);
    })();
  }, []);

  return (
    <div>
      <div className="page-head"><h1>Boshqaruv paneli</h1><span className="muted">{sana(bugunISO())}</span></div>
      <div className="stat-row">
        <Link to="/oquvchilar" className="stat-card">
          <div className="stat-n">{stat ? stat.oquvchilar : '…'}</div>
          <div className="stat-t">Faol o'quvchilar</div>
        </Link>
        <Link to="/guruhlar" className="stat-card">
          <div className="stat-n">{stat ? stat.guruhlar : '…'}</div>
          <div className="stat-t">Faol guruhlar</div>
        </Link>
        <Link to="/tolovlar" className="stat-card">
          <div className="stat-n">{stat ? som(stat.oy_tushum) : '…'}</div>
          <div className="stat-t">Shu oy tushumi</div>
        </Link>
        <Link to="/tolovlar" className="stat-card stat-warn">
          <div className="stat-n">{stat ? stat.qarzdorlar : '…'}</div>
          <div className="stat-t">Qarzdorlar {stat && stat.qarz_summa > 0 ? `(${som(stat.qarz_summa)})` : ''}</div>
        </Link>
      </div>

      <div className="card">
        <h2>Bugungi darslar</h2>
        {bugungi.length === 0 ? (
          <p className="muted">Bugun rejalashtirilgan dars yo'q.</p>
        ) : (
          <table>
            <thead><tr><th>Guruh</th><th>Dars</th><th>Mavzu</th><th>Turi</th><th>Holat</th></tr></thead>
            <tbody>
              {bugungi.map((s) => (
                <tr key={s.id}>
                  <td><Link to={`/guruhlar/${s.group_id}`}>{s.group_id}</Link></td>
                  <td>{s.lesson_code}</td>
                  <td>{s.unit_sarlavha ? `${s.unit_sarlavha} — ` : ''}{s.dars_sarlavha ?? s.grammar_topic}</td>
                  <td>{holat(s.lesson_type)}</td>
                  <td><Badge s={s.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
