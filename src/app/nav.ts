import {
  Activity,
  BookImage,
  CalendarDays,
  CheckCheck,
  FileSpreadsheet,
  LayoutDashboard,
  Link2,
  ListChecks,
  MapPin,
  PenSquare,
  Settings,
  Bell,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '../../shared/types';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Minimum role needed to see the item. */
  role?: Role;
}

export const primaryNav: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/active-clients', label: 'Active Clients', icon: UserCheck },
  { to: '/import', label: 'Import', icon: FileSpreadsheet },
  { to: '/compose', label: 'Compose', icon: PenSquare },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/queue', label: 'Queue', icon: ListChecks },
  { to: '/locations', label: 'Locations', icon: MapPin },
  { to: '/connections', label: 'Connections', icon: Link2 },
];

export const secondaryNav: NavItem[] = [
  { to: '/library', label: 'Library', icon: BookImage },
  { to: '/approvals', label: 'Approvals', icon: CheckCheck, role: 'manager' },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/activity', label: 'Activity', icon: Activity },
  { to: '/settings', label: 'Settings', icon: Settings, role: 'admin' },
];
