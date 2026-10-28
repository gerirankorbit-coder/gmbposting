export const ROLES = ['admin', 'manager', 'writer'] as const;
export type Role = (typeof ROLES)[number];

/** Higher rank includes every permission of lower ranks. */
export const ROLE_RANK: Record<Role, number> = { writer: 1, manager: 2, admin: 3 };

export function hasRole(role: Role | null | undefined, required: Role): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[required];
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export interface Me {
  id: string;
  email: string | null;
  name: string | null;
  imageUrl: string | null;
  role: Role;
}

export interface HealthStatus {
  ok: boolean;
  time: string;
  version: string;
  config: Record<string, boolean>;
}
