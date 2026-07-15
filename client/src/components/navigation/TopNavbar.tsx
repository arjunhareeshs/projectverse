import { Bell, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function TopNavbar() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 lg:px-6">
      <div />

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </Button>
        <div className="h-9 w-9 rounded-full bg-primary/15" />
      </div>
    </header>
  );
}
