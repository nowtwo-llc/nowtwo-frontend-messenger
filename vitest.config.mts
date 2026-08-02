import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // The library is a thin wrapper over Amplify's Events client, which is
        // mocked in every test. jsdom is here for the `document`-dispatched
        // lifecycle events, not for layout or rendering.
        environment: 'jsdom',
        globals: true,
        include: ['tests/**/*.spec.ts'],
        restoreMocks: true,
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            reporter: ['text', 'lcov'],
            // The library is one small file with no untestable corners, so
            // anything less than full statement coverage is a gap, not a
            // trade-off. Branches sit below 100 only because a couple of
            // defensive `??` fallbacks cannot be reached through the public API.
            thresholds: {
                statements: 100,
                functions: 100,
                lines: 100,
                branches: 90
            }
        }
    }
});
