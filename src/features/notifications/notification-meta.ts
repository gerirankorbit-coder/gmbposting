import { AlertTriangle, CheckCircle2, FileSpreadsheet, ImageMinus, ImageOff, ImagePlus, Link2Off, XCircle } from 'lucide-react';
import type { NotificationType } from '../../../shared/types';

export const NOTIFICATION_META: Record<NotificationType, { label: string; icon: typeof AlertTriangle; tone: string }> = {
  library_low: { label: 'Library low', icon: ImageMinus, tone: 'bg-amber-50 text-amber-600' },
  library_empty: { label: 'Library empty', icon: ImageOff, tone: 'bg-rose-50 text-rose-600' },
  library_refilled: { label: 'Library refilled', icon: ImagePlus, tone: 'bg-emerald-50 text-emerald-600' },
  connection_needs_reauth: { label: 'Reconnect needed', icon: Link2Off, tone: 'bg-amber-50 text-amber-600' },
  post_failed: { label: 'Post failed', icon: XCircle, tone: 'bg-rose-50 text-rose-600' },
  import_ready: { label: 'Import ready', icon: FileSpreadsheet, tone: 'bg-violet-50 text-violet-600' },
  import_committed: { label: 'Import committed', icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600' },
};
