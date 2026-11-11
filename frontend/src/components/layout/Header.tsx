import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Zap,
  ShoppingCart,
  User as UserIcon,
  LogOut,
  Package,
  Shield,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../../stores/auth.store';
import { useCart } from '../../hooks/useCart';
import { SearchInput } from '../ui/SearchInput';
import { Button } from '../ui/Button';

export function Header() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const { totalItems } = useCart();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSearch = (query: string) => {
    if (query) {
      navigate(`/search?q=${encodeURIComponent(query)}`);
      setMobileMenuOpen(false);
    }
  };

  const handleLogout = async () => {
    setMobileMenuOpen(false);
    navigate('/', { replace: true });
    await logout();
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition-colors ${
      isActive ? 'text-primary-600' : 'text-gray-600 hover:text-gray-900'
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-white shadow-sm">
              <Zap className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900">
              FlashCart
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <NavLink to="/" end className={navLinkClass}>
              Home
            </NavLink>
            <NavLink to="/products" className={navLinkClass}>
              Products
            </NavLink>
            <NavLink to="/flash-sales" className={navLinkClass}>
              Flash Sales
            </NavLink>
            {isAdmin && (
              <NavLink to="/admin" className={navLinkClass}>
                Admin
              </NavLink>
            )}
          </nav>
        </div>

        <div className="hidden md:block flex-1 max-w-md">
          <SearchInput onSubmit={handleSearch} placeholder="Search laptops, phones, gear..." />
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/cart"
            className="relative inline-flex items-center gap-1.5 rounded-lg p-2 text-gray-700 hover:bg-gray-100"
            aria-label="Shopping cart"
          >
            <ShoppingCart className="h-5 w-5" />
            <span
              data-testid="cart-count"
              className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary-600 px-1.5 text-xs font-bold text-white"
            >
              {totalItems}
            </span>
          </Link>

          {isAuthenticated ? (
            <div className="hidden sm:flex items-center gap-2">
              <Link
                to="/orders"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                <Package className="h-4 w-4" />
                Orders
              </Link>
              <Link
                to="/profile"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                <UserIcon className="h-4 w-4" />
                {user?.firstName}
              </Link>
              {isAdmin && (
                <Link
                  to="/admin"
                  className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
                >
                  <Shield className="h-3.5 w-3.5" />
                  Admin
                </Link>
              )}
              <button
                type="button"
                onClick={handleLogout}
                title="Sign out"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </Link>
              <Link to="/register">
                <Button size="sm">Register</Button>
              </Link>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="md:hidden rounded-lg p-2 text-gray-600 hover:bg-gray-100"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-gray-200 bg-white px-4 py-4 md:hidden space-y-3">
          <SearchInput onSubmit={handleSearch} testId="mobile-search-input" />
          <div className="flex flex-col gap-2">
            <Link to="/" onClick={() => setMobileMenuOpen(false)} className="py-1.5 text-sm font-medium">
              Home
            </Link>
            <Link to="/products" onClick={() => setMobileMenuOpen(false)} className="py-1.5 text-sm font-medium">
              Products
            </Link>
            <Link to="/flash-sales" onClick={() => setMobileMenuOpen(false)} className="py-1.5 text-sm font-medium">
              Flash Sales
            </Link>
            {isAuthenticated ? (
              <>
                <Link to="/orders" onClick={() => setMobileMenuOpen(false)} className="py-1.5 text-sm font-medium">
                  My Orders
                </Link>
                <Link to="/profile" onClick={() => setMobileMenuOpen(false)} className="py-1.5 text-sm font-medium">
                  Profile
                </Link>
                {isAdmin && (
                  <Link to="/admin" onClick={() => setMobileMenuOpen(false)} className="py-1.5 text-sm font-medium text-primary-600">
                    Admin Console
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="py-1.5 text-left text-sm font-medium text-red-600"
                >
                  Sign out
                </button>
              </>
            ) : (
              <div className="flex gap-2 pt-2">
                <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="flex-1">
                  <Button variant="outline" className="w-full" size="sm">Sign in</Button>
                </Link>
                <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="flex-1">
                  <Button className="w-full" size="sm">Register</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
