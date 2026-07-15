import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[16px] border border-border bg-card text-card-foreground shadow-card transition-shadow hover:shadow-hover',
        className,
      )}
      {...props}
    />
  );
}
