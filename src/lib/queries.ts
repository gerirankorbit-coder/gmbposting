import { useQuery } from '@tanstack/react-query';
import type { ClientDTO, ConnectionDTO, LocationDTO } from '../../shared/types';
import { api } from './api';
import { qk } from './query-keys';

export function useConnections() {
  return useQuery({ queryKey: qk.connections, queryFn: () => api.get<ConnectionDTO[]>('/connections') });
}

export function useClients() {
  return useQuery({ queryKey: qk.clients, queryFn: () => api.get<ClientDTO[]>('/clients') });
}

export function useLocationOptions() {
  return useQuery({
    queryKey: qk.locationOptions,
    queryFn: () => api.get<LocationDTO[]>('/locations/options'),
    staleTime: 60_000,
  });
}
