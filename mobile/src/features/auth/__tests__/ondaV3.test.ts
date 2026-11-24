import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ONBOARDING_SLIDES } from '../utils/onboardingSlides'
import { LEGAL_DOCS } from '../utils/legalDocs'
import {
  DEFAULT_PERM_PREFS,
  ONBOARDING_SEEN_KEY,
  POST_LOGIN_PERMS_PROMPTED_KEY,
} from '../../../components/auth/onboardingStorage'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const mobileSrc = path.resolve(__dirname, '../../..')

describe('Plano 09 Onda V3 — Splash, Onboarding, Login v5 e Permissões (Mobile)', () => {
  it('Onboarding possui exatamente 4 slides na ordem canônica', () => {
    assert.equal(ONBOARDING_SLIDES.length, 4)
    assert.deepEqual(
      ONBOARDING_SLIDES.map((s) => s.title),
      [
        'Conheça o Vito',
        'Agenda e tarefas sem esforço',
        'Suas finanças, conectadas',
        'Bots que trabalham por você',
      ],
    )
  })

  it('Documentos legais possuem Termos de Uso (13+) e Política de Privacidade', () => {
    assert.equal(LEGAL_DOCS.terms.title, 'Termos de Uso')
    assert.equal(LEGAL_DOCS.priv.title, 'Política de Privacidade')
    assert.ok(LEGAL_DOCS.terms.sections.some((s) => s.body.includes('13 anos')))
    assert.ok(LEGAL_DOCS.priv.sections.some((s) => s.body.includes('privacidade@vito.app')))
  })

  it('Chaves e preferências padrão de onboarding e permissões pós-login estão definidas', () => {
    assert.equal(ONBOARDING_SEEN_KEY, '@vito_onboarding_seen')
    assert.equal(POST_LOGIN_PERMS_PROMPTED_KEY, '@vito_post_login_perms_prompted')
    assert.deepEqual(DEFAULT_PERM_PREFS, { notif: true, cal: true, mic: false })
  })

  it('Splash, Onboarding, Login e PostLoginPermissions respeitam todos os requisitos estruturais e < 500 linhas', () => {
    const files = [
      'features/auth/screens/SplashScreen.tsx',
      'features/auth/screens/OnboardingScreen.tsx',
      'features/auth/screens/LoginScreen.tsx',
      'features/auth/components/LoginHeader.tsx',
      'features/auth/demo/DemoStage.tsx',
      'features/auth/demo/DemoActionCard.tsx',
      'features/auth/components/AuthActionsFooter.tsx',
      'features/auth/components/EmailSheet.tsx',
      'features/auth/components/LegalDocModal.tsx',
      'features/auth/components/LoginMascotRig.tsx',
      'features/auth/components/OnboardingSlideArt.tsx',
      'features/auth/utils/loginPalette.ts',
      'features/auth/demo/demoScenes.ts',
      'components/auth/PostLoginPermissionsSheet.tsx',
      'components/auth/onboardingStorage.ts',
    ]

    for (const rel of files) {
      const content = fs.readFileSync(path.join(mobileSrc, rel), 'utf8')
      const lines = content.split('\n').length
      assert.ok(lines < 500, `${rel} excede 500 linhas (${lines})`)
      assert.ok(!content.includes('as any'), `${rel} não deve conter "as any"`)
      assert.ok(!content.includes('@ts-ignore'), `${rel} não deve conter "@ts-ignore"`)
    }

    const splashSrc = fs.readFileSync(path.join(mobileSrc, 'features/auth/screens/SplashScreen.tsx'), 'utf8')
    assert.ok(splashSrc.includes('state="gentleman"'))
    assert.ok(splashSrc.includes('size={SPLASH_MASCOT_SIZE}'))
    assert.ok(splashSrc.includes('speed={1.5}'))
    assert.ok(splashSrc.includes('fontSize: SPLASH_WORD_SIZE'))

    const loginFooterSrc = fs.readFileSync(
      path.join(mobileSrc, 'features/auth/components/AuthActionsFooter.tsx'),
      'utf8',
    )
    assert.ok(loginFooterSrc.includes('Continuar com Google'))
    assert.ok(loginFooterSrc.includes('WhatsApp'))
    assert.ok(loginFooterSrc.includes('E-mail'))
    assert.ok(loginFooterSrc.includes('Termos de Uso'))
    assert.ok(loginFooterSrc.includes('Política de Privacidade'))
    assert.ok(loginFooterSrc.includes('13 anos'))

    const permsSrc = fs.readFileSync(
      path.join(mobileSrc, 'components/auth/PostLoginPermissionsSheet.tsx'),
      'utf8',
    )
    assert.ok(permsSrc.includes('Permitir acesso?'))
    assert.ok(permsSrc.includes('Notificações'))
    assert.ok(permsSrc.includes('Calendário'))
    assert.ok(permsSrc.includes('Microfone'))
  })
})
