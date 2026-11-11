import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';

const CURRENT_YEAR = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div>
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white">
                <Zap className="h-4 w-4" />
              </div>
              <span className="text-lg font-bold text-gray-900">FlashCart</span>
            </Link>
            <p className="mt-3 text-sm text-gray-500">
              High-concurrency e-commerce platform built with PostgreSQL pessimistic locking,
              Kafka transactional outbox, and Redis caching.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900">Shop</h4>
            <ul className="mt-3 space-y-2 text-sm text-gray-500">
              <li><Link to="/products" className="hover:text-primary-600">All Products</Link></li>
              <li><Link to="/flash-sales" className="hover:text-primary-600">Live Flash Sales</Link></li>
              <li><Link to="/categories/electronics" className="hover:text-primary-600">Electronics</Link></li>
              <li><Link to="/categories/clothing" className="hover:text-primary-600">Clothing</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900">Account</h4>
            <ul className="mt-3 space-y-2 text-sm text-gray-500">
              <li><Link to="/profile" className="hover:text-primary-600">My Profile</Link></li>
              <li><Link to="/orders" className="hover:text-primary-600">Order History</Link></li>
              <li><Link to="/cart" className="hover:text-primary-600">Shopping Cart</Link></li>
              <li><Link to="/login" className="hover:text-primary-600">Sign In</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900">Engineering</h4>
            <ul className="mt-3 space-y-2 text-sm text-gray-500">
              <li>Zero Overselling Guarantee</li>
              <li>Idempotent Payment Engine</li>
              <li>Atomic Stock Reservations</li>
              <li>Real-Time Analytics</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-gray-100 pt-6 text-center text-xs text-gray-400">
          © {CURRENT_YEAR} FlashCart. Production-Grade Modular Monolith E-Commerce.
        </div>
      </div>
    </footer>
  );
}
