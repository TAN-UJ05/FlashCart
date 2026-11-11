import { useEffect, useState, type FormEvent } from 'react';
import { Search, X } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import { cn } from '../../utils/cn';

export interface SearchInputProps {
  value?: string;
  onChange?: (val: string) => void;
  onSubmit?: (val: string) => void;
  placeholder?: string;
  className?: string;
  testId?: string;
  debounceMs?: number;
}

export function SearchInput({
  value = '',
  onChange,
  onSubmit,
  placeholder = 'Search products...',
  className,
  testId = 'search-input',
  debounceMs = 350,
}: SearchInputProps) {
  const [innerValue, setInnerValue] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  const debounced = useDebounce(innerValue, debounceMs);

  if (value !== prevValue) {
    setPrevValue(value);
    setInnerValue(value);
  }

  useEffect(() => {
    if (onChange && debounced !== value) {
      onChange(debounced);
    }
  }, [debounced, onChange, value]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit?.(innerValue.trim());
  };

  return (
    <form onSubmit={handleSubmit} className={cn('relative w-full', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        type="search"
        value={innerValue}
        data-testid={testId}
        onChange={(e) => setInnerValue(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-8 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
      />
      {innerValue && (
        <button
          type="button"
          onClick={() => {
            setInnerValue('');
            onChange?.('');
          }}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </form>
  );
}
