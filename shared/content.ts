/** Content checks shared by compose, import validation and AI output sanitising. */

const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|co|us|uk|pk|ca|au|biz|info|shop|store|online|site|app)\b(?:\/\S*)?/i;
const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
// 7+ digits allowing spaces, dots, dashes, parentheses and a leading +.
const PHONE_RE = /(?:\+?\d[\s().-]*){7,}\d/;

export interface ContentIssues {
  url: boolean;
  email: boolean;
  phone: boolean;
}

export function findContentIssues(text: string): ContentIssues {
  const email = EMAIL_RE.test(text);
  const withoutEmails = text.replace(new RegExp(EMAIL_RE.source, 'g'), ' ');
  return {
    email,
    url: URL_RE.test(withoutEmails),
    phone: PHONE_RE.test(text),
  };
}

export function contentWarnings(text: string): string[] {
  const issues = findContentIssues(text);
  const out: string[] = [];
  if (issues.phone) out.push('Contains a phone number; Google often rejects posts with phone numbers.');
  if (issues.email) out.push('Contains an email address; Google often rejects posts with email addresses.');
  if (issues.url) out.push('Contains a link; use the CTA button for links instead.');
  return out;
}

/** Normalises text for duplicate detection. */
export function contentFingerprint(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/** Trims to `max` characters, preferring a sentence or word boundary. */
export function truncateText(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const sentence = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (sentence > max * 0.6) return cut.slice(0, sentence + 1).trim();
  const space = cut.lastIndexOf(' ');
  return (space > max * 0.6 ? cut.slice(0, space) : cut).trim();
}
