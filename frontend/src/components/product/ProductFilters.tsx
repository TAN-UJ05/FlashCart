import type { Category } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export interface ProductFilterValues {
  categoryId?: number;
  minPrice?: string;
  maxPrice?: string;
  sortBy: string;
  sortDir: 'asc' | 'desc';
}

export interface ProductFiltersProps {
  categories: Category[];
  filters: ProductFilterValues;
  onChange: (next: ProductFilterValues) => void;
  onReset: () => void;
}

export function ProductFilters({
  categories,
  filters,
  onChange,
  onReset,
}: ProductFiltersProps) {
  const sortValue = `${filters.sortBy}:${filters.sortDir}`;

  return (
    <aside className="space-y-6 rounded-2xl border border-slate-200/85 bg-white p-5 shadow-soft lg:sticky lg:top-24">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
          Filter Catalog
        </h2>
        <button
          type="button"
          onClick={onReset}
          className="text-xs font-semibold text-primary-600 transition-colors hover:text-primary-700"
        >
          Reset
        </button>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
          Sort By
        </label>
        <select
          value={sortValue}
          onChange={(e) => {
            const [sortBy, sortDir] = e.target.value.split(':') as [string, 'asc' | 'desc'];
            onChange({ ...filters, sortBy, sortDir });
          }}
          className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-sm text-slate-900 transition-colors hover:border-slate-300 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/10"
        >
          <option value="createdAt:desc">Newest Arrivals</option>
          <option value="price:asc">Price: Low to High</option>
          <option value="price:desc">Price: High to Low</option>
          <option value="name:asc">Name: A to Z</option>
        </select>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Category
        </h3>
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => onChange({ ...filters, categoryId: undefined })}
            className={`w-full rounded-xl px-3 py-2 text-left text-sm transition-all ${
              filters.categoryId === undefined
                ? 'bg-primary-50 font-semibold text-primary-700'
                : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onChange({ ...filters, categoryId: cat.id })}
              className={`w-full rounded-xl px-3 py-2 text-left text-sm transition-all ${
                filters.categoryId === cat.id
                  ? 'bg-primary-50 font-semibold text-primary-700'
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Price Range (₹)
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            min="0"
            placeholder="Min"
            value={filters.minPrice ?? ''}
            onChange={(e) => onChange({ ...filters, minPrice: e.target.value })}
          />
          <Input
            type="number"
            min="0"
            placeholder="Max"
            value={filters.maxPrice ?? ''}
            onChange={(e) => onChange({ ...filters, maxPrice: e.target.value })}
          />
        </div>
      </div>

      <Button variant="outline" size="sm" onClick={onReset} className="w-full">
        Clear All Filters
      </Button>
    </aside>
  );
}
