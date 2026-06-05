import { ReactNode } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { Login } from '../../pages/Login';

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Login />;
  }

  return <>{children}</>;
};
