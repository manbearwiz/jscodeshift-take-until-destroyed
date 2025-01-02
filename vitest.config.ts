import type { UserConfig } from 'vitest/config';

export default {
  test: {
    environment: 'happy-dom',
    globals: true,
    coverage: {
      exclude: ['./*.config.{js,ts,mts}', 'dist'],
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
  },
} satisfies UserConfig;
