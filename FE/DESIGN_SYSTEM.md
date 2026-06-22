# VietMed UI color standard

Use this palette for every page so the app stays close to vietmed.vn: white surfaces, black/gray text, and VietMed red as the main brand color.

## Core palette

| Token | Hex | Use |
| --- | --- | --- |
| `--color-page` | `#f7f7f7` | App background |
| `--color-surface` | `#ffffff` | Cards, tables, modals |
| `--color-panel` | `#fafafa` | Subtle panel/header background |
| `--color-text` | `#1f1f1f` | Main headings and strong text |
| `--color-muted-strong` | `#333333` | Secondary headings, labels |
| `--color-muted` | `#666666` | Descriptions and metadata |
| `--color-border` | `#e5e5e5` | Main borders |
| `--color-border-soft` | `#eeeeee` | Table rows and inner dividers |
| `--color-field-border` | `#d6d6d6` | Inputs and selects |

## Brand and actions

| Token | Hex | Use |
| --- | --- | --- |
| `--color-brand` | `#d71920` | Primary CTA, active navigation, VietMed accent |
| `--color-brand-dark` | `#b5121b` | Primary hover, destructive emphasis |
| `--color-brand-soft` | `#fff5f5` | Selected state and soft critical background |
| `--color-brand-border` | `#f5c7cb` | Brand border |
| `--color-accent` | `#d71920` | Same as brand unless a status color is required |
| `--color-accent-soft` | `#fff5f5` | Hover and selected surface |
| `--color-accent-border` | `#f5c7cb` | Brand border |

## Status colors

| Status | Text | Background | Border |
| --- | --- | --- | --- |
| Success | `#177245` | `#eefaf3` | `#b9e8ca` |
| Warning | `#9b5a17` | `#fff8ed` | `#efd8a8` |
| Danger | `#b5121b` | `#fff5f5` | `#f5c7cb` |

## Usage rules

- Use VietMed red for primary buttons, active navigation, links, selected states and unread badges.
- Use black/gray text and white surfaces as the default. Do not make large red sections unless the screen needs a strong warning.
- Do not introduce purple, saturated blue, bright green, or orange/brown palettes.
- For new UI, prefer existing component classes: `primary-button`, `secondary-button`, `danger-button`, `icon-button`, `surface-card`, `metric-icon`.
- If Tailwind arbitrary colors are needed, use the hex values in this file.
