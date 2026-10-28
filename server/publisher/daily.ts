import { logActivity, SYSTEM_ACTOR } from '../db/activity.js';
import { unwrap } from '../db/helpers.js';
import { db } from '../db/supabase.js';
import { googleErrorMessage } from '../google/client.js';
import { syncConnection } from '../google/sync.js';
import { checkAllStock } from '../images/library.js';
import { sendDigestIfDue } from '../notify/email.js';

export interface DailySummary {
  stockChanges: number;
  synced: string[];
  syncFailures: { email: string; error: string }[];
  skippedSyncs: number;
  digest: { sent: boolean; count: number };
}

/**
 * Daily maintenance: library stock check, hourly-limited email digest, and a rolling sync of
 * Google accounts (least recently synced first) inside the time budget.
 */
export async function runDaily(timeBudgetMs = 45_000): Promise<DailySummary> {
  const started = Date.now();
  const summary: DailySummary = { stockChanges: 0, synced: [], syncFailures: [], skippedSyncs: 0, digest: { sent: false, count: 0 } };
  summary.stockChanges = await checkAllStock();

  const conns = unwrap(
    await db()
      .from('google_connections')
      .select('id, email')
      .eq('status', 'active')
      .order('last_synced_at', { ascending: true, nullsFirst: true }),
    'Load connections',
  );
  for (const [i, c] of conns.entries()) {
    if (Date.now() - started > timeBudgetMs - 15_000) {
      summary.skippedSyncs = conns.length - i;
      break;
    }
    try {
      await syncConnection(c.id, SYSTEM_ACTOR);
      summary.synced.push(c.email);
    } catch (err) {
      summary.syncFailures.push({ email: c.email, error: googleErrorMessage(err) });
    }
  }
  summary.digest = await sendDigestIfDue();
  await logActivity({
    actor: SYSTEM_ACTOR,
    action: 'maintenance.daily',
    entityType: 'system',
    details: {
      stockChanges: summary.stockChanges,
      synced: summary.synced.length,
      syncFailures: summary.syncFailures.length,
      skippedSyncs: summary.skippedSyncs,
      digestSent: summary.digest.sent,
    },
  });
  return summary;
}
