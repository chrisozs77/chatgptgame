export type AccountIdentity = { id: string; email?: string };

// This identifies a local cache only. It never authorizes cloud requests.
export function cachedIdentity(raw: string | null): AccountIdentity | null {
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw);
    if (typeof saved.access_token !== 'string' || typeof saved.refresh_token !== 'string' ||
      typeof saved.expires_at !== 'number' || !saved.user ||
      typeof saved.user.id !== 'string' || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(saved.user.id)) return null;
    return { id: saved.user.id, email: typeof saved.user.email === 'string' ? saved.user.email : undefined };
  } catch { return null; }
}
