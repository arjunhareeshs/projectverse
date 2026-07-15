import { useSelector } from 'react-redux';
import type { RootState } from '../redux/store';
import type { UserRole } from '../types/auth';

export function useAuthGuard(allowedRoles?: UserRole[]) {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  if (!isAuthenticated || !user) {
    return { isAllowed: false, isAuthenticated };
  }

  if (!allowedRoles || allowedRoles.length === 0) {
    return { isAllowed: true, isAuthenticated };
  }

  return {
    isAllowed: allowedRoles.includes(user.role),
    isAuthenticated,
  };
}
