/**
 * Pixel icons bundled by Vite (always available; no separate /foo.png route needed).
 */
import productConsoleUrl from "../assets/brand/product-console.png";
import hourglassUrl from "../assets/brand/hourglass.png";
import documentUrl from "../assets/brand/document.png";
import scaleUrl from "../assets/brand/scale.png";
import legalSandUrl from "../assets/brand/legal-sand.png";

export const brandIcons = {
  productConsole: productConsoleUrl,
  hourglass: hourglassUrl,
  document: documentUrl,
  scale: scaleUrl,
  legalSand: legalSandUrl,
} as const;
