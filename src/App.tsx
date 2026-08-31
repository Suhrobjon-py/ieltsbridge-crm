import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { supabase, configured, LOKAL } from './lib/supabase';
import { RoleContext, StaffInfo, BOSH_STAFF } from './lib/role';
import TeacherDetail from './pages/TeacherDetail';
import Setup from './pages/Setup';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import Students from './pages/Students';
import StudentDetail from './pages/StudentDetail';
import Teachers from './pages/Teachers';
import Groups from './pages/Groups';
import GroupDetail from './pages/GroupDetail';
import Payments from './pages/Payments';
import Expenses from './pages/Expenses';
import Reports from './pages/Reports';
import Rooms from './pages/Rooms';
import Trials from './pages/Trials';
import Problems from './pages/Problems';
import Settings from './pages/Settings';
import { holat as holatRol } from './lib/format';

export default function App() {
  if (!configured) return <Setup />;
  return <AuthedApp />;
}

function AuthedApp() {
  const [session, setSession] = useState<any>(undefined);
  const [staff, setStaff] = useState<StaffInfo>(BOSH_STAFF);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const email = session?.user?.email;
    if (!email) return;
    supabase.from('staff_roles').select('*').ilike('email', email).maybeSingle()
      .then(({ data }) => setStaff({
        role: data?.role ?? 'admin',
        perms: (data?.perms as Record<string, string>) ?? {},
        canManage: data?.can_manage_users ?? false,
        teacherId: data?.teacher_id ?? null,
        fullName: data?.full_name ?? '',
        yuklandi: true,
      }));
  }, [session?.user?.email]);

  if (session === undefined) return <div className="center-wrap"><p className="muted">Yuklanmoqda…</p></div>;
  if (!session) return <Login />;

  const superadmin = staff.role === 'superadmin';
  const koradi = (b: string) => superadmin || !!staff.perms[b] || (b === 'guruhlar' && !!staff.teacherId);
  const hechNarsaYoq = staff.yuklandi && !superadmin && !staff.teacherId && Object.keys(staff.perms).length === 0 && !staff.canManage;

  if (hechNarsaYoq) {
    return (
      <div className="center-wrap">
        <div className="card setup-card">
          <div className="logo-big">IELTS<span>Bridge</span> CRM</div>
          <h2>Huquq berilmagan</h2>
          <p>Akkauntingiz ({session.user?.email}) tizimga kirdi, lekin sizga hali bo'lim huquqlari berilmagan.
             Bosh admin bilan bog'laning.</p>
          <button className="btn" onClick={() => supabase.auth.signOut()}>Chiqish</button>
        </div>
      </div>
    );
  }

  return (
    <RoleContext.Provider value={staff}>
    <HashRouter>
      <div className="layout">
        <aside className="sidebar">
          <div className="logo">IELTS<span>Bridge</span><small>CRM</small></div>
          <nav>
            {(koradi('boshqaruv') || koradi('lidlar') || koradi('sinovlar') || koradi('muammolar')) && <span className="nav-sec">SOTUV</span>}
            {koradi('boshqaruv') && <NavLink to="/" end>Boshqaruv</NavLink>}
            {koradi('lidlar') && <NavLink to="/lidlar">Lidlar</NavLink>}
            {koradi('sinovlar') && <NavLink to="/sinovlar">Sinov darslari</NavLink>}
            {koradi('muammolar') && <NavLink to="/muammolar">Muammolar</NavLink>}
            {(koradi('oquvchilar') || koradi('guruhlar') || koradi('xonalar') || koradi('oqituvchilar')) && <span className="nav-sec">O'QUV</span>}
            {koradi('oquvchilar') && <NavLink to="/oquvchilar">O'quvchilar</NavLink>}
            {koradi('guruhlar') && <NavLink to="/guruhlar">Guruhlar</NavLink>}
            {koradi('xonalar') && <NavLink to="/xonalar">Xonalar</NavLink>}
            {koradi('oqituvchilar') && <NavLink to="/oqituvchilar">O'qituvchilar</NavLink>}
            {(koradi('tolovlar') || koradi('xarajatlar') || koradi('hisobotlar') || koradi('sozlamalar') || staff.canManage) && <span className="nav-sec">MOLIYA</span>}
            {koradi('tolovlar') && <NavLink to="/tolovlar">To'lovlar</NavLink>}
            {koradi('xarajatlar') && <NavLink to="/xarajatlar">Xarajatlar</NavLink>}
            {koradi('hisobotlar') && <NavLink to="/hisobotlar">Hisobotlar</NavLink>}
            {(koradi('sozlamalar') || staff.canManage) && <NavLink to="/sozlamalar">Sozlamalar</NavLink>}
          </nav>
          <div className="sidebar-foot">
            <div className="muted small">{staff.fullName || session.user?.email} · {holatRol(staff.role)}{LOKAL ? ' · LOKAL' : ''}</div>
            <button className="btn-ghost logout" onClick={() => supabase.auth.signOut()}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Chiqish
            </button>
          </div>
        </aside>
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/lidlar" element={<Leads />} />
            <Route path="/sinovlar" element={<Trials />} />
            <Route path="/muammolar" element={<Problems />} />
            <Route path="/oquvchilar" element={<Students />} />
            <Route path="/oquvchilar/:id" element={<StudentDetail />} />
            <Route path="/guruhlar" element={<Groups />} />
            <Route path="/guruhlar/:id" element={<GroupDetail />} />
            <Route path="/xonalar" element={<Rooms />} />
            <Route path="/tolovlar" element={<Payments />} />
            <Route path="/oqituvchilar" element={<Teachers />} />
            <Route path="/oqituvchilar/:id" element={<TeacherDetail />} />
            <Route path="/xarajatlar" element={<Expenses />} />
            <Route path="/hisobotlar" element={<Reports />} />
            <Route path="/sozlamalar" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
    </RoleContext.Provider>
  );
}
