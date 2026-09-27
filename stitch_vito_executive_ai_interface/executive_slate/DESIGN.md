---
name: Executive Slate
colors:
  surface: '#121315'
  surface-dim: '#121315'
  surface-bright: '#38393b'
  surface-container-lowest: '#0d0e10'
  surface-container-low: '#1b1c1e'
  surface-container: '#1f2022'
  surface-container-high: '#292a2c'
  surface-container-highest: '#343537'
  on-surface: '#e3e2e5'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#e3e2e5'
  inverse-on-surface: '#303033'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#b9c8de'
  on-secondary: '#233143'
  secondary-container: '#39485a'
  on-secondary-container: '#a7b6cc'
  tertiary: '#4edea3'
  on-tertiary: '#003824'
  tertiary-container: '#00a572'
  on-tertiary-container: '#00311f'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#d4e4fa'
  secondary-fixed-dim: '#b9c8de'
  on-secondary-fixed: '#0d1c2d'
  on-secondary-fixed-variant: '#39485a'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#121315'
  on-background: '#e3e2e5'
  surface-variant: '#343537'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 34px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.022em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.020em
  title-md:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 17px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: -0.011em
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: -0.007em
  body-medium:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 22px
    letterSpacing: -0.007em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: -0.003em
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.005em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.010em
  caption-xs:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.015em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 0.75rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system targets high-output professionals, executives, and leaders who demand quiet competence and zero cognitive drag from their productivity tools. The brand ethos is grounded in "Cold Luxury"—understated, sharp, surgical, and composed. Drawing inspiration from precision software ergonomics and platform-native Human Interface Guidelines, the interface rejects loud dopamine loops, saturated gradients, and frivolous ornamentation in favor of poise, speed, and discretion.

The emotional signature is that of an elite private chief of staff: calm under pressure, rigorously structured, hyper-contextual, and invisible until required. Visual elements employ dark monochromatic layers, restrained precision accents, and crisp mathematical proportions to evoke deep focus, uncompromising craftsmanship, and absolute operational clarity.

## Colors

The palette operates on a disciplined luminance model designed to sustain all-day visual endurance and high-contrast scanning.

### Surface Architecture
- **Canvas Base:** `#0A0B0D` (Obsidian Tinted Off-Black). Serves as the foundational plane across the entire viewport.
- **Surface Level 1 (Base Cards & Grouped Views):** `#13151A`. Provides distinct structure over the canvas.
- **Surface Level 2 (Inputs, Inactive Chips, Nested Blocks):** `#1B1E26`. Used for interactive troughs and recessed items.
- **Surface Level 3 (Floating Sheets, Elevated Dialogs, Action Menus):** `#222731`. Highest surface plane.

### Boundary Definition
- **Structural Border:** `#272E3B` (1px solid). Provides crisp separation between low-luminance planes.
- **Subtle Highlight / Separator:** `rgba(255, 255, 255, 0.06)`. Used sparingly for internal dividers within cards.

### Accents & Signal Colors
- **Precision Cobalt (Primary Accent):** `#3B82F6`. Reserved strictly for primary callouts, active indicators, and critical confirmed actions.
- **Accent Glow / Wash:** `rgba(59, 130, 246, 0.12)`. For chip selections, subtle active item badges, and AI processing backdrops.
- **Success:** `#10B981` (Completed briefings, synced schedules, validated tasks).
- **Warning:** `#F59E0B` (Approaching deadlines, rescheduling conflicts).
- **Danger:** `#EF4444` (Declined meetings, destructive cancellations, critical alerts).

### Text & Glyph Hierarchy
- **Primary Content:** `#F8FAFC`. Maximum contrast (WCAG AAA) against dark planes for immediate legibility.
- **Secondary Content:** `#94A3B8`. Used for descriptions, subordinate metrics, and structural metadata.
- **Muted Content:** `#64748B`. Reserved for timestamps, placeholders, inactive icons, and supplementary footnotes.

## Typography

The typographic system utilizes **Inter** across all roles to achieve neutral, metric-precise rendering across handheld screens. Tracking is tightly calibrated to mirror system-native platform standards (SF Pro / Robot-adjacent metrics), ensuring rapid scanning across executive briefs, schedules, and transactional records.

### Hierarchy & Usage Rules
- **Display & Main Headers (`display-lg`, `display-lg-mobile`):** Applied to primary view titles and top-level executive summaries.
- **Section Headings (`headline-sm`):** Standard 17px semibold headers anchored to card headers, feed dates, and module clusters.
- **Core Reading (`body-lg`, `body-medium`):** 15px reading size engineered to match executive scan speeds. `body-medium` provides emphasis inside chat bubbles, message excerpts, and list item leads.
- **Badges, Pills & Time Data (`label-sm`, `caption-xs`):** 11px to 12px uppercase or localized tabular numerals used for calendar slots, tags, AI status indicators, and notification badges.
- **Numeric Data:** Always activate tabular numbers (`tnum`) for time codes, durations, financial indicators, and counts to preserve baseline alignment.

## Layout & Spacing

The layout is built around a rigorous 4px/8px micro-grid. Spacing rules prioritize density without feeling cramped, balancing rapid single-thumb operational reach with comfortable eye tracking.

### Form Factor Adaptations
- **Mobile Handheld (< 600px):**
  - Outer screen edge margin: `1rem` (16px).
  - Component intra-gap: `0.75rem` (12px) to `1rem` (16px).
  - All interactive elements must strictly honor a minimum touch target bounding box of `44pt × 44pt` (48pt recommended for single-action triggers).
  - Single primary vertical stack with full-width conversational and contextual cards.
- **Tablet / Expanded Viewport (≥ 600px):**
  - Outer margins expand to `1.5rem` (24px) or `2rem` (32px).
  - Split two-column workflow: fixed navigation/agenda lane (360px) paired with an expanded executive action and conversation canvas.

### Layout Geometry
Cards and stacked modules utilize strict concentric padding: outer card padding is `1rem` (16px), whereas inner contextual rows or sub-modules step down to `0.75rem` (12px) and `0.5rem` (8px). Gaps between discrete modules are standard `0.75rem` (12px) to maintain continuous contextual flow without disjointed breaks.

## Elevation & Depth

Visual depth avoids thick, muddy shadows, relying instead on **tonal stepping combined with low-contrast structural outlines**.

### The Layer Stack
1. **Plane 0 (Canvas):** `#0A0B0D` — Recessed background. No border.
2. **Plane 1 (Persistent Containers & Feed Cards):** `#13151A` with a perimeter `1px solid #272E3B`. No shadow on standard state.
3. **Plane 2 (Interactive Embedded Controls & Inputs):** `#1B1E26` with `1px solid #272E3B`.
4. **Plane 3 (Floating Drawers, Menus & Action Sheets):** `#222731` paired with a directional, ambient diffused shadow:
   - `box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.45), 0 2px 6px -1px rgba(0, 0, 0, 0.35)`
   - Border: `1px solid rgba(255, 255, 255, 0.08)` to replicate edge-lit glass without skeuomorphic haze.

### AI Contextual Focus & Active States
When an AI executive action is actively parsing or pending input, the module remains on its surface tier but applies a delicate, localized inner/outer ring of `rgba(59, 130, 246, 0.25)` with a 1px border shift to `#3B82F6`, providing clear state attribution without jarring layout shifts.

## Shapes

The geometric system enforces strict concentricity to ensure organic harmony across nested UI structures:

- **Outer Cards & Primary Group Panels:** `1rem` (16px / `rounded-2xl`).
- **Inner Containers, Input Fields, & Sub-Panels:** `0.75rem` (12px / `rounded-xl`).
- **Interactive Buttons, Chips, Category Badges & Avatars:** Fully rounded pill-shape (`9999px` / `rounded-full`).

This pairing of generous pill-shaped interactive triggers nested cleanly within disciplined, structured cards creates an ergonomic tension between structural efficiency and tactile, thumb-friendly interaction targets.

## Components

### Buttons
- **Primary Action:** Solid Cobalt `#3B82F6` fill with `#F8FAFC` semibold text. Shape: `rounded-full`. Height: `44px` minimum. Padding: `12px 20px`. Subtle pressed state reduces opacity to `0.9` and scales down to `0.98`.
- **Secondary Action:** Surface `#1B1E26` fill, `1px solid #272E3B` border, `#F8FAFC` label. Shape: `rounded-full`. Height: `44px`. Active tap changes background to `#222731`.
- **Ghost Action:** Transparent background with `#94A3B8` label and glyph. Padding: `8px 12px`. Shape: `rounded-full`.

### Filter & Context Chips
- **Resting:** `#1B1E26` fill, `1px solid #272E3B`, `#94A3B8` label (`label-sm`). Height: `32px`. Padding: `6px 14px`. Shape: `rounded-full`.
- **Active / Selected:** `rgba(59, 130, 246, 0.12)` fill, `1px solid #3B82F6`, `#3B82F6` label (`label-sm` semibold).

### Cards & Executive Brief Modules
- **Base Style:** Background `#13151A`, border `1px solid #272E3B`, corner radius `16px`, padding `16px`.
- **Composition:** Optional top status row featuring category tag or timestamp (`caption-xs` in `#64748B`), bold header (`headline-sm` in `#F8FAFC`), body copy (`body-lg` in `#94A3B8`), and trailing action slot.
- **Divider Lines:** Internal row items separated with `1px solid rgba(255, 255, 255, 0.04)`.

### Input Fields & Search Bars
- **Container:** Background `#1B1E26`, border `1px solid #272E3B`, radius `12px`. Height: `48px`. Padding: `12px 16px`.
- **Text:** Input text in `#F8FAFC`, placeholder in `#64748B`.
- **Focused State:** Border transitions to `#3B82F6` with an optional ambient stroke ring `rgba(59, 130, 246, 0.15)`.

### Checkboxes & Toggle Controls
- **Toggle Switch:** Width `48px`, height `28px`. Track is `#1B1E26` (inactive) or `#3B82F6` (active). Thumb is `#F8FAFC` solid circle (`22px`), inset by `3px`.
- **Checkmark Indicator:** `20px` circle with `1.5px solid #272E3B`. Checked state fills `#3B82F6` with sharp white SVG check glyph.

### Executive Assistant Specialized Components
- **Voice / Dictation Orb:** Fixed bottom floating trigger (`56px × 56px`), rounded-full, `#3B82F6` background with a subtle ambient radial glow (`0 0 24px rgba(59, 130, 246, 0.35)`).
- **Briefing Metric Pill:** Background `#1B1E26`, border `1px solid #272E3B`, radius `9999px`. Contains status dot (`6px` solid `#10B981`, `#F59E0B`, or `#EF4444`) alongside tabular text (`caption-xs`).