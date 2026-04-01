function normalizePrefix(prefix: string | null | undefined): string {
  return (prefix ?? '').trim().replace(/\/$/, '');
}

export function getHtreePrefix(): string {
  if (typeof window === 'undefined') return '';
  const candidate = (window as Window & { htree?: { htreeBaseUrl?: string } }).htree?.htreeBaseUrl;
  return normalizePrefix(candidate);
}

export function toHttpHtreeUrl(input: string): string {
  const trimmed = input.trim();
  const prefix = getHtreePrefix();

  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/htree/')) return `${prefix}${trimmed}`;
  if (trimmed.startsWith('htree://')) {
    const withoutScheme = trimmed.slice('htree://'.length);
    return `${prefix}/htree/${withoutScheme}`;
  }
  if (trimmed.startsWith('nhash1')) {
    return `${prefix}/htree/${trimmed}`;
  }

  return trimmed;
}

declare global {
  interface Window {
    htree?: {
      htreeBaseUrl?: string;
    };
  }
}
