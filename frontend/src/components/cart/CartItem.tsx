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
    item.imageUrl || 'https://placehold.co/200x200/f3f4f6/9ca3af?text=FlashCart';

  return (
    <div
      data-testid="cart-item"
      className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center"
    >
      <Link
        to={`/products/${item.productId}`}
        className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-gray-100"
      >
        <img
          src={imgUrl}
          alt={item.productName}
          className="h-full w-full object-cover"
        />
      </Link>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link
              to={`/products/${item.productId}`}
              className="text-base font-semibold text-gray-900 hover:text-primary-600"
            >
              {item.productName}
            </Link>
            <p className="text-xs text-gray-500">SKU: {item.productSku}</p>
          </div>
          <div className="text-right">
            <p className="text-base font-bold text-gray-900">
              {formatCurrency(item.lineTotal)}
            </p>
            <p className="text-xs text-gray-500">
              {formatCurrency(item.effectivePrice)} each
            </p>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {item.onFlashSale && (
            <Badge variant="primary" className="gap-1">
              <Zap className="h-3 w-3" />
              Flash Sale Price
            </Badge>
          )}
          <span className="text-xs text-gray-500">
            {item.availableStock > 0
              ? `${item.availableStock} available`
              : 'Out of stock'}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="inline-flex items-center rounded-lg border border-gray-300">
            <button
              type="button"
              disabled={disabled || item.quantity <= 1}
              onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)}
              aria-label="Decrease quantity"
              className="p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="px-3 text-sm font-medium text-gray-900">
              {item.quantity}
            </span>
            <button
              type="button"
              disabled={disabled || item.quantity >= item.availableStock}
              onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}
              aria-label="Increase quantity"
              className="p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            disabled={disabled}
            onClick={() => onRemove(item.productId)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
