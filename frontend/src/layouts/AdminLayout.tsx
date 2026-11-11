import { Suspense, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { PageLoader } from '../components/ui/Spinner';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Boxes,
  ShoppingBag,
  Zap,
  Users,
  BarChart3,
  ArrowLeft,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../stores/auth.store';

const adminNavItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/categories', label: 'Categories', icon: FolderTree },
  { to: '/admin/inventory', label: 'Inventory', icon: Boxes },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/admin/flash-sales', label: 'Flash Sales', icon: Zap },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    navigate('/login', { state: null, replace: true });
    await logout();
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-gray-200 bg-gray-900 text-gray-100 transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-gray-800 px-5">
          <Link to="/admin" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white">
              <Zap className="h-4 w-4" />
            </div>
            <span className="text-lg font-bold tracking-tight">FlashCart Admin</span>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded p-1 text-gray-400 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-gray-800 p-3 space-y-1">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Storefront
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-gray-800"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 lg:hidden"
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm font-medium text-gray-500">
              Operations & Control Center
            </span>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:inline text-gray-600">
              Signed in as <strong className="text-gray-900">{user?.email}</strong>
            </span>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
