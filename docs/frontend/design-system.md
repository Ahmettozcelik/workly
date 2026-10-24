# Workly Design System

Status: foundation implemented (Steps 2.1–2.3c) on `feature/design-system`.
Source of truth for values is the code; this document explains intent and rules.

- Tokens and base styles: `frontend/src/app/globals.css`
- Theme logic: `frontend/src/lib/theme.ts`, `frontend/src/components/theme/*`
- Components: `frontend/src/components/ui/*`
- Live preview (development only): `http://localhost:3000/design-system` — returns 404 in production builds

## 1. Colour

### Brand primitives (never change)

| Name | Value | CSS variable |
|---|---|---|
| Midnight | `#111827` | `--wk-midnight` |
| Lime | `#C7F36B` | `--wk-lime` |
| Off-white | `#F5F5F0` | `--wk-offwhite` |
| Electric Purple | `#7868F5` | `--wk-purple` |

### Semantic tokens

Components use only semantic tokens, through Tailwind utilities (`bg-canvas`, `text-fg-muted`, `border-line-strong`, …). Tailwind's default palette is disabled (`--color-*: initial`), so ad-hoc colours such as `bg-zinc-500` do not exist.

| Token | Light | Dark | Use |
|---|---|---|---|
| `canvas` | `#F5F5F0` | `#111827` | Page background |
| `surface` | `#FFFFFF` | `#1A2233` | Cards, inputs |
| `surface-raised` | `#FFFFFF` | `#232C3F` | Elevated surfaces |
| `fg` | `#111827` | `#F5F5F0` | Primary text |
| `fg-muted` | `#4B5563` | `#9CA3AF` | Secondary text, hints, placeholders |
| `line` | `#E2E2DA` | `#2A3346` | Decorative dividers only (below 3:1 by design) |
| `line-strong` | `#85857B` | `#64708C` | Control boundaries (≥ 3:1) |
| `primary` / `primary-fg` | `#111827` / `#C7F36B` | `#C7F36B` / `#111827` | Primary action (inverts per theme) |
| `accent` | `#7868F5` | `#7868F5` | Fills, icons, large text, checkbox colour |
| `accent-text` | `#5B4BD8` | `#A89EFF` | Small purple text and links |
| `focus` | `#7868F5` | `#7868F5` | Focus outline |
| `danger` | `#B91C1C` | `#F87171` | Errors |
| `success` | `#15803D` | `#4ADE80` | Success |

Lime is never used as text or as the only boundary on light backgrounds (1.17:1 on Off-white). White text on Electric Purple (4.12:1) is not used for normal-size text.

### Measured contrast (WCAG 2.x formula; AA = 4.5:1 text, 3:1 non-text)

| Pair | Light (canvas / surface) | Dark (canvas / surface / raised) |
|---|---|---|
| `fg` | 16.22 / 17.74 | 16.22 / 14.54 / 12.77 |
| `fg-muted` | 6.91 / 7.56 | 6.99 / 6.26 / 5.50 |
| `accent-text` | 5.58 / 6.10 | 7.60 / 6.82 / 5.99 |
| `danger` | 5.92 / 6.47 | 6.41 / 5.75 / 5.05 |
| `success` | 4.59 / 5.02 | 10.18 / 9.13 / 8.02 |
| `primary-fg` on `primary` | 13.91 | 13.91 |
| `line-strong` (non-text) | 3.41 / 3.72 | 3.58 / 3.21 / — |
| `focus` outline (non-text) | 3.77 / 4.12 | 4.31 / 3.86 / 3.39 |

Native checkbox, measured from rendered pixels (Edge): unchecked outline 4.15 (light) / 4.81 (dark); checked fill vs canvas 3.77 / 4.31; check mark vs fill 4.12.

Automated checks (axe-core, WCAG 2.0/2.1/2.2 A+AA) report 0 violations on the preview at 375/768/1280 px in both themes. This is not a full WCAG conformance claim; see §8.

## 2. Typography

| Role | Font | Notes |
|---|---|---|
| Headings / display | Bricolage Grotesque (variable) | `font-display` |
| Body / UI | Inter (variable) | `font-sans` (default) |

- Loaded with `next/font/google`, self-hosted at build time, subsets `latin` + `latin-ext` (required for Turkish: İ ı Ğ ğ Ş ş).
- Sizes: Tailwind's default scale plus `text-display` = `clamp(2.25rem, 1.6rem + 2.6vw, 3.5rem)`.
- Body text 16px. Form controls are always ≥ 16px (prevents iOS zoom).
- `<html lang>` must match the content language. Avoid CSS `uppercase` unless `lang` is correct (Turkish i → İ).
- Turkish strings are often 20–30% longer than English: no fixed widths on text containers; buttons may wrap.

## 3. Other tokens

| Token | Value |
|---|---|
| `rounded-control` | 12px — buttons, inputs, alerts |
| `rounded-card` | 20px — cards |
| `shadow-card`, `shadow-raised` | Subtle shadows in light; `none` in dark (borders carry separation) |
| `ease-standard` | `cubic-bezier(0.2, 0, 0, 1)`; Tailwind's default 150ms duration |
| Spacing | Tailwind default 4px scale |
| Breakpoints | Tailwind defaults: `sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536 (mobile-first) |

`prefers-reduced-motion: reduce` disables animations and transitions globally.

## 4. Theme

Modes: **System** (default), **Light**, **Dark**.

- First visit follows the OS (`prefers-color-scheme`).
- A manual choice is stored in `localStorage["workly-theme"]` (`"light"` / `"dark"`); choosing System removes the key. Invalid values fall back to System.
- System mode follows OS changes live. Other tabs update via the `storage` event.
- No flash: an inline script in `<head>` sets `data-theme` on `<html>` before first paint; `<html>` has `suppressHydrationWarning`.
- Without JavaScript, the `prefers-color-scheme` CSS fallback still applies.
- `dark:` utilities follow `data-theme` (`@custom-variant dark`), but components should not need them — semantic tokens already switch.
- CSP: the inline script is a static string, so a future strict CSP can allow it by nonce or hash.
- The theme toggle is a single cycling button (System → Light → Dark → System) with an accessible label and a polite live-region announcement. Known trade-off: for a stored Light/Dark preference its icon shows System briefly until hydration (page colours do not flash).

## 5. Components

All components in `components/ui` are server-compatible (no `"use client"`, no state). Only `ThemeToggle` is a Client Component.

| Component | API summary |
|---|---|
| `Button` | `variant`: `primary` · `secondary` · `ghost`; `size`: `md` (44px) · `lg` (48px); `fullWidth`; `loading` (spinner + label, `disabled`, `aria-busy`; auto-width buttons grow slightly). Defaults to `type="button"` — pass `type="submit"` in forms. |
| `buttonClasses()` | Styles a link as a button: `<Link className={buttonClasses({ variant: "secondary" })} />`. |
| `Card` | `padding`: `sm` · `md` · `lg`. Plain `<div>`; wrap in `<section>`/`<article>` when meaningful. |
| `Logo` | Text wordmark "Workly" (temporary brand), `size`: `md` · `lg`. |
| `FormField` | Render prop: `{(control) => <Input {...control} />}`. Passes `id`, `aria-describedby`, `aria-invalid`, `required`, `disabled`. Props: `label`, `hint`, `error`, `required`, `disabled`, `id`, `describedBy` (merged, de-duplicated). Order: label → hint → control → error. Must stay server-compatible. |
| `Input` | 48px, 16px text, all native props and `ref`. Text-like types only. |
| `Textarea` | `rows` defaults to 4, vertical resize. |
| `Select` | Native single-value `<select>` with chevron. `className` styles the wrapper; other props and `ref` go to `<select>`. Placeholder: `<option value="" disabled>…</option>`. |
| `Checkbox` | Native checkbox (20px, `accent-color`). Props: `label`, `description`, `error` + native props. Not used inside `FormField`. |
| `Badge` | Outline style; `variant`: `neutral` · `accent` · `success` · `danger`; 12px semibold. |
| `Avatar` | Initials only; `name`, `size` (`sm` 32 · `md` 40 · `lg` 56), `locale` (default `"tr"`), `decorative`. |
| `Alert` | `variant`: `danger` (`role="alert"`) · `success` / `neutral` (`role="status"`); optional `title`. |

### React Hook Form compatibility

Controls forward native props and `ref` (React 19), so `register()` output can be spread next to the FormField control props:

```tsx
<FormField label="E-posta" error={errors.email?.message} required>
  {(control) => <Input type="email" {...control} {...register("email")} />}
</FormField>
```

In RHF forms, RHF is the single source of truth for `disabled`.

## 6. Usage rules

1. Use semantic tokens only; do not write theme-specific `dark:` classes in components.
2. `className` on components is for layout (margin, width, grid placement). `cn()` does not resolve Tailwind conflicts.
3. Never use a placeholder as a label. Every control has a visible label (via `FormField` or `Checkbox`).
4. Required fields show `*` (hidden from assistive technology); explain `*` once at form level.
5. **Custom-validated forms use `noValidate`.** In these forms, do not put native `required` on checkboxes or selects: Chromium does not expose `required` for them in its accessibility tree and marks an unchecked required checkbox / empty required select as invalid before any interaction. Show `*`, validate in code, and set `aria-invalid` + an error message only after validation. Native `required` on text inputs is acceptable.
6. Field errors are not live regions. On a failed submit, show a form-level `Alert` and move focus to the first invalid field.
7. Live regions (`Alert`) announce only when inserted or changed after load: render alerts conditionally, do not toggle them with CSS.
8. Colour is never the only signal: errors have text; badges have text; links in body text are underlined.
9. Keep the global `:focus-visible` outline; do not remove outlines.
10. Do not add `"use client"` to shared components. Feature components that need state (forms) are Client Components in their route folder.

## 7. Known limitations

- Chromium's DevTools accessibility tree does not report `required` for `<select>` or checkboxes (confirmed with plain HTML). See rule 5.
- Autofill styling cannot be verified in headless browsers.
- Native checkbox and select menus are browser-drawn; small rendering differences between browsers are expected.

## 8. Manual checks still required

These need a real browser session and/or a screen reader and have not been performed:

- Narrator/NVDA: required text inputs, the required checkbox and select, form-field descriptions and errors, dynamically inserted alerts, the theme toggle announcement and the loading button.
- Visual check that hard refresh with a stored Dark preference never shows a light frame.
- Autofill appearance in both themes.
