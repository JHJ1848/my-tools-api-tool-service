module.exports = {
  root: true,
  env: { es2022: true, node: true, browser: true },
  extends: ['eslint:recommended'],
  parserOptions: { sourceType: 'module' },
  ignorePatterns: ['dist/', 'dist-app/', 'dist-electron/', 'release/', 'logs/', 'tmp/', 'test-results/'],
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      parser: '@typescript-eslint/parser',
      rules: {
        'no-undef': 'off',
        'no-unused-vars': 'off'
      }
    }
  ]
}
