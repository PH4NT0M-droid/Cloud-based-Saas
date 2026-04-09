import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PropertiesPage from './pages/PropertiesPage';
import InventoryPage from './pages/InventoryPage';
import RatesPage from './pages/RatesPage';
import BookingsPage from './pages/BookingsPage';
import PromotionsPage from './pages/PromotionsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AdminPanel from './pages/AdminPanel';
import PropertyDetails from './pages/PropertyDetails';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/properties" element={<PropertiesPage />} />
        <Route path="/properties/:propertyId" element={<PropertyDetails />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/rates" element={<RatesPage />} />
        <Route path="/bookings" element={<BookingsPage />} />
        <Route path="/promotions" element={<PromotionsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminPanel />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
