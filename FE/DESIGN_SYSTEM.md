# VietMed UI color standard

Use this palette for every page so the app keeps one calm technical tone.

## Core palette

| Token | Hex | Use |
| --- | --- | --- |
| `--color-page` | `#f5f7fa` | App background |
| `--color-surface` | `#ffffff` | Cards, tables, modals |
| `--color-panel` | `#f8fafc` | Subtle panel/header background |
| `--color-text` | `#142033` | Main headings and strong text |
| `--color-muted-strong` | `#334155` | Secondary headings, labels |
| `--color-muted` | `#657386` | Descriptions and metadata |
| `--color-border` | `#d9e1ea` | Main borders |
| `--color-border-soft` | `#e8edf3` | Table rows and inner dividers |
| `--color-field-border` | `#cbd5e1` | Inputs and selects |

## Brand and actions

| Token | Hex | Use |
| --- | --- | --- |
| `--color-brand` | `#c83f34` | Primary CTA, important VietMed accent only |
| `--color-brand-dark` | `#a3342b` | Primary hover, destructive emphasis |
| `--color-brand-soft` | `#fff6f4` | Soft critical background |
| `--color-brand-border` | `#f4c9c4` | Soft critical border |
| `--color-accent` | `#2f5f98` | Navigation, links, informational icons |
| `--color-accent-soft` | `#eef5ff` | Hover, selected neutral/info surface |
| `--color-accent-border` | `#c9d9ee` | Info border |

## Status colors

| Status | Text | Background | Border |
| --- | --- | --- | --- |
| Success | `#177245` | `#eefaf3` | `#b9e8ca` |
| Warning | `#9b5a17` | `#fff8ed` | `#efd8a8` |
| Danger | `#a3342b` | `#fff6f4` | `#f4c9c4` |

## Usage rules

- Use blue accent for navigation, links, icons, selected states and neutral highlights.
- Use red brand color only for primary buttons, unread badges, destructive actions and critical attention.
- Do not introduce new purples, saturated blues, bright greens, or orange/brown palettes.
- For new UI, prefer existing component classes: `primary-button`, `secondary-button`, `danger-button`, `icon-button`, `surface-card`, `metric-icon`.
- If Tailwind arbitrary colors are needed, use the hex values in this file.
