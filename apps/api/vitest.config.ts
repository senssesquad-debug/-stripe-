import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: { TZ: 'UTC', LOG_LEVEL: 'silent', NODE_ENV: 'test' },
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
