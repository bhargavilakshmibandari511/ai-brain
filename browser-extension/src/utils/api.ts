const API_BASE = 'http://localhost:8000';

export async function apiPost(endpoint: string, body: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `API error ${res.status}`);
  }
  return res.json();
}

export async function apiGet(endpoint: string) {
  const res = await fetch(`${API_BASE}${endpoint}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `API error ${res.status}`);
  }
  return res.json();
}

export function apiStreamUrl(endpoint: string) {
  return `${API_BASE}${endpoint}`;
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export function getPageContent(): Promise<PageContent> {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'GET_PAGE_CONTENT' }, (response) => {
        resolve(response || { error: 'No response' });
      });
    } else {
      resolve({ error: 'Not in extension context' });
    }
  });
}

export interface PageContent {
  title?: string;
  url?: string;
  text?: string;
  selectedText?: string;
  isYouTube?: boolean;
  metaDescription?: string;
  error?: string;
}
