import type { ConfigContext, ExpoConfig } from 'expo/config';
import { projectConfig } from './src/cloud/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  // Reject privileged keys before Metro could embed them in a public bundle.
  projectConfig(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  return ({
  ...config,
  name: config.name ?? 'Degen Tracker',
  slug: config.slug ?? 'degen-tracker',
  experiments: {
    ...config.experiments,
    baseUrl: process.env.DEGEN_WEB_BASE_PATH ?? '',
  },
  });
};
