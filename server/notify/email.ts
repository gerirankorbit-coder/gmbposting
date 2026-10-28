import type { NotificationType } from '../../shared/types.js';
import { unwrap } from '../db/helpers.js';
import { getSettingValue, setSettingValue } from '../db/settings.js';
import { db } from '../db/supabase.js';
import { env, optionalEnv } from '../lib/env.js';

export const EMAIL_TYPES: NotificationType[] = ['library_low', 'library_empty', 'connection_needs_reauth', 'post_failed'];
const DIGEST_INTERVAL_MS = 60 * 60 * 1000;

function emailConfig() {
  const apiKey = optionalEnv('RESEND_API_KEY');
  const from = optionalEnv('NOTIFY_FROM_EMAIL');
  const to = (optionalEnv('NOTIFY_TO_EMAILS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return apiKey && from && to.length ? { apiKey, from, to } : null;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Sends one digest email with every un-emailed important notification, at most once per hour.
 * No-op when Resend is not configured. Never throws.
 */
export async function sendDigestIfDue(force = false): Promise<{ sent: boolean; count: number }> {
  const cfg = emailConfig();
  if (!cfg) return { sent: false, count: 0 };
  try {
    const last = await getSettingValue('last_digest_email_at');
    if (!force && typeof last === 'string' && Date.now() - new Date(last).getTime() < DIGEST_INTERVAL_MS) {
      return { sent: false, count: 0 };
    }
    const pending = unwrap(
      await db()
        .from('notifications')
        .select('id, type, title, body, link, created_at')
        .is('emailed_at', null)
        .in('type', EMAIL_TYPES)
        .order('created_at', { ascending: true })
        .limit(100),
      'Load notifications for email',
    );
    if (!pending.length) return { sent: false, count: 0 };

    const items = pending
      .map(
        (n) => `<tr><td style="padding:14px 0;border-bottom:1px solid #EDE4FF">
          <div style="font-weight:700;color:#0B0B14">${escapeHtml(n.title)}</div>
          ${n.body ? `<div style="color:#3F3F52;margin-top:4px">${escapeHtml(n.body)}</div>` : ''}
          ${n.link ? `<a href="${env.appUrl}${n.link}" style="color:#8B2CF5;font-weight:600;font-size:13px">Open in OrbitPost →</a>` : ''}
        </td></tr>`,
      )
      .join('');
    const html = `<div style="font-family:Arial,sans-serif;background:#F8F5FF;padding:24px">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:20px;padding:28px">
        <div style="height:6px;border-radius:6px;background:linear-gradient(90deg,#7C3AED,#A21CAF,#D946EF);margin-bottom:20px"></div>
        <h1 style="margin:0 0 6px;font-size:20px;color:#0B0B14">OrbitPost needs your attention</h1>
        <p style="margin:0 0 12px;color:#6B6B80">${pending.length} alert${pending.length === 1 ? '' : 's'} since the last summary.</p>
        <table style="width:100%;border-collapse:collapse">${items}</table>
      </div></div>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: cfg.from,
        to: cfg.to,
        subject: `OrbitPost: ${pending.length} alert${pending.length === 1 ? '' : 's'} – ${pending[0]!.title}`,
        html,
      }),
    });
    if (!res.ok) {
      console.error('[email] Resend rejected the digest', res.status, (await res.text()).slice(0, 300));
      return { sent: false, count: 0 };
    }
    const now = new Date().toISOString();
    await db().from('notifications').update({ emailed_at: now }).in('id', pending.map((n) => n.id));
    await setSettingValue('last_digest_email_at', now);
    return { sent: true, count: pending.length };
  } catch (err) {
    console.error('[email] digest failed', err instanceof Error ? err.message : err);
    return { sent: false, count: 0 };
  }
}
