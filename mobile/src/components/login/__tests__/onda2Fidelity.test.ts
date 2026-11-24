import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEMO_TIMING } from '../demoMachine'
import {
  buildReelItems,
  REEL_DURATION_MS,
  REEL_LINE_EM,
  REEL_SETTLE_MS,
} from '../headlineReel'
import {
  ONBOARDING_DESC_DELAY_MS,
  ONBOARDING_DOT_MS,
  ONBOARDING_FADE_DELAY_MS,
  ONBOARDING_FADE_MS,
  ONBOARDING_FLOAT_MS,
  ONBOARDING_GLOW_FLOAT_MS,
  ONBOARDING_IN_DELAYS,
  ONBOARDING_IN_MS,
  ONBOARDING_LIVE_DELAY_MS,
  ONBOARDING_OUT_MS,
  ONBOARDING_OUT_SCALE,
  ONBOARDING_SKIP_FADE_MS,
  ONBOARDING_SWIPE_THRESHOLD,
  ONBOARDING_TEXT_MS,
  ONBOARDING_TITLE_DELAY_MS,
  ONBOARDING_TRACK_MS,
} from '../onboardingMotion'
import {
  SPLASH_BAR_FILL_RATIO,
  SPLASH_BAR_HEIGHT,
  SPLASH_BAR_IN_DELAY_MS,
  SPLASH_BAR_LOOP_MS,
  SPLASH_BAR_WIDTH,
  SPLASH_IN_MS,
  SPLASH_MASCOT_SIZE,
  SPLASH_OUT_DELAY_MS,
  SPLASH_OUT_MS,
  SPLASH_OUT_SCALE,
  SPLASH_POP_MS,
  SPLASH_WORD_DELAY_MS,
  SPLASH_WORD_SIZE,
} from '../splashMotion'
import { DEMO_HEADLINES } from '../demoScenes'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const mobileSrc = path.resolve(__dirname, '../../..')

function read(rel: string): string {
  return fs.readFileSync(path.join(mobileSrc, rel), 'utf8')
}

describe('Onda 2 — Splash fiel a #vsplash', () => {
  it('timings exatos de splPop, splIn, splBar e splOut', () => {
    assert.equal(SPLASH_POP_MS, 700)
    assert.equal(SPLASH_IN_MS, 800)
    assert.equal(SPLASH_WORD_DELAY_MS, 0)
    assert.equal(SPLASH_BAR_IN_DELAY_MS, 100)
    assert.equal(SPLASH_BAR_LOOP_MS, 900)
    assert.equal(SPLASH_OUT_DELAY_MS, 2000)
    assert.equal(SPLASH_OUT_MS, 550)
    assert.equal(SPLASH_OUT_SCALE, 1.05)
  })

  it('dimensoes do wordmark e da barra batem com o CSS', () => {
    assert.equal(SPLASH_MASCOT_SIZE, 140)
    assert.equal(SPLASH_WORD_SIZE, 46)
    assert.equal(SPLASH_BAR_WIDTH, 46)
    assert.equal(SPLASH_BAR_HEIGHT, 3)
    assert.equal(SPLASH_BAR_FILL_RATIO, 0.5)
  })

  it('SplashScreen usa as constantes e o rig canonico', () => {
    const src = read('screens/SplashScreen.tsx')
    assert.ok(src.includes('SPLASH_POP_MS'))
    assert.ok(src.includes('SPLASH_OUT_DELAY_MS'))
    assert.ok(src.includes('MascotVectorRig'))
    assert.ok(!src.includes('LoginMascotRig'))
  })
})

describe('Onda 2 — Onboarding fiel a #vonb', () => {
  it('timings exatos de track, entrada, saida e live', () => {
    assert.equal(ONBOARDING_TRACK_MS, 550)
    assert.equal(ONBOARDING_LIVE_DELAY_MS, 1900)
    assert.equal(ONBOARDING_OUT_MS, 400)
    assert.equal(ONBOARDING_OUT_SCALE, 1.04)
    assert.equal(ONBOARDING_SKIP_FADE_MS, 250)
    assert.equal(ONBOARDING_DOT_MS, 350)
    assert.equal(ONBOARDING_SWIPE_THRESHOLD, 50)
  })

  it('timings de obUp, obIn, obFade e obFloat', () => {
    assert.equal(ONBOARDING_TEXT_MS, 600)
    assert.equal(ONBOARDING_TITLE_DELAY_MS, 100)
    assert.equal(ONBOARDING_DESC_DELAY_MS, 220)
    assert.equal(ONBOARDING_IN_MS, 600)
    assert.deepEqual([...ONBOARDING_IN_DELAYS], [0, 140, 280, 500])
    assert.equal(ONBOARDING_FADE_MS, 600)
    assert.equal(ONBOARDING_FADE_DELAY_MS, 500)
    assert.equal(ONBOARDING_FLOAT_MS, 4000)
    assert.equal(ONBOARDING_GLOW_FLOAT_MS, 6000)
  })

  it('OnboardingScreen anima o track (sem ScrollView) e aplica a saida', () => {
    const src = read('screens/OnboardingScreen.tsx')
    assert.ok(src.includes('ONBOARDING_TRACK_MS'))
    assert.ok(src.includes('ONBOARDING_OUT_MS'))
    assert.ok(src.includes('ONBOARDING_LIVE_DELAY_MS'))
    assert.ok(!src.includes('ScrollView'))
  })
})

describe('Onda 2 — Login demo fiel a lgPlay', () => {
  it('DEMO_TIMING bate com o JS do protótipo', () => {
    assert.equal(DEMO_TIMING.userAppearMs, 220)
    assert.equal(DEMO_TIMING.typeCharMs, 28)
    assert.equal(DEMO_TIMING.dotsDelayMs, 320)
    assert.equal(DEMO_TIMING.dotsMs, 750)
    assert.equal(DEMO_TIMING.pauseMs, 3200)
    assert.equal(DEMO_TIMING.oldFadeOutMs, 400)
  })

  it('roleta usa 3 fillers, 950ms e settle 1020ms', () => {
    assert.equal(REEL_LINE_EM, 1.25)
    assert.equal(REEL_DURATION_MS, 950)
    assert.equal(REEL_SETTLE_MS, 1020)

    const picks = [0, 0, 0]
    const items = buildReelItems(
      'organizar a agenda',
      'cuidar do WhatsApp',
      DEMO_HEADLINES,
      () => picks.shift() ?? 0,
    )
    assert.equal(items.length, 5)
    assert.equal(items[0], 'organizar a agenda')
    assert.equal(items[items.length - 1], 'cuidar do WhatsApp')
  })

  it('feed do login tem min-height 310 e o glow 320', () => {
    const stage = read('components/login/DemoStage.tsx')
    assert.ok(stage.includes('minHeight: 310'))
    const screen = read('components/login/LoginScreen.tsx')
    assert.ok(screen.includes('GLOW_SIZE'))
    assert.ok(screen.includes('GLOW_OPACITY_LIGHT'))
  })
})
