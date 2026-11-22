import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { v5DarkColors, v5Fonts, v5LightColors, v5Radii } from '../tokens';
import {
  MOTION_CURVES,
  MOTION_DURATIONS,
  SCREEN_TRANSITION_CLASSES,
  VFX_COLORS,
  computeCountUpValue,
  getStaggerStyle,
} from '../motion';

describe('Design System v5 & vito-motion (Desktop)', () => {
  it('define tokens exatos Light/Dark, Geist + Geist Mono e raios v5', () => {
    expect(v5LightColors.page).toBe('#efefef');
    expect(v5LightColors.bg).toBe('#ffffff');
    expect(v5LightColors.surf).toBe('#f4f4f4');
    expect(v5LightColors.btn).toBe('#ececec');
    expect(v5LightColors.ink).toBe('#0a0a0a');
    expect(v5LightColors.muted).toBe('#595959');
    expect(v5LightColors.line).toBe('#e6e6e6');

    expect(v5DarkColors.page).toBe('#000000');
    expect(v5DarkColors.bg).toBe('#0a0a0a');
    expect(v5DarkColors.surf).toBe('#171717');
    expect(v5DarkColors.btn).toBe('#262626');
    expect(v5DarkColors.ink).toBe('#f5f5f5');
    expect(v5DarkColors.muted).toBe('#8c8c8c');
    expect(v5DarkColors.line).toBe('#262626');

    expect(v5Fonts.sans).toContain('Geist');
    expect(v5Fonts.mono).toContain('Geist Mono');
    expect(v5Radii.card).toBe(22);
    expect(v5Radii.dock).toBe(40);
  });

  it('expõe curvas, transições, count-up 950ms, stagger 45ms e cores .vfx', () => {
    expect(MOTION_CURVES.std).toBe('cubic-bezier(0.2, 0.8, 0.2, 1)');
    expect(MOTION_CURVES.q).toBe('cubic-bezier(0.22, 1, 0.36, 1)');
    expect(MOTION_DURATIONS.staggerStep).toBe(45);
    expect(MOTION_DURATIONS.countUp).toBe(950);
    expect(MOTION_DURATIONS.themeReveal).toBe(720);
    expect(VFX_COLORS).toHaveLength(5);

    expect(SCREEN_TRANSITION_CLASSES.tab).toEqual({
      enter: 'tr-tab',
      leave: 'lv-tab',
      leaveMs: 170,
    });
    expect(computeCountUpValue(500, 1)).toBe(500);
    expect(computeCountUpValue(500, 0)).toBe(0);
    expect(getStaggerStyle(3)).toEqual({ '--stagger-i': 3 });
  });

  it('Onda V2 Desktop: 5 abas na Sidebar, Chat v5 limpo sem Foco em e sem .vfab', () => {
    const desktopSrc = path.resolve(__dirname, '../..');
    const sidebarSrc = fs.readFileSync(
      path.join(desktopSrc, 'components/layout/Sidebar.tsx'),
      'utf8'
    );
    const chatInputSrc = fs.readFileSync(
      path.join(desktopSrc, 'components/chat/ChatInputDock.tsx'),
      'utf8'
    );
    const chatViewSrc = fs.readFileSync(
      path.join(desktopSrc, 'components/chat/ChatView.tsx'),
      'utf8'
    );
    const indexCss = fs.readFileSync(path.join(desktopSrc, 'index.css'), 'utf8');

    expect(sidebarSrc).toContain("label: 'Vito'");
    expect(sidebarSrc).toContain("label: 'Agenda'");
    expect(sidebarSrc).toContain("label: 'Tarefas'");
    expect(sidebarSrc).toContain("label: 'Finanças'");
    expect(sidebarSrc).toContain("label: 'Bots'");
    expect(sidebarSrc).toContain('triggerCircularThemeReveal');

    expect(chatInputSrc).not.toContain('Foco em');
    expect(chatInputSrc).toContain('c-attach');
    expect(chatInputSrc).toContain('c-model');
    expect(chatInputSrc).toContain('c-mic');
    expect(chatInputSrc).toContain('c-send');
    expect(chatInputSrc).toContain('c-voice');

    expect(chatViewSrc).toContain('c-notifs');
    expect(chatViewSrc).toContain('c-new');
    expect(chatViewSrc).toContain('data-go-perfil');
    expect(chatViewSrc).toContain('chero-rig');

    expect(indexCss).toContain('.vfab { display: none !important; }');
    expect(indexCss).toContain('prefers-reduced-motion: reduce');
  });
});
