import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { supabase, configured } from './lib/supabase';
import { RoleContext, StaffRole } from './lib/role';
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

export default function App() {
  if (!configured) return <Setup />;
  return <AuthedApp />;
}

function AuthedApp() {
  const [session, setSession] = useState<any>(undefined);
  const [role, setRole] = useState<StaffRole>('admin');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const email = session?.user?.email;
    if (!email) return;
    supabase.from('staff_roles').select('role').ilike('email', email).maybeSingle()
      .then(({ data }) => setRole(data?.role === 'superadmin' ? 'superadmin' : 'admin'));
  }, [session?.user?.email]);

  if (session === undefined) return <div className="center-wrap"><p className="muted">Yuklanmoqda…</p></div>;
  if (!session) return <Login />;

  return (
    <RoleContext.Provider value={role}>
    <HashRouter>
      <div className="layout">
        <aside className="sidebar">
          <div className="logo">IELTS<span>Bridge</span><small>CRM</small></div>
          <nav>
            <NavLink to="/" end>Boshqaruv</NavLink>
            <NavLink to="/lidlar">Lidlar</NavLink>
            <NavLink to="/oquvchilar">O'quvchilar</NavLink>
            <NavLink to="/guruhlar">Guruhlar</NavLink>
            <NavLink to="/xonalar">Xonalar</NavLink>
            <NavLink to="/tolovlar">To'lovlar</NavLink>
            <NavLink to="/oqituvchilar">O'qituvchilar</NavLink>
            <NavLink to="/xarajatlar">Xarajatlar</NavLink>
            <NavLink to="/hisobotlar">Hisobotlar</NavLink>
          </nav>
          <div className="sidebar-foot">
            <div className="muted small">{session.user?.email} · {role === 'superadmin' ? 'Superadmin' : 'Admin'}</div>
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
    </RoleContext.Provider>
  );
}
