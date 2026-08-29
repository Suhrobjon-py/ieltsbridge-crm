import { createContext, useContext } from 'react';

export type StaffInfo = {
  role: string;                       // superadmin | admin | reseption | call_markaz | oqituvchi
  perms: Record<string, string>;      // { bolim: korish|tahrirlash|ochirish }
  canManage: boolean;                 // foydalanuvchi/rol yaratish huquqi
  teacherId: string | null;           // oqituvchi bo'lsa — o'z guruhlari ochiladi
  fullName: string;
  yuklandi: boolean;
};

export const BOSH_STAFF: StaffInfo = { role: 'admin', perms: {}, canManage: false, teacherId: null, fullName: '', yuklandi: false };

export const RoleContext = createContext<StaffInfo>(BOSH_STAFF);

export function useRole() {
  const s = useContext(RoleContext);
  const superadmin = s.role === 'superadmin';
  return {
    ...s,
    superadmin,
    // bo'limni umuman ko'rish (nav uchun)
    canSee: (b: string) => superadmin || !!s.perms[b] || (b === 'guruhlar' && !!s.teacherId),
    canEdit: (b: string) => superadmin || ['tahrirlash', 'ochirish'].includes(s.perms[b] ?? ''),
    canDelete: (b: string) => superadmin || (s.perms[b] ?? '') === 'ochirish',
  };
}
