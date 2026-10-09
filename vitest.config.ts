import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: ['tests/**/*.test.ts'],
      // DOM이 필요한 테스트 파일만 `// @vitest-environment happy-dom`으로 바꾼다.
      environment: 'node',
      unstubGlobals: true,
      unstubEnvs: true,
      restoreMocks: true,
    },
  }),
);
