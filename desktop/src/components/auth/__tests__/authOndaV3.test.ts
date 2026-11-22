import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { DEMO_HEADLINES, DEMO_SCENES, getToneColor } from '../demoScenes';
import { loginPalette } from '../loginPalette';

const authDir = path.resolve(__dirname, '..');

describe('Plano 09 Onda V3 — Auth, Splash, Onboarding e Permissões (Desktop)', () => {
  it('usa paleta v5 Light e Dark canônica', () => {
    const light = loginPalette(false);
    expect(light.page).toBe('#efefef');
    expect(light.bg).toBe('#ffffff');
    expect(light.surf).toBe('#f4f4f4');
    expect(light.btn).toBe('#ececec');
    expect(light.ink).toBe('#0a0a0a');
    expect(light.muted).toBe('#595959');
    expect(light.line).toBe('#e6e6e6');

    const dark = loginPalette(true);
    expect(dark.page).toBe('#000000');
    expect(dark.bg).toBe('#0a0a0a');
    expect(dark.surf).toBe('#171717');
    expect(dark.btn).toBe('#262626');
    expect(dark.ink).toBe('#f5f5f5');
    expect(dark.muted).toBe('#8c8c8c');
    expect(dark.line).toBe('#262626');
  });

  it('expõe exatamente as 6 cenas v5 do protótipo', () => {
    expect(DEMO_SCENES).toHaveLength(6);
    expect(DEMO_HEADLINES).toEqual([
      'organizar a agenda',
      'controlar finanças',
      'automatizar rotinas',
      'cuidar do WhatsApp',
      'ler seus e-mails',
      'não perder prazos',
    ]);
    expect(getToneColor('fin', false)).toBe('#d98a00');
    expect(getToneColor('fin', true)).toBe('#ffb938');
  });

  it('mantém todos os arquivos de auth < 500 linhas e sem anti-patterns', () => {
    const files = [
      'AuthView.tsx',
      'SplashScreen.tsx',
      'OnboardingView.tsx',
      'DemoStage.tsx',
      'DemoActionCard.tsx',
      'HeadlineReel.tsx',
      'VitoAnimatedLogo.tsx',
      'AuthEmailModal.tsx',
      'LegalDocModal.tsx',
      'PostLoginPermissionsModal.tsx',
      'loginPalette.ts',
      'demoScenes.ts',
    ];

    for (const file of files) {
      const content = fs.readFileSync(path.join(authDir, file), 'utf8');
      const lines = content.split('\n').length;
      expect(lines, `${file} tem ${lines} linhas`).toBeLessThan(500);
      expect(content).not.toContain('as any');
      expect(content).not.toContain('@ts-ignore');
    }
  });

  it('Splash, Onboarding, Login e Permissões contêm elementos canônicos v5', () => {
    const splash = fs.readFileSync(path.join(authDir, 'SplashScreen.tsx'), 'utf8');
    expect(splash).toContain('state="gentleman"');
    expect(splash).toContain('size={140}');
    expect(splash).toContain('speed={1.5}');
    expect(splash).toContain('46px');

    const onboarding = fs.readFileSync(path.join(authDir, 'OnboardingView.tsx'), 'utf8');
    expect(onboarding).toContain('Conheça o Vito');
    expect(onboarding).toContain('Agenda e tarefas sem esforço');
    expect(onboarding).toContain('Suas finanças, conectadas');
    expect(onboarding).toContain('Bots que trabalham por você');
    expect(onboarding).toContain('Pular');

    const authView = fs.readFileSync(path.join(authDir, 'AuthView.tsx'), 'utf8');
    expect(authView).toContain('Continuar com Google');
    expect(authView).toContain('WhatsApp');
    expect(authView).toContain('E-mail');
    expect(authView).toContain('Termos de Uso');
    expect(authView).toContain('Política de Privacidade');
    expect(authView).toContain('13 anos');

    const perms = fs.readFileSync(path.join(authDir, 'PostLoginPermissionsModal.tsx'), 'utf8');
    expect(perms).toContain('Permitir acesso?');
    expect(perms).toContain('Notificações');
    expect(perms).toContain('Calendário');
    expect(perms).toContain('Microfone');
  });
});
