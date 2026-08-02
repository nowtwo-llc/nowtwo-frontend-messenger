import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

export default tseslint.config(
    {
        ignores: ['build/', 'dist/', 'coverage/', 'node_modules/', 'eslint-report.html']
    },

    js.configs.recommended,
    tseslint.configs.recommended,
    tseslint.configs.recommendedTypeChecked,

    {
        languageOptions: {
            parserOptions: {
                project: ['./tsconfig.json', './tsconfig.test.json'],
                tsconfigRootDir: import.meta.dirname
            },
            globals: globals.browser
        },
        rules: {
            '@typescript-eslint/ban-ts-comment': 'warn',
            '@typescript-eslint/no-explicit-any': 'off',
            // A leading underscore marks a parameter that exists to hold a
            // position in a signature — mock stubs mirroring a real API, mostly.
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
            ],
            '@typescript-eslint/restrict-plus-operands': 'error',
            'max-classes-per-file': ['error', 12],
            'no-param-reassign': 'warn',
            'no-underscore-dangle': 'off',
            'no-restricted-globals': 'warn'
        }
    },

    // Build/config scripts are plain CJS and are not covered by tsconfig.json,
    // so type-aware rules cannot run against them.
    {
        files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
        extends: [tseslint.configs.disableTypeChecked],
        languageOptions: {
            globals: { ...globals.node }
        },
        rules: {
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/no-require-imports': 'off'
        }
    },

    {
        files: ['tests/**/*.ts'],
        rules: {
            // Mocks are passed around as bare references (`vi.mocked(events.connect)`)
            // and assertion helpers return `any` by design, so the type-aware
            // rules that guard production code only produce noise here.
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/unbound-method': 'off'
        }
    },

    // The demo page loads the UMD bundle from a script tag, so the library
    // arrives as a browser global rather than an import.
    {
        files: ['example/**/*.js'],
        languageOptions: {
            globals: { ...globals.browser, FrontendMessenger: 'readonly' }
        }
    },

    prettierRecommended,
    {
        rules: {
            'prettier/prettier': 'warn'
        }
    }
);
