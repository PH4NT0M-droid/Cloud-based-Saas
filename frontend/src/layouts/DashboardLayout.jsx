import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';

function DashboardLayout() {
  return (
    <div className="min-h-screen md:flex bg-[radial-gradient(circle_at_top_left,rgba(66,192,184,0.18),transparent_35%),radial-gradient(circle_at_top_right,rgba(245,171,42,0.16),transparent_30%),linear-gradient(180deg,#f8fcfc_0%,#f5f7fb_100%)]">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <Navbar />
        <main className="p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
