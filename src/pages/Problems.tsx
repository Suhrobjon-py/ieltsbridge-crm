import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { som, holat, bugunISO, riskHolat } from '../lib/format';

type Muammo = {
  daraja: 'critical' | 'warning' | 'attention';
  kategoriya: string;
  nomi: string;
  sabab: string;
  tasir: string;
  tavsiya: string;
  havola?: string;
};

export default function Problems() {
  const [leads, setLeads] = useState<any[]>([]);
  const [trials, setTrials] = useState<any[]>([]);
  const [risk, setRisk] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [yuklandi, setYuklandi] = useState(false);

  useEffect(() => {
    (async () => {
      const [l, t, r, s, p, g] = await Promise.all([
        supabase.from('leads').select('*'),
        supabase.from('trials').select('*'),
        supabase.from('v_student_risk').select('*'),
        supabase.from('students').select('id, first_name, last_name, status, churn_reason, churned_at, winback'),
        supabase.from('payments').select('student_id, group_id, period, amount_due, amount_paid, status'),
        supabase.from('groups').select('id, monthly_fee, status'),
      ]);
      setLeads(l.data ?? []); setTrials(t.data ?? []); setRisk(r.data ?? []);
      setStudents(s.data ?? []); setPayments(p.data ?? []); setGroups(g.data ?? []);
      setYuklandi(true);
    })();
  }, []);

  const bugun = bugunISO();
  const stuNom = (id: string) => {
    const s = students.find((x) => x.id === id);
    return s ? `${s.first_name} ${s.last_name}` : id;
  };
  const feeMap = useMemo(() => Object.fromEntries(groups.map((g) => [g.id, Number(g.monthly_fee)])), [groups]);

  const { alerts, muammolar, xavfli } = useMemo(() => {
    const alerts: { daraja: string; matn: string; havola: string }[] = [];
    const muammolar: Muammo[] = [];

    // ---- LID signallari ----
    const ochiqLid = leads.filter((l) => !['sotuv_yopildi', 'rad_etdi'].includes(l.status));
    const yangiKech = ochiqLid.filter((l) => l.status === 'yangi' && Date.now() - new Date(l.created_at).getTime() > 24 * 3600000);
    const aloqasiz24 = ochiqLid.filter((l) => Date.now() - new Date(l.last_contact_at ?? l.created_at).getTime() > 24 * 3600000);
    const fupKech = ochiqLid.filter((l) => l.next_followup_at && l.next_followup_at < bugun);

    if (yangiKech.length) alerts.push({ daraja: 'critical', matn: `${yangiKech.length} ta YANGI lidga 24 soatdan beri birinchi aloqa qilinmagan`, havola: '/lidlar' });
    if (aloqasiz24.length) alerts.push({ daraja: 'warning', matn: `${aloqasiz24.length} ta ochiq lidga 24 soatdan beri javob berilmagan`, havola: '/lidlar' });
    if (fupKech.length) alerts.push({ daraja: 'warning', matn: `${fupKech.length} ta follow-up muddati o'tib ketgan`, havola: '/lidlar' });

    const bugungiTrial = trials.filter((t) => t.trial_date === bugun && !['kelmadi', 'sotuvga_otkazildi', 'qayta_yozildi'].includes(t.status));
    if (bugungiTrial.length) alerts.push({ daraja: 'attention', matn: `${bugungiTrial.length} ta sinov darsi BUGUN bo'lib o'tadi — eslatma yuborilganini tekshiring`, havola: '/sinovlar' });

    if (yangiKech.length) muammolar.push({
      daraja: 'critical', kategoriya: 'Sotuv', nomi: 'Yangi lidga kech javob',
      sabab: `${yangiKech.length} ta lid 24+ soat "Yangi" holatda turibdi`,
      tasir: `${yangiKech.length} ta lid sovub bormoqda`,
      tavsiya: "Yangi lidga 15 daqiqa ichida birinchi qo'ng'iroq qilish qoidasini joriy qiling", havola: '/lidlar',
    });

    // ---- TRIAL signallari ----
    const oy30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const yakunTrial = trials.filter((t) => t.trial_date >= oy30 && ['keldi', 'kelmadi', 'muvaffaqiyatli', 'sotuvga_otkazildi'].includes(t.status));
    const keldiN = yakunTrial.filter((t) => t.status !== 'kelmadi').length;
    const kelmadiN = yakunTrial.filter((t) => t.status === 'kelmadi').length;
    if (keldiN + kelmadiN >= 3) {
      const noshowRate = Math.round((100 * kelmadiN) / (keldiN + kelmadiN));
      if (noshowRate >= 25) {
        const sabablar: Record<string, number> = {};
        for (const t of trials.filter((x) => x.status === 'kelmadi' && x.noshow_reason)) sabablar[t.noshow_reason] = (sabablar[t.noshow_reason] ?? 0) + 1;
        const top = Object.entries(sabablar).sort((a, b) => b[1] - a[1])[0];
        muammolar.push({
          daraja: noshowRate >= 40 ? 'critical' : 'warning', kategoriya: 'Sinov',
          nomi: 'Sinovga kelmaslik yuqori',
          sabab: `Oxirgi 30 kunda kelmaslik ${noshowRate}%${top ? ` · eng ko'p sabab: ${holat(top[0])}` : ''}`,
          tasir: `${kelmadiN} ta potensial o'quvchi yo'qotilmoqda`,
          tavsiya: top?.[0] === 'vaqt_mos_kelmadi' ? "Kechki/dam olish kunlari sinov slotlarini ko'paytiring" : 'Sinovdan 1 kun va 2 soat oldin eslatma tizimini joriy qiling',
          havola: '/sinovlar',
        });
      }
    }

    // ---- Trial -> Sale konversiyasi ----
    const kelganlar = leads.filter((l) => ['sinovga_keldi', 'taklif_berildi', 'qaror_kutilmoqda', 'sotuv_yopildi'].includes(l.status));
    const sotilgan = leads.filter((l) => l.status === 'sotuv_yopildi');
    if (kelganlar.length >= 5) {
      const conv = Math.round((100 * sotilgan.length) / kelganlar.length);
      if (conv < 50) {
        muammolar.push({
          daraja: conv < 35 ? 'critical' : 'warning', kategoriya: 'Sotuv',
          nomi: 'Sinovdan keyingi sotuv konversiyasi past',
          sabab: `Sinovga kelganlarning faqat ${conv}% i sotib olmoqda (${sotilgan.length}/${kelganlar.length})`,
          tasir: `${kelganlar.length - sotilgan.length} ta "issiq" lid yopilmagan`,
          tavsiya: 'Sinovdan keyin 24 soat ichida taklif berish va 3 bosqichli follow-up joriy qiling', havola: '/lidlar',
        });
      }
    }

    // ---- O'QUVCHI signallari ----
    const xavfli = risk.filter((r) => r.score < 40);
    const etibor = risk.filter((r) => r.score >= 40 && r.score < 70);
    if (xavfli.length) {
      alerts.push({ daraja: 'critical', matn: `${xavfli.length} ta o'quvchining xavf bali 40 dan past`, havola: '/oquvchilar' });
      const summa = xavfli.reduce((s, r) => s + (feeMap[r.group_id] ?? 0), 0);
      muammolar.push({
        daraja: 'critical', kategoriya: "O'quvchi", nomi: 'Chiqib ketish xavfi',
        sabab: xavfli.map((r) => stuNom(r.student_id)).slice(0, 4).join(', ') + (xavfli.length > 4 ? '…' : ''),
        tasir: `${xavfli.length} o'quvchi · xavf ostidagi daromad: ${som(summa)}/oy`,
        tavsiya: "Har biri bilan bugun aloqa qiling: sabab aniqlang, to'lov/jadval bo'yicha kelishuv taklif qiling", havola: '/oquvchilar',
      });
    }
    if (etibor.length) alerts.push({ daraja: 'warning', matn: `${etibor.length} ta o'quvchiga e'tibor kerak (xavf bali 40-69)`, havola: '/oquvchilar' });

    const qarzlar = payments.filter((p) => ['muddati_otgan', 'qisman', 'kutilmoqda'].includes(p.status) && Number(p.amount_due) > Number(p.amount_paid));
    const qarzSum = qarzlar.reduce((s, p) => s + Number(p.amount_due) - Number(p.amount_paid), 0);
    if (qarzSum > 0) {
      muammolar.push({
        daraja: qarzlar.some((p) => p.status === 'muddati_otgan') ? 'warning' : 'attention',
        kategoriya: 'Moliya', nomi: "To'lovlar kechikmoqda",
        sabab: `${qarzlar.length} ta to'lov yopilmagan`,
        tasir: `Jami qarzdorlik: ${som(qarzSum)}`,
        tavsiya: "Qarzdorlar bilan bog'laning; ilova 49% qoidasi avtomatik bloklaydi", havola: '/tolovlar',
      });
    }

    const churn30 = students.filter((s) => s.status === 'ketgan' && s.churned_at && s.churned_at >= oy30);
    if (churn30.length >= 2) {
      const sab: Record<string, number> = {};
      for (const s of churn30) if (s.churn_reason) sab[s.churn_reason] = (sab[s.churn_reason] ?? 0) + 1;
      const top = Object.entries(sab).sort((a, b) => b[1] - a[1])[0];
      muammolar.push({
        daraja: 'warning', kategoriya: "O'quvchi", nomi: "Ketish (churn) ko'paygan",
        sabab: `Oxirgi 30 kunda ${churn30.length} ta o'quvchi ketdi${top ? ` · asosiy sabab: ${holat(top[0])}` : ''}`,
        tasir: `Yo'qotilgan oylik daromad: ~${som(churn30.length * 500000)}`,
        tavsiya: "Qaytarish ro'yxatini ishga soling: har biriga maxsus taklif bilan qo'ng'iroq", havola: '/oquvchilar',
      });
    }

    const tartib = { critical: 0, warning: 1, attention: 2 } as Record<string, number>;
    muammolar.sort((a, b) => tartib[a.daraja] - tartib[b.daraja]);
    alerts.sort((a, b) => tartib[a.daraja] - tartib[b.daraja]);
    return { alerts, muammolar, xavfli };
  }, [leads, trials, risk, students, payments, feeMap]);

  const D_ICON: Record<string, string> = { critical: '🔴', warning: '🟠', attention: '🟡' };
  const D_NOM: Record<string, string> = { critical: 'KRITIK', warning: 'OGOHLANTIRISH', attention: "E'TIBOR" };

  return (
    <div>
      <div className="page-head"><h1>Muammolar markazi</h1><span className="muted small">avtomatik aniqlanadi · real vaqtda</span></div>

      {!yuklandi ? <p className="muted">Yuklanmoqda…</p> : (
        <>
          <div className="card">
            <h2>Signallar</h2>
            {alerts.length === 0 ? <p className="muted">Hozircha signal yo'q — hammasi joyida 🎉</p> : alerts.map((a, i) => (
              <Link key={i} to={a.havola} className={'alert-line al-' + a.daraja}>
                {D_ICON[a.daraja]} {a.matn} <span className="muted small" style={{ marginLeft: 'auto' }}>ochish →</span>
              </Link>
            ))}
          </div>

          <h2 style={{ margin: '18px 0 10px' }}>Aniqlangan biznes muammolari</h2>
          {muammolar.length === 0 ? (
            <div className="card"><p className="muted">Aniqlangan muammo yo'q. Ma'lumot to'plangani sari tizim tahlilni chuqurlashtiradi.</p></div>
          ) : (
            <div className="muammo-grid">
              {muammolar.map((m, i) => (
                <div key={i} className={'card muammo mu-' + m.daraja}>
                  <div className="row-between">
                    <b>{D_ICON[m.daraja]} {m.nomi}</b>
                    <span className="chip">{m.kategoriya}</span>
                  </div>
                  <div className="small" style={{ margin: '8px 0 4px' }}><span className="muted">Sabab:</span> {m.sabab}</div>
                  <div className="small"><span className="muted">Ta'sir:</span> <b>{m.tasir}</b></div>
                  <div className="tavsiya">✅ {m.tavsiya}</div>
                  {m.havola && <Link to={m.havola} className="btn-sm" style={{ marginTop: 8, display: 'inline-block' }}>Bo'limga o'tish →</Link>}
                </div>
              ))}
            </div>
          )}

          {xavfli.length > 0 && (
            <div className="card" style={{ marginTop: 18 }}>
              <h2>Xavf ostidagi o'quvchilar (xavf bali 40 dan past)</h2>
              <table>
                <thead><tr><th>O'quvchi</th><th>Guruh</th><th>Ball</th><th>14 kunda qoldirgan</th><th>Ketma-ket</th><th>Qarz</th></tr></thead>
                <tbody>
                  {xavfli.map((r) => (
                    <tr key={r.student_id + r.group_id}>
                      <td><Link to={`/oquvchilar/${r.student_id}`}><b>{stuNom(r.student_id)}</b></Link></td>
                      <td className="mono small">{r.group_id}</td>
                      <td><span className={'badge badge-' + riskHolat(r.score).rang}>{r.score}</span></td>
                      <td>{r.kelmagan_14} ta dars</td>
                      <td>{r.ketma_ket} ta</td>
                      <td>{r.qarz_bor ? <span className="red">bor</span> : "yo'q"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
