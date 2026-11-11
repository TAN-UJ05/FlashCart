import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

export function Spinner({
  size = 'md',
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeClass = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  }[size];

  return (
    <div className={cn('flex items-center justify-center', className)} role="status" aria-label="Loading">
      <Loader2 className={cn('animate-spin text-primary-600', sizeClass)} />
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}
