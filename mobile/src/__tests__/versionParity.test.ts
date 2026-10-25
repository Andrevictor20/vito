import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Version Parity & Release Integrity — APK 0.1.20', () => {
  const rootMobile = path.resolve(__dirname, '../..');
  const appJsonPath = path.join(rootMobile, 'app.json');
  const pkgJsonPath = path.join(rootMobile, 'package.json');
  const buildGradlePath = path.join(rootMobile, 'android/app/build.gradle');

  it('mobile/app.json possui version 0.1.20 e versionCode 20', () => {
    const raw = fs.readFileSync(appJsonPath, 'utf8');
    const parsed = JSON.parse(raw);
    assert.strictEqual(parsed.expo.version, '0.1.20');
    assert.strictEqual(parsed.expo.android.versionCode, 20);
  });

  it('mobile/package.json possui version 0.1.20', () => {
    const raw = fs.readFileSync(pkgJsonPath, 'utf8');
    const parsed = JSON.parse(raw);
    assert.strictEqual(parsed.version, '0.1.20');
  });

  it('mobile/android/app/build.gradle possui versionName 0.1.20 e versionCode 20', () => {
    const raw = fs.readFileSync(buildGradlePath, 'utf8');
    assert.ok(raw.includes('versionCode 20'), 'build.gradle deve conter versionCode 20');
    assert.ok(raw.includes('versionName "0.1.20"'), 'build.gradle deve conter versionName "0.1.20"');
  });
});
