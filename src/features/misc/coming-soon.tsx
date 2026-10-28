import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button, ButtonChip } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/layout/page-header';

interface ShellPageProps {
  eyebrow: string;
  title: string;
  highlight: string;
  description: string;
  icon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
  bubbles?: boolean;
}

/** Page frame used while a section is being built out. */
export function ShellPage(props: ShellPageProps) {
  return (
    <>
      <PageHeader
        eyebrow={props.eyebrow}
        title={props.title}
        highlight={props.highlight}
        description={props.description}
        bubbles={props.bubbles}
      />
      <Card>
        <EmptyState
          icon={props.icon}
          title={props.emptyTitle}
          description={props.emptyDescription}
          action={
            <Button asChild variant="secondary">
              <Link to="/connections">
                Connect Google accounts
                <ButtonChip tone="gradient">
                  <ArrowRight />
                </ButtonChip>
              </Link>
            </Button>
          }
        />
      </Card>
    </>
  );
}
