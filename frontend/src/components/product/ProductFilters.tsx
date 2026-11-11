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
    <aside className="space-y-6 rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-900">
          Filters
        </h2>
        <button
          type="button"
          onClick={onReset}
          className="text-xs font-medium text-primary-600 hover:text-primary-700"
        >
          Reset all
        </button>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Sort By
        </label>
        <select
          value={sortValue}
          onChange={(e) => {
            const [sortBy, sortDir] = e.target.value.split(':') as [string, 'asc' | 'desc'];
            onChange({ ...filters, sortBy, sortDir });
          }}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        >
          <option value="createdAt:desc">Newest First</option>
          <option value="price:asc">Price: Low to High</option>
          <option value="price:desc">Price: High to Low</option>
          <option value="name:asc">Name: A to Z</option>
        </select>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-gray-700">Category</h3>
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => onChange({ ...filters, categoryId: undefined })}
            className={`w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
              filters.categoryId === undefined
                ? 'bg-primary-50 font-medium text-primary-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onChange({ ...filters, categoryId: cat.id })}
              className={`w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                filters.categoryId === cat.id
                  ? 'bg-primary-50 font-medium text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-gray-700">Price Range (₹)</h3>
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
        Clear Filters
      </Button>
    </aside>
  );
}
