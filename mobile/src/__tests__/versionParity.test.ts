import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// AC-08: Qualidade, Zero Regressões e No-God-Files < 500L
describe('Version Parity & Release Integrity — APK 0.1.24', () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const rootMobile = path.resolve(__dirname, '../..');
  const appJsonPath = path.join(rootMobile, 'app.json');
  const pkgJsonPath = path.join(rootMobile, 'package.json');
  const buildGradlePath = path.join(rootMobile, 'android/app/build.gradle');

  it('mobile/app.json possui version 0.1.24 e versionCode 24', () => {
    const raw = fs.readFileSync(appJsonPath, 'utf8');
    const parsed = JSON.parse(raw);
    assert.strictEqual(parsed.expo.version, '0.1.24');
    assert.strictEqual(parsed.expo.android.versionCode, 24);
  });

  it('mobile/package.json possui version 0.1.24', () => {
    const raw = fs.readFileSync(pkgJsonPath, 'utf8');
    const parsed = JSON.parse(raw);
    assert.strictEqual(parsed.version, '0.1.24');
  });

  it('mobile/android/app/build.gradle possui versionName 0.1.24 e versionCode 24', () => {
    const raw = fs.readFileSync(buildGradlePath, 'utf8');
    assert.ok(raw.includes('versionCode 24'), 'build.gradle deve conter versionCode 24');
    assert.ok(raw.includes('versionName "0.1.24"'), 'build.gradle deve conter versionName "0.1.24"');
  });
});
