/**
 * Minimal element factory for satori (which accepts React-element-shaped objects). Using plain
 * objects instead of JSX keeps the serverless bundle free of a JSX transform.
 */
export type Style = Record<string, string | number>;
export interface SatoriNode {
  type: string;
  props: { style?: Style; children?: SatoriChild | SatoriChild[]; src?: string; width?: number; height?: number };
  key?: null;
}
export type SatoriChild = SatoriNode | string | null | false | undefined;

export function h(type: string, style: Style, ...children: SatoriChild[]): SatoriNode {
  const kids = children.filter((c): c is SatoriNode | string => c !== null && c !== undefined && c !== false);
  return { type, key: null, props: { style, children: kids.length === 1 ? kids[0] : kids } };
}

export function img(src: string, style: Style, width: number, height: number): SatoriNode {
  return { type: 'img', key: null, props: { src, style, width, height } };
}

export interface TemplateInput {
  headline: string;
  businessName: string;
  city: string | null;
  tagline: string | null;
  logo: string | null; // data URI
  primary: string;
  secondary: string;
  text: string;
  /** Rotates gradient angles, shape positions and colour order between posts. */
  variant: number;
  topicLabel: string | null; // e.g. "Offer", "Event"
}

export const WIDTH = 1200;
export const HEIGHT = 900;

export function headlineSize(text: string, base: number): number {
  const len = text.length;
  if (len > 60) return Math.round(base * 0.7);
  if (len > 42) return Math.round(base * 0.82);
  return base;
}

export function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'B';
}
