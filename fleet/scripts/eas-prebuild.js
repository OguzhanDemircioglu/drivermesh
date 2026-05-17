#!/usr/bin/env node
/**
 * EAS Build prebuildCommand wrapper.
 *
 * EAS prebuildCommand shell parse etmiyor (executable + args olarak ayırıyor),
 * bu yüzden `&&` chain çalışmıyor. Bu wrapper hem `expo prebuild`'i hem de
 * `inject-fullscreen-splash.js`'i sırayla execute eder.
 *
 * Çağrılış: `node scripts/eas-prebuild.js`
 */
const { spawnSync } = require('child_process');
const path = require('path');

function run(cmd, args, opts = {}) {
  console.log(`\n[eas-prebuild] $ ${cmd} ${args.join(' ')}`);
  // shell: false — Linux'ta args concatenation/escape sorunlarını önler
  // (Windows lokal'de shell:true çalışıyor ama EAS Linux'ta args legacy
  // expo-cli'a düşüyor; doğrudan spawn ile node entry-point'i direkt çağır).
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: false, ...opts });
  if (r.status !== 0) {
    console.error(`[eas-prebuild] FAILED: ${cmd} ${args.join(' ')} → exit ${r.status}`);
    process.exit(r.status ?? 1);
  }
}

// 1) Expo prebuild — android/ klasörünü generate eder.
// `npx expo prebuild --platform android` EAS worker'da legacy expo-cli'a
// düşüyor → `unknown option: --platform`. Doğru yol: `node_modules/expo/bin/cli`
// (expo package'in `bin.expo` entry'si — `require('@expo/cli')` shortcut).
run('node', [
  path.join(__dirname, '..', 'node_modules', 'expo', 'bin', 'cli'),
  'prebuild',
  '--platform', 'android',
  '--no-install',
]);

// 2) Inject fullscreen splash — Theme.App.SplashScreen + layer-list drawable override
run('node', [path.join(__dirname, 'inject-fullscreen-splash.js')]);

console.log('[eas-prebuild] done');
