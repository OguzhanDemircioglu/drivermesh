// Fleet'in eşi — bkz fleet/.eslintrc.js. İki app aynı kuralları paylaşır.
module.exports = {
  root: true,
  extends: ['expo'],
  ignorePatterns: [
    'node_modules/',
    'android/',
    'ios/',
    '.expo/',
    'dist/',
    'build/',
    'src/lib/database.types.ts',
    'scripts/',
    'plugins/',
  ],
  rules: {
    'import/order': 'off',
  },
};
