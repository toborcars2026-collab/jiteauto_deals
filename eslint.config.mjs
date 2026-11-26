import { flatRecommended } from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'backups/**', 'android/**', 'public/**'],
  },
  flatRecommended,
];
