// Expo'nun standart ESLint preset'i. Yeni kodda en azından syntax error /
// undefined import / no-unused-vars yakalanır. Mevcut kodu yormamak için
// style kuralları default'ta kalır; sıkılaştırmak istenirse rules altına
// override ekle (örn. '@typescript-eslint/no-explicit-any': 'warn').
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
  ],
  rules: {
    // Generated Supabase types ve auto-import path'leri grupluyor; sıkı
    // import-order yorucu olur. İhtiyaca göre 'warn'a çevrilebilir.
    'import/order': 'off',
  },
};
