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
    `relative rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150 ${
      isActive
        ? 'bg-primary-50 text-primary-700 font-semibold'
        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-7">
          <Link to="/" className="group flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-indigo-700 text-white shadow-sm transition-transform duration-200 group-hover:scale-105">
              <Zap className="h-4.5 w-4.5 fill-current" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight text-slate-900">
              FlashCart
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <NavLink to="/" end className={navLinkClass}>
              Home
            </NavLink>
            <NavLink to="/products" className={navLinkClass}>
              Catalog
            </NavLink>
            <NavLink to="/flash-sales" className={navLinkClass}>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                Flash Drops
              </span>
            </NavLink>
            {isAdmin && (
              <NavLink to="/admin" className={navLinkClass}>
                Admin Console
              </NavLink>
            )}
          </nav>
        </div>

        <div className="hidden md:block flex-1 max-w-md">
          <SearchInput onSubmit={handleSearch} placeholder="Search laptops, audio, gear..." />
        </div>

        <div className="flex items-center gap-2.5">
          {!isAdmin && (
            <Link
              to="/cart"
              className="relative inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-2.5 py-2 text-slate-700 shadow-xs transition-all duration-150 hover:border-primary-200 hover:bg-primary-50/40 hover:text-primary-700"
              aria-label="Shopping cart"
            >
              <ShoppingCart className="h-4.5 w-4.5" />
              <span
                data-testid="cart-count"
                className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary-600 px-1.5 text-[11px] font-bold tabular-nums text-white"
              >
                {totalItems}
              </span>
            </Link>
          )}

          {isAuthenticated ? (
            <div className="hidden sm:flex items-center gap-2">
              {!isAdmin && (
                <Link
                  to="/orders"
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  <Package className="h-4 w-4" />
                  Orders
                </Link>
              )}
              <Link
                to="/profile"
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <UserIcon className="h-4 w-4" />
                {user?.firstName}
              </Link>
              {isAdmin && (
                <Link
                  to="/admin"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-slate-800"
                >
                  <Shield className="h-3.5 w-3.5 text-primary-400" />
                  Admin Panel
                </Link>
              )}
              <button
                type="button"
                onClick={handleLogout}
                title="Sign out"
                className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
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
                <Button size="sm">Get Started</Button>
              </Link>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="md:hidden rounded-xl p-2 text-slate-600 transition-colors hover:bg-slate-100"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden space-y-3 animate-slide-down">
          <SearchInput onSubmit={handleSearch} testId="mobile-search-input" />
          <div className="flex flex-col gap-1">
            <Link to="/" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-2 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              Home
            </Link>
            <Link to="/products" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-2 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              Catalog
            </Link>
            <Link to="/flash-sales" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-2 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              Flash Drops
            </Link>
            {isAuthenticated ? (
              <>
                {!isAdmin && (
                  <Link to="/orders" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-2 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                    My Orders
                  </Link>
                )}
                <Link to="/profile" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-2 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                  Account
                </Link>
                {isAdmin && (
                  <Link to="/admin" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-2 py-2 text-sm font-semibold text-primary-600 hover:bg-primary-50">
                    Admin Console
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-lg px-2 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50"
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
                  <Button className="w-full" size="sm">Get Started</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
