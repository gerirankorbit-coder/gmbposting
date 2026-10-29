/**
 * Posting rules shared by the API, the publisher, imports and the compose screen: a location only
 * takes posts when it is switched on, belongs to an active client and Google says it can.
 */
export interface PostableLocation {
  title: string;
  is_active: boolean;
  google_verified: boolean | null;
  client: { name: string; is_active: boolean } | null;
}

export type PostingBlock = 'location_off' | 'no_client' | 'client_inactive' | 'unverified';

export function postingBlock(l: PostableLocation): PostingBlock | null {
  if (!l.is_active) return 'location_off';
  if (!l.client) return 'no_client';
  if (!l.client.is_active) return 'client_inactive';
  if (l.google_verified === false) return 'unverified';
  return null;
}

export function postingBlockMessage(l: PostableLocation, block: PostingBlock): string {
  switch (block) {
    case 'location_off':
      return `${l.title} is switched off in OrbitPost. Turn it on on the Locations page.`;
    case 'no_client':
      return `${l.title} is not assigned to a client. Assign it to an active client first.`;
    case 'client_inactive':
      return `${l.client?.name ?? 'Its client'} is an inactive client. Activate the client to post for ${l.title}.`;
    case 'unverified':
      return `${l.title} is not verified on Google (or is suspended or pending verification), so Google does not accept posts for it yet.`;
  }
}

/** The reason a location cannot post right now, or null when it can. */
export function postingBlockReason(l: PostableLocation): string | null {
  const block = postingBlock(l);
  return block ? postingBlockMessage(l, block) : null;
}
