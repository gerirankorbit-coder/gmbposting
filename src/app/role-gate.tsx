import type { ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';
import { hasRole, type Role } from '../../shared/types';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/empty-state';
import { PageSkeleton } from '@/components/page-skeleton';
import { useMe } from './auth';

/** Hides a page from users below `role`. The server enforces the same rule on every route. */
export function RoleGate({ role, children }: { role: Role; children: ReactNode }) {
  const { data: me, isLoading } = useMe();
  if (isLoading) return <PageSkeleton />;
  if (!hasRole(me?.role, role)) {
    return (
      <Card className="mx-auto max-w-2xl">
        <EmptyState
          icon={ShieldAlert}
          title="You don't have access to this page"
          description={`This page requires the ${role} role. Ask an admin to update your role.`}
        />
      </Card>
    );
  }
  return <>{children}</>;
}
