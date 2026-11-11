import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';
import type { FlashSaleItem } from '../../types';
import { formatCurrency } from '../../utils/format';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

export interface FlashSaleCardProps {
  item: FlashSaleItem;
  onPurchase: (item: FlashSaleItem) => void;
  isPurchasing?: boolean;
}

export function FlashSaleCard({
  item,
  onPurchase,
  isPurchasing = false,
}: FlashSaleCardProps) {
  const soldOut = item.remainingStock <= 0;
  const pctRemaining =
    item.saleStock > 0 ? Math.round((item.remainingStock / item.saleStock) * 100) : 0;
  const discountPct =
    item.regularPrice > item.salePrice
      ? Math.round(((item.regularPrice - item.salePrice) / item.regularPrice) * 100)
      : 0;
  const imageUrl =
    item.productId && item.imageUrl
      ? item.imageUrl
      : 'https://placehold.co/600x600/fff7ed/ea580c?text=Flash+Deal';

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-primary-200 bg-white shadow-sm">
      <Link
        to={`/products/${item.productId}`}
        className="relative aspect-square overflow-hidden bg-gray-100"
      >
        <img
          src={imageUrl}
          alt={item.productName}
          className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
        />
        <div className="absolute left-3 top-3 flex gap-1.5">
          <Badge variant="primary" className="bg-primary-600 text-white border-0 gap-1">
            <Zap className="h-3 w-3" />
            -{discountPct}%
          </Badge>
        </div>
        {soldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="rounded-full bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-gray-900">
              Sold Out
            </span>
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <Link
          to={`/products/${item.productId}`}
          className="line-clamp-2 text-sm font-semibold text-gray-900 hover:text-primary-600"
        >
          {item.productName}
        </Link>
        <p className="mt-0.5 text-xs text-gray-400">SKU: {item.productSku}</p>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-xl font-bold text-primary-600">
            {formatCurrency(item.salePrice)}
          </span>
          {item.regularPrice > item.salePrice && (
            <span className="text-sm text-gray-400 line-through">
              {formatCurrency(item.regularPrice)}
            </span>
          )}
        </div>

        <div className="mt-3">
          <div className="flex justify-between text-xs font-medium text-gray-600">
            <span>{item.remainingStock} left</span>
            <span>{item.soldCount} claimed</span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full transition-all ${
                pctRemaining < 20 ? 'bg-red-500' : 'bg-primary-500'
              }`}
              style={{ width: `${Math.max(4, pctRemaining)}%` }}
            />
          </div>
        </div>

        <Button
          className="mt-4 w-full"
          disabled={soldOut || isPurchasing}
          isLoading={isPurchasing}
          onClick={() => onPurchase(item)}
        >
          <Zap className="h-4 w-4" />
          {soldOut ? 'Sold Out' : 'Buy Flash Deal'}
        </Button>
      </div>
    </div>
  );
}
