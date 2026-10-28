import { Link } from 'react-router-dom';
import { ArrowRight, Compass } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button, ButtonChip } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';

export function NotFoundPage() {
  return (
    <Card className="mx-auto max-w-2xl">
      <EmptyState
        icon={Compass}
        title="This page drifted out of orbit"
        description="The page you are looking for does not exist or has moved."
        action={
          <Button asChild>
            <Link to="/">
              Back to dashboard
              <ButtonChip>
                <ArrowRight />
              </ButtonChip>
            </Link>
          </Button>
        }
      />
    </Card>
  );
}
