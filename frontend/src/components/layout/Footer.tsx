import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { useAuth } from '../../stores/auth.store';

export function Footer() {
  const { isAdmin } = useAuth();

  return (
    <footer className="border-t border-slate-200/80 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div className="md:col-span-1">
            <Link to="/" className="inline-flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-indigo-700 text-white shadow-sm">
                <Zap className="h-4 w-4 fill-current" />
              </div>
              <span className="font-display text-lg font-bold tracking-tight text-slate-900">
                FlashCart
              </span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              Curated electronics, workspace hardware, and time-limited flash drops delivered directly to your door.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">Catalog</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-500">
              <li><Link to="/products" className="transition-colors hover:text-primary-600">All Products</Link></li>
              <li><Link to="/flash-sales" className="transition-colors hover:text-primary-600">Live Flash Drops</Link></li>
              <li><Link to="/categories/electronics" className="transition-colors hover:text-primary-600">Electronics</Link></li>
              <li><Link to="/categories/clothing" className="transition-colors hover:text-primary-600">Apparel &amp; Lifestyle</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              {isAdmin ? 'Administration' : 'Customer Care'}
            </h4>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-500">
              {isAdmin ? (
                <>
                  <li><Link to="/admin" className="transition-colors hover:text-primary-600">Store Overview</Link></li>
                  <li><Link to="/admin/products" className="transition-colors hover:text-primary-600">Catalog Manager</Link></li>
                  <li><Link to="/admin/flash-sales" className="transition-colors hover:text-primary-600">Flash Campaigns</Link></li>
                  <li><Link to="/admin/orders" className="transition-colors hover:text-primary-600">Order Fulfillment</Link></li>
                </>
              ) : (
                <>
                  <li><Link to="/profile" className="transition-colors hover:text-primary-600">Account Settings</Link></li>
                  <li><Link to="/orders" className="transition-colors hover:text-primary-600">Order Tracking</Link></li>
                  <li><Link to="/cart" className="transition-colors hover:text-primary-600">Shopping Bag</Link></li>
                  <li><Link to="/login" className="transition-colors hover:text-primary-600">Member Sign In</Link></li>
                </>
              )}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">Service Promise</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-500">
              <li>Same-day dispatch on confirmed orders</li>
              <li>Real-time stock availability</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-6 text-xs text-slate-400 sm:flex-row">
          <span>FlashCart Storefront</span>
          <span>Express shipping across India</span>
        </div>
      </div>
    </footer>
  );
}
