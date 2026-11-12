import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2, Zap } from 'lucide-react';
import type { CartItem as CartItemType } from '../../types';
import { formatCurrency } from '../../utils/format';
import { Badge } from '../ui/Badge';

export interface CartItemProps {
  item: CartItemType;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
  disabled?: boolean;
}

export function CartItem({
  item,
  onUpdateQuantity,
  onRemove,
  disabled = false,
}: CartItemProps) {
  const imgUrl =
    item.imageUrl || 'https://placehold.co/200x200/eef2ff/4f46e5?text=FlashCart';

  return (
    <div
      data-testid="cart-item"
      className="flex flex-col gap-4 rounded-2xl border border-slate-200/85 bg-white p-4.5 shadow-soft transition-all duration-200 hover:border-slate-300/80 sm:flex-row sm:items-center"
    >
      <Link
        to={`/products/${item.productId}`}
        className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100"
      >
        <img
          src={imgUrl}
          alt={item.productName}
          className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
        />
      </Link>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link
              to={`/products/${item.productId}`}
              className="text-base font-bold text-slate-900 transition-colors hover:text-primary-600"
            >
              {item.productName}
            </Link>
            <p className="font-mono text-xs text-slate-400">SKU: {item.productSku}</p>
          </div>
          <div className="text-right">
            <p className="text-base font-extrabold tabular-nums text-slate-900">
              {formatCurrency(item.lineTotal)}
            </p>
            <p className="text-xs tabular-nums text-slate-500">
              {formatCurrency(item.effectivePrice)} each
            </p>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {item.onFlashSale && (
            <Badge className="gap-1 border-0 bg-amber-100 text-amber-900">
              <Zap className="h-3 w-3 fill-current" />
              Flash Sale Price
            </Badge>
          )}
          <span className="text-xs text-slate-500">
            {item.availableStock > 0
              ? `${item.availableStock} available`
              : 'Out of stock'}
          </span>
        </div>

        <div className="mt-3.5 flex items-center justify-between">
          <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50/70">
            <button
              type="button"
              disabled={disabled || item.quantity <= 1}
              onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)}
              aria-label="Decrease quantity"
              className="rounded-l-xl p-2 text-slate-600 transition-colors hover:bg-slate-200/70 disabled:opacity-40"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="px-3.5 text-sm font-bold tabular-nums text-slate-900">
              {item.quantity}
            </span>
            <button
              type="button"
              disabled={disabled || item.quantity >= item.availableStock}
              onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}
              aria-label="Increase quantity"
              className="rounded-r-xl p-2 text-slate-600 transition-colors hover:bg-slate-200/70 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            disabled={disabled}
            onClick={() => onRemove(item.productId)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
