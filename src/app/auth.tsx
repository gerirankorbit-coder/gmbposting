import { useEffect } from 'react';
import { useAuth } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import { hasRole, type Me, type Role } from '../../shared/types';
import { api, setTokenGetter } from '@/lib/api';
import { qk } from '@/lib/query-keys';

/** Wires Clerk's session token into the API client. Render once inside ClerkProvider. */
export function AuthTokenBridge() {
  const { getToken } = useAuth();
  useEffect(() => {
    setTokenGetter(() => getToken());
  }, [getToken]);
  return null;
}

export function useMe() {
  const { isSignedIn } = useAuth();
  return useQuery({
    queryKey: qk.me,
    queryFn: () => api.get<Me>('/me'),
    enabled: !!isSignedIn,
    staleTime: 60_000,
  });
}

/** True when the signed-in user has at least `role`. */
export function useHasRole(role: Role): boolean {
  const { data } = useMe();
  return hasRole(data?.role, role);
}
