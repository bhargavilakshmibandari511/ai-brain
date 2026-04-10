const STORAGE_KEYS = {
  API_URL: 'ai_brain_api_url',
  USER: 'ai_brain_user',
  SETTINGS: 'ai_brain_settings',
} as const;

export interface Settings {
  apiUrl: string;
  temperature: number;
  maxTokens: number;
  defaultModel: string;
}

const DEFAULT_SETTINGS: Settings = {
  apiUrl: 'http://localhost:8000',
  temperature: 0.7,
  maxTokens: 512,
  defaultModel: 'tinyllama',
};

export async function getSettings(): Promise<Settings> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEYS.SETTINGS, (result) => {
        resolve(result[STORAGE_KEYS.SETTINGS] || DEFAULT_SETTINGS);
      });
    });
  }
  const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
  return stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
}

export async function saveSettings(settings: Settings): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings }, resolve);
    });
  }
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

export async function getUser(): Promise<{ id: string; username: string } | null> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEYS.USER, (result) => {
        resolve(result[STORAGE_KEYS.USER] || null);
      });
    });
  }
  const stored = localStorage.getItem('user');
  return stored ? JSON.parse(stored) : null;
}

export async function saveUser(user: { id: string; username: string }): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEYS.USER]: user }, resolve);
    });
  }
  localStorage.setItem('user', JSON.stringify(user));
}

export async function getPendingAction(): Promise<{ type: string; text: string; pageUrl: string } | null> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get('pendingAction', (result) => {
        if (result.pendingAction) {
          chrome.storage.local.remove('pendingAction');
          resolve(result.pendingAction);
        } else {
          resolve(null);
        }
      });
    });
  }
  return null;
}
