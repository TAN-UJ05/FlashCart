import { Link, useNavigate } from 'react-router-dom';
import { SlidersHorizontal, Zap } from 'lucide-react';
import type { FlashSaleItem } from '../../types';
import { useAuth } from '../../stores/auth.store';
import { formatCurrency } from '../../utils/format';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

export interface FlashSaleCardProps {
  item: FlashSaleItem;
  onPurchase: (item: FlashSaleItem) => void;
  isPurchasing?: boolean;
  index?: number;
}

export function FlashSaleCard({
  item,
  onPurchase,
  isPurchasing = false,
  index = 0,
}: FlashSaleCardProps) {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

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
      : 'https://placehold.co/600x600/eef2ff/4f46e5?text=Flash+Drop';

  return (
    <div
      style={{ animationDelay: `${Math.min(index, 7) * 50}ms` }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-amber-200/80 bg-white shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-amber-300 hover:shadow-elevated animate-fade-in-up"
    >
      <Link
        to={`/products/${item.productId}`}
        className="relative aspect-square overflow-hidden bg-slate-100"
      >
        <img
          src={imageUrl}
          alt={item.productName}
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
        />
        <div className="absolute left-3 top-3 flex gap-1.5">
          <Badge className="gap-1 border-0 bg-amber-500 text-slate-950 shadow-sm tabular-nums">
            <Zap className="h-3 w-3 fill-current" />
            -{discountPct}%
          </Badge>
        </div>
        {soldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px]">
            <span className="rounded-full bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-900">
              Sold Out
            </span>
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4.5">
        <Link
          to={`/products/${item.productId}`}
          className="line-clamp-2 text-sm font-bold leading-snug text-slate-900 transition-colors group-hover:text-primary-600"
        >
          {item.productName}
        </Link>
        <p className="mt-1 font-mono text-[11px] text-slate-400">SKU: {item.productSku}</p>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-xl font-extrabold tabular-nums text-slate-900">
            {formatCurrency(item.salePrice)}
          </span>
          {item.regularPrice > item.salePrice && (
            <span className="text-sm tabular-nums text-slate-400 line-through">
              {formatCurrency(item.regularPrice)}
            </span>
          )}
        </div>

        <div className="mt-3.5">
          <div className="flex justify-between text-xs font-semibold text-slate-600 tabular-nums">
            <span>{item.remainingStock} remaining</span>
            <span>{item.soldCount} claimed</span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                pctRemaining < 20
                  ? 'bg-gradient-to-r from-rose-500 to-rose-600'
                  : 'bg-gradient-to-r from-amber-400 to-amber-500'
              }`}
              style={{ width: `${Math.max(4, pctRemaining)}%` }}
            />
          </div>
        </div>

        {isAdmin ? (
          <Button
            variant="outline"
            className="mt-4 w-full"
            onClick={() => navigate('/admin/flash-sales')}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Manage Campaign
          </Button>
        ) : (
          <Button
            className="mt-4 w-full"
            disabled={soldOut || isPurchasing}
            isLoading={isPurchasing}
            onClick={() => onPurchase(item)}
          >
            <Zap className="h-4 w-4" />
            {soldOut ? 'Sold Out' : 'Buy Flash Deal'}
          </Button>
        )}
      </div>
    </div>
  );
}
