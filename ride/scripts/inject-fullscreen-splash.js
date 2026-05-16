/**
 * Post-prebuild script — Android'in splash drawable + styles.xml dosyalarını
 * "full-bleed image" yapacak şekilde override eder.
 *
 * Expo prebuild'in expo-splash-screen plugin'i logo-centric template kurar
 * (Android 12+ Splash API'sine uygun). Bu davranış istenirse iyi; biz tam
 * ekran image istiyoruz, plugin'in mod chain'inde override etmek yarış
 * koşulu yaratıyor. Bu script prebuild'den **sonra** çalıştırılır ve son
 * sözü söyler.
 *
 * Çalıştır:
 *   node scripts/inject-fullscreen-splash.js
 *
 * package.json'a "prebuild:android" gibi bir wrapper script eklenebilir.
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SOURCE_IMAGE = path.join(PROJECT_ROOT, 'assets', 'drivermesh-splash.png');
const BG_COLOR = '#0A0E1F';
const SPLASH_DRAWABLE = 'drivermesh_full_splash';
const SPLASH_LAYER = 'drivermesh_splash_layer';

const ANDROID_RES = path.join(PROJECT_ROOT, 'android', 'app', 'src', 'main', 'res');

function copyImageAcrossDensities() {
  if (!fs.existsSync(SOURCE_IMAGE)) {
    throw new Error(`[inject-splash] Source image not found: ${SOURCE_IMAGE}`);
  }
  const densities = [
    'drawable',
    'drawable-mdpi',
    'drawable-hdpi',
    'drawable-xhdpi',
    'drawable-xxhdpi',
    'drawable-xxxhdpi',
  ];
  for (const dir of densities) {
    const target = path.join(ANDROID_RES, dir);
    if (!fs.existsSync(target)) continue;
    fs.copyFileSync(SOURCE_IMAGE, path.join(target, `${SPLASH_DRAWABLE}.png`));
  }
  const baseDir = path.join(ANDROID_RES, 'drawable');
  if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
  fs.copyFileSync(SOURCE_IMAGE, path.join(baseDir, `${SPLASH_DRAWABLE}.png`));
  console.log('[inject-splash] image copied to drawable densities');
}

function writeLayerDrawable() {
  const drawableDir = path.join(ANDROID_RES, 'drawable');
  if (!fs.existsSync(drawableDir)) fs.mkdirSync(drawableDir, { recursive: true });
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
  <item>
    <shape android:shape="rectangle">
      <solid android:color="${BG_COLOR}" />
    </shape>
  </item>
  <item>
    <bitmap
      android:gravity="fill"
      android:src="@drawable/${SPLASH_DRAWABLE}" />
  </item>
</layer-list>
`;
  fs.writeFileSync(path.join(drawableDir, `${SPLASH_LAYER}.xml`), xml);
  console.log(`[inject-splash] ${SPLASH_LAYER}.xml written`);
}

function overwriteStylesXml() {
  const stylesPath = path.join(ANDROID_RES, 'values', 'styles.xml');
  if (!fs.existsSync(stylesPath)) {
    throw new Error(`[inject-splash] styles.xml not found: ${stylesPath}`);
  }
  let xml = fs.readFileSync(stylesPath, 'utf8');

  const replacement = `<style name="Theme.App.SplashScreen" parent="Theme.SplashScreen">
    <item name="android:windowBackground">@drawable/${SPLASH_LAYER}</item>
    <item name="windowSplashScreenBackground">@android:color/transparent</item>
    <item name="windowSplashScreenAnimatedIcon">@drawable/${SPLASH_LAYER}</item>
    <item name="android:windowSplashScreenBehavior" tools:targetApi="33">icon_preferred</item>
    <item name="postSplashScreenTheme">@style/AppTheme</item>
  </style>`;

  const before = xml;
  xml = xml.replace(/<style\s+name="Theme\.App\.SplashScreen"[\s\S]*?<\/style>/, replacement);
  if (xml === before) {
    console.warn('[inject-splash] WARN: Theme.App.SplashScreen not found in styles.xml');
    return;
  }

  fs.writeFileSync(stylesPath, xml);
  console.log('[inject-splash] styles.xml overwritten');
}

function clearV31Styles() {
  const v31Path = path.join(ANDROID_RES, 'values-v31', 'styles.xml');
  if (fs.existsSync(v31Path)) {
    fs.rmSync(v31Path);
    console.log('[inject-splash] values-v31/styles.xml removed');
  }
}

function main() {
  console.log('[inject-splash] starting');
  copyImageAcrossDensities();
  writeLayerDrawable();
  overwriteStylesXml();
  clearV31Styles();
  console.log('[inject-splash] done');
}

main();
