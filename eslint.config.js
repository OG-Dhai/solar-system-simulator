import js from '@eslint/js';
import globals from 'globals';

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node
            }
        },
        rules: {
            'no-console': 'off',  // Allow console usage for debugging in this project
            'no-unused-vars': 'warn',
            'no-undef': 'error',
            'semi': ['error', 'always'],
            'quotes': ['error', 'single'],
            'indent': ['error', 4],
            'comma-dangle': ['error', 'never'],
            'eol-last': ['error', 'always'],
            'no-multiple-empty-lines': ['error', { max: 1 }],
            'prefer-const': 'error',
            'no-var': 'error'
        }
    }
];