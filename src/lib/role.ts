import { createContext, useContext } from 'react';

export type StaffRole = 'superadmin' | 'admin';

export const RoleContext = createContext<StaffRole>('admin');

export function useRole(): { role: StaffRole; superadmin: boolean } {
  const role = useContext(RoleContext);
  return { role, superadmin: role === 'superadmin' };
}
