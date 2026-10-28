import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 px-1 pt-4 text-sm">
      <p className="text-orbit-muted">
        Showing <span className="font-semibold text-orbit-heading">{from.toLocaleString()}–{to.toLocaleString()}</span> of{' '}
        <span className="font-semibold text-orbit-heading">{total.toLocaleString()}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft /> Prev
        </Button>
        <span className="text-orbit-muted">
          {page} / {pages}
        </span>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
          Next <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}
