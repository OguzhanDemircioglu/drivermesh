/**
 * Custom Expo config plugin — Android'de full-bleed splash image.
 *
 * Android 12+ Splash API logo-centric. Bu plugin Expo prebuild'in oluşturduğu
 * `Theme.App.SplashScreen` stilini tamamen overwrite ederek `windowBackground`
 * stratejisine çevirir. Sonuçta hem Android <12 hem Android 12+ telefonlarda
 * splash drawable'ı tam ekran image olur (gravity="fill" → aspect bozulup
 * ekrana yayılır).
 *
 * withDangerousMod kullanılır çünkü Expo'nun expo-splash-screen plugin'i
 * styles.xml'i sonradan tekrar override edebiliyor; dosya-tabanlı son söz
 * söyleme garantilidir.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const FULL_SPLASH_DRAWABLE = 'drivermesh_full_splash';
const SPLASH_LAYER = 'drivermesh_splash_layer';

function copyImageAcrossDensities(projectRoot, sourceImagePath) {
  const src = path.resolve(projectRoot, sourceImagePath);
  if (!fs.existsSync(src)) {
    throw new Error(`[with-fullscreen-splash] Image not found: ${src}`);
  }
  const resDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');
  const densities = [
    'drawable',
    'drawable-mdpi',
    'drawable-hdpi',
    'drawable-xhdpi',
    'drawable-xxhdpi',
    'drawable-xxxhdpi',
  ];
  for (const dir of densities) {
    const target = path.join(resDir, dir);
    if (!fs.existsSync(target)) continue;
    fs.copyFileSync(src, path.join(target, `${FULL_SPLASH_DRAWABLE}.png`));
  }
  // Base drawable garanti
  const baseDir = path.join(resDir, 'drawable');
  if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
  fs.copyFileSync(src, path.join(baseDir, `${FULL_SPLASH_DRAWABLE}.png`));
}

function writeLayerDrawable(projectRoot, backgroundColor) {
  const resDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'drawable');
  if (!fs.existsSync(resDir)) fs.mkdirSync(resDir, { recursive: true });
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
  <item>
    <shape android:shape="rectangle">
      <solid android:color="${backgroundColor}" />
    </shape>
  </item>
  <item>
    <bitmap
      android:gravity="fill"
      android:src="@drawable/${FULL_SPLASH_DRAWABLE}" />
  </item>
</layer-list>
`;
  fs.writeFileSync(path.join(resDir, `${SPLASH_LAYER}.xml`), xml);
}

function overwriteStylesXml(projectRoot) {
  const stylesPath = path.join(
    projectRoot,
    'android',
    'app',
    'src',
    'main',
    'res',
    'values',
    'styles.xml',
  );
  if (!fs.existsSync(stylesPath)) return;
  let xml = fs.readFileSync(stylesPath, 'utf8');

  const replacement = `<style name="Theme.App.SplashScreen" parent="Theme.SplashScreen">
    <item name="android:windowBackground">@drawable/${SPLASH_LAYER}</item>
    <item name="windowSplashScreenBackground">@android:color/transparent</item>
    <item name="windowSplashScreenAnimatedIcon">@drawable/${SPLASH_LAYER}</item>
    <item name="android:windowSplashScreenBehavior" tools:targetApi="33">icon_preferred</item>
    <item name="postSplashScreenTheme">@style/AppTheme</item>
  </style>`;

  xml = xml.replace(
    /<style\s+name="Theme\.App\.SplashScreen"[\s\S]*?<\/style>/,
    replacement,
  );

  fs.writeFileSync(stylesPath, xml);
}

function clearV31StylesIfPresent(projectRoot) {
  // values-v31/styles.xml Android 12+'da preferans; silersek values/ default
  // davranışı her sürümde aktif olur.
  const v31Path = path.join(
    projectRoot,
    'android',
    'app',
    'src',
    'main',
    'res',
    'values-v31',
    'styles.xml',
  );
  if (fs.existsSync(v31Path)) fs.rmSync(v31Path);
}

module.exports = function withFullscreenSplash(config, props = {}) {
  const sourceImage = props.image ?? './assets/drivermesh-splash.png';
  const backgroundColor = props.backgroundColor ?? '#0A0E1F';
  console.log('[fullscreen-splash] plugin invoked');

  return withDangerousMod(config, [
    'android',
    async (modConfig) => {
      console.log('[fullscreen-splash] dangerousMod running');
      const projectRoot = modConfig.modRequest.projectRoot;
      copyImageAcrossDensities(projectRoot, sourceImage);
      writeLayerDrawable(projectRoot, backgroundColor);
      overwriteStylesXml(projectRoot);
      clearV31StylesIfPresent(projectRoot);
      console.log('[fullscreen-splash] done');
      return modConfig;
    },
  ]);
};
