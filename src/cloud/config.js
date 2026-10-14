const project = require('./project.public.json');

/**
 * @param {string} [url]
 * @param {string} [key]
 * @returns {{url: string, publishableKey: string} | null}
 */
function validateCloudConfig(url, key) {
  if (!url && !key) return null;
  if (!url || !key) throw new Error('Set both public Supabase configuration variables.');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash ||
      !['', '/'].includes(parsed.pathname)) throw new Error('Use the HTTPS Supabase project URL, without credentials or extra paths.');
  if (!key.startsWith('sb_publishable_')) {
    try {
      const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.role !== 'anon') throw new Error('Not a public key');
    } catch { throw new Error('Use a Supabase publishable key or legacy anon key. Secret and service-role keys must never be bundled.'); }
  }
  return { url: parsed.origin, publishableKey: key };
}

/**
 * @param {string} [url]
 * @param {string} [key]
 * @returns {{url: string, publishableKey: string}}
 */
function projectConfig(url, key) {
  const config = url || key ? validateCloudConfig(url, key) : validateCloudConfig(project.url, project.publishableKey);
  if (!config) throw new Error('Cloud configuration unavailable.');
  return config;
}
module.exports = { validateCloudConfig, projectConfig };
