import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Degen Tracker',
  slug: config.slug ?? 'degen-tracker',
  experiments: {
    ...config.experiments,
    baseUrl: process.env.DEGEN_WEB_BASE_PATH ?? '',
  },
});
