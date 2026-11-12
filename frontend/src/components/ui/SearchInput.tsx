import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Search, X } from 'lucide-react';
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (value !== prevValue) {
    setPrevValue(value);
    setInnerValue(value);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const clearPendingTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleInputChange = (nextValue: string) => {
    setInnerValue(nextValue);
    clearPendingTimer();
    if (onChange) {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        onChange(nextValue);
      }, debounceMs);
    }
  };

  const handleClear = () => {
    clearPendingTimer();
    setInnerValue('');
    onChange?.('');
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    clearPendingTimer();
    onSubmit?.(innerValue.trim());
  };

  return (
    <form onSubmit={handleSubmit} className={cn('relative w-full', className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={innerValue}
        data-testid={testId}
        onChange={(e) => handleInputChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-9 text-sm text-slate-900 transition-all duration-150 placeholder:text-slate-400 hover:bg-white hover:border-slate-300 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/10"
      />
      {innerValue && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </form>
  );
}
