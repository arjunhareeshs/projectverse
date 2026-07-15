import type { PropsWithChildren } from 'react';
import { Card } from '@/components/ui/card';

interface AuthCardProps extends PropsWithChildren {
  title: string;
  subtitle: string;
}

export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <Card className="w-full max-w-md p-8">
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
      <div className="mt-6">{children}</div>
    </Card>
  );
}
