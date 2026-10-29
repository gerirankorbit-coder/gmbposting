import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { UserButton } from '@clerk/react';
import { ChevronDown, Menu } from 'lucide-react';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { hasRole } from '../../../shared/types';
import { useMe } from '@/app/auth';
import { primaryNav, secondaryNav, type NavItem } from '@/app/nav';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Logo } from './logo';

function useVisible(items: NavItem[]) {
  const { data: me } = useMe();
  return items.filter((i) => !i.role || hasRole(me?.role, i.role));
}

function isActive(pathname: string, to: string) {
  return to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`);
}

export function Navbar({ notificationSlot }: { notificationSlot?: React.ReactNode }) {
  const { pathname } = useLocation();
  const primary = useVisible(primaryNav);
  const secondary = useVisible(secondaryNav);
  const moreActive = secondary.some((i) => isActive(pathname, i.to));

  return (
    <div className="sticky top-0 z-40 px-3 pt-3 sm:px-4 sm:pt-4">
      <nav
        aria-label="Main"
        className="glass mx-auto flex h-14 max-w-7xl items-center gap-2 rounded-full pl-4 pr-2 sm:h-16 sm:pl-6"
      >
        <Logo className="mr-2" />

        <ul className="mx-auto hidden items-center gap-0.5 xl:flex">
          {primary.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive: active }) =>
                  cn(
                    'whitespace-nowrap rounded-full px-2.5 py-2 text-sm font-semibold transition-colors 2xl:px-3',
                    active
                      ? 'bg-orbit-gradient text-white shadow-glow'
                      : 'text-orbit-body hover:bg-orbit-primary/10 hover:text-orbit-primary',
                  )
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
          {secondary.length > 0 && (
            <li>
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={cn(
                    'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-2 text-sm font-semibold transition-colors 2xl:px-3',
                    moreActive
                      ? 'bg-orbit-gradient text-white shadow-glow'
                      : 'text-orbit-body hover:bg-orbit-primary/10 hover:text-orbit-primary',
                  )}
                >
                  More <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-48">
                  {secondary.map((item) => (
                    <DropdownMenuItem key={item.to} asChild>
                      <Link to={item.to}>
                        <item.icon aria-hidden />
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          )}
        </ul>

        <div className="ml-auto flex items-center gap-1.5 xl:ml-0">
          {notificationSlot ?? <NotificationBell />}
          <div className="flex h-10 w-10 items-center justify-center">
            <UserButton appearance={{ elements: { avatarBox: 'h-9 w-9' } }} />
          </div>
          <MobileMenu primary={primary} secondary={secondary} pathname={pathname} />
        </div>
      </nav>
    </div>
  );
}

function MobileMenu({
  primary,
  secondary,
  pathname,
}: {
  primary: NavItem[];
  secondary: NavItem[];
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const renderItem = (item: NavItem) => (
    <li key={item.to}>
      <Link
        to={item.to}
        onClick={() => setOpen(false)}
        className={cn(
          'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors',
          isActive(pathname, item.to)
            ? 'bg-orbit-gradient text-white shadow-glow'
            : 'text-orbit-body hover:bg-orbit-primary/10 hover:text-orbit-primary',
        )}
      >
        <item.icon className="h-4 w-4" aria-hidden />
        {item.label}
      </Link>
    </li>
  );
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="xl:hidden" aria-label="Open menu">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Logo />
        </SheetHeader>
        <ul className="flex flex-col gap-1">{primary.map(renderItem)}</ul>
        {secondary.length > 0 && (
          <>
            <Separator />
            <ul className="flex flex-col gap-1">{secondary.map(renderItem)}</ul>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
