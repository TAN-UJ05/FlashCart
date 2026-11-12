import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

export interface PaginationProps {
  pageNumber: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ pageNumber, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: number[] = [];
  const start = Math.max(0, pageNumber - 2);
  const end = Math.min(totalPages - 1, pageNumber + 2);
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-center gap-1.5 pt-4">
      <Button
        variant="outline"
        size="sm"
        disabled={pageNumber === 0}
        onClick={() => onPageChange(pageNumber - 1)}
      >
        <ChevronLeft className="h-4 w-4" />
        Prev
      </Button>

      {start > 0 && (
        <>
          <Button variant="outline" size="sm" onClick={() => onPageChange(0)}>
            1
          </Button>
          {start > 1 && <span className="px-1 text-slate-400">...</span>}
        </>
      )}

      {pages.map((p) => (
        <Button
          key={p}
          variant={p === pageNumber ? 'primary' : 'outline'}
          size="sm"
          onClick={() => onPageChange(p)}
        >
          {p + 1}
        </Button>
      ))}

      {end < totalPages - 1 && (
        <>
          {end < totalPages - 2 && <span className="px-1 text-slate-400">...</span>}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(totalPages - 1)}
          >
            {totalPages}
          </Button>
        </>
      )}

      <Button
        variant="outline"
        size="sm"
        disabled={pageNumber >= totalPages - 1}
        onClick={() => onPageChange(pageNumber + 1)}
      >
        Next
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
