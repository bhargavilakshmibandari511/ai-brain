/**
 * Utility to get the current deployment mode (online/offline)
 */
export function getCurrentMode(): 'online' | 'offline' {
  try {
    const stored = localStorage.getItem('ai_settings');
    if (stored) {
      const settings = JSON.parse(stored);
      if (settings.mode === 'online') return 'online';
    }
  } catch (e) {
    console.warn('Could not read mode from localStorage:', e);
  }
  return 'offline'; // Default to offline
}

/**
 * Get the API key for online mode
 */
export function getApiKey(): string {
  try {
    const stored = localStorage.getItem('ai_settings');
    if (stored) {
      const settings = JSON.parse(stored);
      return settings.api_key || '';
    }
  } catch (e) {
    console.warn('Could not read API key from localStorage:', e);
  }
  return '';
}
