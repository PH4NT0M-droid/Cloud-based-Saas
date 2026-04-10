import { Navigate, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

function ProtectedRoute({ children, roles = [], permission }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles && roles.length > 0 && !roles.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (permission && user?.role !== 'ADMIN' && !user?.permissions?.[permission]) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default ProtectedRoute;
