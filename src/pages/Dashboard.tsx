import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { som, sana, bugunISO, joriyDavr, holat, qisqaSom } from '../lib/format';
import Badge from '../components/Badge';

const BOSQICH_TARTIB = ['yangi', 'birinchi_aloqa', 'boglanib_bolmadi', 'aloqa_ornatildi', 'qiziqish_bildirdi', 'sinovga_yozildi', 'sinovga_keldi', 'taklif_berildi', 'qaror_kutilmoqda', 'sotuv_yopildi'];

function darajaIdx(status: string): number {
  const i = BOSQICH_TARTIB.indexOf(status);
  return i === -1 ? -1 : i;
}

export default function Dashboard() {
  const [leads, setLeads] = useState<any[]>([]);
  const [trials, setTrials] = useState<any[]>([]);
  const [risk, setRisk] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [bugungi, setBugungi] = useState<any[]>([]);
  const [faolStat, setFaolStat] = useState<{ oquvchi: number; guruh: number }>({ oquvchi: 0, guruh: 0 });

  useEffect(() => {
    (async () => {
      const [l, t, r, g, p, s, ses, stu, grp] = await Promise.all([
        supabase.from('leads').select('*'),
        supabase.from('trials').select('*'),
        supabase.from('v_student_risk').select('*'),
        supabase.from('groups').select('id, monthly_fee, status'),
        supabase.from('payments').select('amount_due, amount_paid, period, status'),
        supabase.from('students').select('id, status, churned_at, churn_reason'),
        supabase.from('v_guruh_jurnali').select('*').eq('session_date', bugunISO()).order('group_id'),
        supabase.from('students').select('id', { count: 'exact', head: true }).eq('status', 'faol'),
        supabase.from('groups').select('id', { count: 'exact', head: true }).eq('status', 'faol'),
      ]);
      setLeads(l.data ?? []); setTrials(t.data ?? []); setRisk(r.data ?? []);
      setGroups(g.data ?? []); setPayments(p.data ?? []); setStudents(s.data ?? []);
      setBugungi(ses.data ?? []);
      setFaolStat({ oquvchi: stu.count ?? 0, guruh: grp.count ?? 0 });
    })();
  }, []);

  const feeMap = useMemo(() => Object.fromEntries(groups.map((g) => [g.id, Number(g.monthly_fee)])), [groups]);

  const kpi = useMemo(() => {
    const kun30 = new Date(Date.now() - 30 * 86400000).toISOString();
    const kun60 = new Date(Date.now() - 60 * 86400000).toISOString();
    const l30 = leads.filter((l) => l.created_at >= kun30);
    const lOldingi = leads.filter((l) => l.created_at >= kun60 && l.created_at < kun30);
    const delta = lOldingi.length ? Math.round((100 * (l30.length - lOldingi.length)) / lOldingi.length) : null;

    const aloqa = leads.filter((l) => darajaIdx(l.status) >= 1 && l.status !== 'boglanib_bolmadi').length + leads.filter((l) => l.status === 'boglanib_bolmadi').length;
    const trialYozildi = leads.filter((l) => darajaIdx(l.status) >= 5).length;
    const trialKeldi = leads.filter((l) => darajaIdx(l.status) >= 6).length;
    const sotuv = leads.filter((l) => l.status === 'sotuv_yopildi').length;

    const xavfli = risk.filter((r) => r.score < 40);
    const qarz = payments.reduce((s, p) => (['muddati_otgan', 'qisman', 'kutilmoqda'].includes(p.status) ? s + Number(p.amount_due) - Number(p.amount_paid) : s), 0);
    const xavfDaromad = xavfli.reduce((s, r) => s + (feeMap[r.group_id] ?? 0), 0) + qarz;
    const churn30 = students.filter((s) => s.status === 'ketgan' && s.churned_at && new Date(s.churned_at).toISOString() >= kun30).length;
    const tushum = payments.reduce((s, p) => (p.period === joriyDavr() ? s + Number(p.amount_paid) : s), 0);

    return { l30: l30.length, delta, aloqa, trialYozildi, trialKeldi, sotuv, xavfli: xavfli.length, churn30, xavfDaromad, tushum };
  }, [leads, risk, payments, students, feeMap]);

  // Sales Funnel (barcha lidlar bo'yicha, bosqichga YETGANLAR)
  const funnel = useMemo(() => {
    const jami = leads.length;
    const yetgan = (idx: number) => leads.filter((l) => darajaIdx(l.status) >= idx).length;
    const steps = [
      { nom: 'Yangi lidlar', n: jami },
      { nom: 'Aloqa qilindi', n: yetgan(1) },
      { nom: 'Qiziqish bildirdi', n: yetgan(4) },
      { nom: 'Sinovga yozildi', n: yetgan(5) },
      { nom: 'Sinovga keldi', n: yetgan(6) },
      { nom: 'Taklif oldi', n: yetgan(7) },
      { nom: 'Sotib oldi', n: yetgan(9) },
    ];
    let engKatta = { idx: -1, foiz: 0 };
    for (let i = 1; i < steps.length; i++) {
      if (steps[i - 1].n >= 3) {
        const yoqotish = Math.round(100 * (1 - steps[i].n / steps[i - 1].n));
        if (yoqotish > engKatta.foiz) engKatta = { idx: i, foiz: yoqotish };
      }
    }
    return { steps, engKatta };
  }, [leads]);

  // Manba samaradorligi: Source -> Lead -> Trial -> Keldi -> Sale
  const manbalar = useMemo(() => {
    const m: Record<string, { lead: number; aloqa: number; trial: number; keldi: number; sale: number }> = {};
    for (const l of leads) {
      const k = l.source ?? 'boshqa';
      m[k] ??= { lead: 0, aloqa: 0, trial: 0, keldi: 0, sale: 0 };
      m[k].lead++;
      if (darajaIdx(l.status) >= 1) m[k].aloqa++;
      if (darajaIdx(l.status) >= 5) m[k].trial++;
      if (darajaIdx(l.status) >= 6) m[k].keldi++;
      if (l.status === 'sotuv_yopildi') m[k].sale++;
    }
    return Object.entries(m).sort((a, b) => b[1].lead - a[1].lead);
  }, [leads]);

  const maxFunnel = funnel.steps[0]?.n || 1;

  return (
    <div>
      <div className="page-head"><h1>Boshqaruv paneli</h1><span className="muted">{sana(bugunISO())} · faol: {faolStat.oquvchi} o'quvchi / {faolStat.guruh} guruh</span></div>

      <div className="kpi-row">
        <Link to="/lidlar" className="stat-card">
          <div className="stat-n">{kpi.l30}{kpi.delta !== null && <span className={'kpi-delta ' + (kpi.delta >= 0 ? 'up' : 'down')}>{kpi.delta >= 0 ? '+' : ''}{kpi.delta}%</span>}</div>
          <div className="stat-t">Yangi lidlar (30 kun)</div>
        </Link>
        <div className="stat-card">
          <div className="stat-n">{leads.length ? Math.round((100 * kpi.trialYozildi) / leads.length) : 0}%</div>
          <div className="stat-t">Sinovga yozilish</div>
        </div>
        <div className="stat-card">
          <div className="stat-n">{kpi.trialYozildi ? Math.round((100 * kpi.trialKeldi) / kpi.trialYozildi) : 0}%</div>
          <div className="stat-t">Sinovga kelish</div>
        </div>
        <div className="stat-card">
          <div className="stat-n">{kpi.trialKeldi ? Math.round((100 * kpi.sotuv) / kpi.trialKeldi) : 0}%</div>
          <div className="stat-t">Trial → Sotuv</div>
        </div>
        <Link to="/muammolar" className="stat-card stat-warn">
          <div className="stat-n">{kpi.xavfli}</div>
          <div className="stat-t">Xavfdagi o'quvchilar</div>
        </Link>
        <div className="stat-card">
          <div className="stat-n">{kpi.churn30}</div>
          <div className="stat-t">Ketganlar (30 kun)</div>
        </div>
        <Link to="/muammolar" className="stat-card stat-warn">
          <div className="stat-n">{qisqaSom(kpi.xavfDaromad)}</div>
          <div className="stat-t">Xavf ostidagi daromad</div>
        </Link>
        <Link to="/hisobotlar" className="stat-card">
          <div className="stat-n">{qisqaSom(kpi.tushum)}</div>
          <div className="stat-t">Shu oy tushumi</div>
        </Link>
      </div>

      <div className="grid2">
        <div className="card">
          <h2>Sales Funnel</h2>
          {leads.length === 0 ? <p className="muted">Lidlar qo'shilgach funnel paydo bo'ladi.</p> : (
            <div>
              {funnel.steps.map((s, i) => (
                <div key={s.nom}>
                  {i > 0 && funnel.steps[i - 1].n > 0 && (
                    <div className={'fun-conv' + (funnel.engKatta.idx === i ? ' fun-worst' : '')}>
                      ↓ {Math.round((100 * s.n) / funnel.steps[i - 1].n)}%
                      {funnel.engKatta.idx === i && <span> · ENG KATTA YO'QOTISH (−{funnel.engKatta.foiz}%)</span>}
                    </div>
                  )}
                  <div className="hbar-row">
                    <span className="hbar-label">{s.nom}</span>
                    <div className="hbar"><div className="hbar-fill" style={{ width: `${(s.n / maxFunnel) * 100}%` }} /></div>
                    <b>{s.n}</b>
                  </div>
                </div>
              ))}
              {funnel.engKatta.idx > 0 && (
                <div className="insight" style={{ marginTop: 10 }}>
                  💡 <b>Insight:</b> Eng katta yo'qotish "{funnel.steps[funnel.engKatta.idx - 1].nom} → {funnel.steps[funnel.engKatta.idx].nom}" bosqichida (−{funnel.engKatta.foiz}%).
                  {' '}<Link to="/muammolar">Muammolar markazida tavsiyalar →</Link>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <h2>Manba samaradorligi</h2>
          {manbalar.length === 0 ? <p className="muted">Ma'lumot yo'q.</p> : (
            <table>
              <thead><tr><th>Manba</th><th>Lid</th><th>Aloqa</th><th>Trial</th><th>Keldi</th><th>Sotuv</th><th>Konv.</th></tr></thead>
              <tbody>
                {manbalar.map(([src, v]) => (
                  <tr key={src}>
                    <td><b>{holat(src)}</b></td>
                    <td>{v.lead}</td><td>{v.aloqa}</td><td>{v.trial}</td><td>{v.keldi}</td><td>{v.sale}</td>
                    <td><b className={v.lead >= 3 && v.sale / v.lead >= 0.15 ? '' : v.lead >= 3 ? 'red' : ''}>{v.lead ? Math.round((100 * v.sale) / v.lead) : 0}%</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Bugungi darslar</h2>
        {bugungi.length === 0 ? <p className="muted">Bugun rejalashtirilgan dars yo'q.</p> : (
          <table>
            <thead><tr><th>Guruh</th><th>Dars</th><th>Mavzu</th><th>Holat</th></tr></thead>
            <tbody>
              {bugungi.map((s) => (
                <tr key={s.id}>
                  <td><Link to={`/guruhlar/${s.group_id}`}>{s.group_id}</Link></td>
                  <td className="mono">{s.lesson_code}</td>
                  <td>{s.unit_sarlavha ? `${s.unit_sarlavha} — ` : ''}{s.dars_sarlavha ?? s.grammar_topic}</td>
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
