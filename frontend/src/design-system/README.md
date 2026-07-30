# ComplianceTwin UI design system

Internal design system for the legal-tech compliance workspace. Extends the existing React + Vite + Tailwind stack; it does not replace product screens.

## View the showcase

1. Sign in to the app as usual.
2. Open `#/design-system` (sidebar: **UI design system**), or navigate to:
   - Foundations
   - Components
   - Dashboard example
   - Applicability review example
   - Obligations table example
   - Regulatory change inbox example

Example URL when running the prototype on port 8001:

`http://127.0.0.1:8001/#/design-system`

## Stack (discovered)

| Concern | Choice |
| --- | --- |
| Framework | React 18.3 + TypeScript (strict) |
| Build | Vite 5 |
| Styling | Tailwind 3.4 + CSS variables (`tokens.css`, `sand-theme.css`) |
| Helpers | CVA, clsx, tailwind-merge, lucide-react |
| Routing | Hash routes in `App.tsx` (no React Router) |
| Fonts | Plus Jakarta Sans, DM Mono, Source Serif 4 |
| Dark mode | Not implemented (light workspace default) |
| Storybook | Not present — showcase route used instead |
| Frontend tests | No Vitest/Jest runner in `package.json` |

## Token architecture

Semantic CSS custom properties live in `tokens.css` with a `--ds-*` prefix:

- Surfaces: `--ds-background-page`, `--ds-background-surface`, `--ds-background-subtle`
- Text: `--ds-text-primary`, `--ds-text-secondary`, `--ds-text-muted`
- Borders, actions, semantic status colours, AI panel colours
- Typography sizes/weights/line-heights, spacing, radii, shadows, focus, z-index, motion, layout widths

Tailwind maps these under `theme.extend.colors.ds.*`, radii `ds-sm|md|lg|xl`, shadows `ds-*`, and durations `fast|normal|slow`.

**Applicability never uses success green.** Green is reserved for completed, approved, or verified outcomes. Applicability uses blue/neutral status tokens.

## Import

```ts
import { Button, StatusBadge, ApplicabilityResultCard } from "@/design-system";
```

## Validation

```bash
cd frontend && npm run build
```

(`tsc -b` + `vite build`)
