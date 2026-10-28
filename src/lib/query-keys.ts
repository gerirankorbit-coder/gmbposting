export const qk = {
  me: ['me'] as const,
  health: ['health'] as const,
  connections: ['connections'] as const,
  clients: ['clients'] as const,
  client: (id: string) => ['clients', id] as const,
  locations: (params: object) => ['locations', 'list', params] as const,
  locationsAll: ['locations'] as const,
  locationOptions: ['locations', 'options'] as const,
  location: (id: string) => ['locations', 'detail', id] as const,
  locationPosts: (id: string, page: number) => ['locations', 'posts', id, page] as const,
};
