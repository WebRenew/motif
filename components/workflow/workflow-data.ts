import type { Node, Edge } from "@xyflow/react"

const DEFAULT_STYLESHEET_CONTENT = `@theme {
  /* Colors */
  --color-primary: oklch(0.70 0.20 180);
  --color-secondary: oklch(0.60 0.18 280);
  --color-accent: oklch(0.75 0.15 160);
  --color-background: oklch(0.12 0.03 240);
  --color-foreground: oklch(0.98 0.00 0);
  --color-muted: oklch(0.30 0.03 240);
  --color-muted-foreground: oklch(0.65 0.02 240);
  --color-card: oklch(0.18 0.03 240);
  --color-card-foreground: oklch(0.95 0.00 0);
  --color-border: oklch(0.25 0.03 240);
  --color-input: oklch(0.20 0.03 240);
  --color-ring: oklch(0.70 0.20 180);
  --color-destructive: oklch(0.60 0.20 20);
  --color-success: oklch(0.70 0.18 160);
  --color-warning: oklch(0.75 0.15 80);

  /* Typography */
  --font-sans: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'SF Mono', Monaco, 'Cascadia Code', 'Courier New', monospace;
  --font-serif: Georgia, Cambria, 'Times New Roman', Times, serif;

  /* Font Sizes */
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;
  --text-3xl: 1.875rem;
  --text-4xl: 2.5rem;
  --text-5xl: 4rem;

  /* Font Weights */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;

  /* Line Heights */
  --leading-tight: 1.2;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;

  /* Letter Spacing */
  --tracking-tight: -0.02em;
  --tracking-normal: 0;
  --tracking-wide: 0.025em;

  /* Spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
  --spacing-2xl: 3rem;
  --spacing-3xl: 4rem;
  --spacing-4xl: 6rem;

  /* Border Radius */
  --radius-none: 0;
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.3);
  --shadow-glow: 0 0 60px rgba(100, 200, 255, 0.4), 0 0 120px rgba(150, 100, 255, 0.3);

  /* Gradients */
  --gradient-hero-gradient: radial-gradient(ellipse at center, oklch(0.35 0.12 240) 0%, oklch(0.25 0.10 200) 30%, oklch(0.18 0.08 280) 60%, oklch(0.12 0.03 240) 100%);
  --gradient-glass-gradient: linear-gradient(135deg, oklch(0.22 0.05 240 / 0.8) 0%, oklch(0.18 0.04 240 / 0.6) 100%);
  --gradient-accent-gradient: linear-gradient(135deg, oklch(0.70 0.20 180) 0%, oklch(0.60 0.18 280) 50%, oklch(0.75 0.15 160) 100%);
  --gradient-mesh-gradient: radial-gradient(at 40% 50%, oklch(0.45 0.15 200) 0%, transparent 50%), radial-gradient(at 80% 60%, oklch(0.50 0.15 280) 0%, transparent 50%), radial-gradient(at 20% 40%, oklch(0.48 0.12 160) 0%, transparent 50%);
  --gradient-button-glow: radial-gradient(circle at center, oklch(1.00 0.00 0 / 1) 0%, oklch(1.00 0.00 0 / 0.95) 100%);
}`

export function createInitialNodes(
  seedHeroUrl?: string,
  integratedBioUrl?: string,
  combinedOutputUrl?: string,
): Node[] {
  return [
    {
      id: "input-1",
      type: "imageNode",
      position: { x: 0, y: 80 },
      data: {
        imageUrl: seedHeroUrl || "/placeholders/seed-hero.png",
        aspect: "landscape",
        isInput: true,
      },
    },
    {
      id: "input-2",
      type: "imageNode",
      position: { x: 0, y: 380 },
      data: {
        imageUrl: integratedBioUrl || "/placeholders/integrated-bio.png",
        aspect: "landscape",
        isInput: true,
      },
    },
    {
      id: "prompt-combine",
      type: "promptNode",
      position: { x: 500, y: 180 },
      data: {
        title: "Combine Styles",
        prompt: `Create a high-fidelity website hero mockup that fuses two distinct web aesthetics into a single cohesive design.
Cinematic, high-contrast visuals with depth, motion, and immersive lighting are balanced with playful minimal SaaS UI design, generous whitespace, rounded components, and clean typography.
Modern product website, premium yet approachable. Abstract UI elements, soft gradients, subtle glassmorphism, clean grid-based layout, strong visual hierarchy, editorial composition.
Single hero section, browser-width canvas. No logos, no screenshots, no real text. Focus on mood, spacing, texture, and rhythm.
Ultra-sharp, design-system-ready, 2025 web design, studio lighting, soft global illumination.`,
        model: "google/gemini-3-pro-image",
        outputType: "image",
        status: "idle",
      },
    },
    {
      id: "output-combined",
      type: "imageNode",
      position: { x: 880, y: 180 },
      data: {
        imageUrl: combinedOutputUrl || "",
        aspect: "landscape",
      },
    },
    {
      id: "prompt-stylesheet",
      type: "promptNode",
      position: { x: 1400, y: 180 },
      data: {
        title: "Generate Stylesheet",
        prompt:
          "Analyze this combined website design and generate a comprehensive CSS stylesheet that captures its visual language. Include: color variables (primary, secondary, accent, backgrounds, text), typography scale (font families, sizes, weights, line heights), spacing system, border radii, shadows, and any gradient definitions. Output as clean, well-organized CSS custom properties.",
        model: "anthropic/claude-sonnet-4-5",
        outputType: "text",
        status: "idle",
      },
    },
    {
      id: "output-stylesheet",
      type: "codeNode",
      position: { x: 1860, y: 180 },
      data: {
        content: DEFAULT_STYLESHEET_CONTENT,
        language: "css",
      },
    },
  ]
}

export const initialEdges: Edge[] = [
  {
    id: "e-input1-combine",
    source: "input-1",
    target: "prompt-combine",
    type: "curved",
  },
  {
    id: "e-input2-combine",
    source: "input-2",
    target: "prompt-combine",
    type: "curved",
  },
  {
    id: "e-combine-output",
    source: "prompt-combine",
    target: "output-combined",
    type: "curved",
  },
  {
    id: "e-output-stylesheet",
    source: "output-combined",
    target: "prompt-stylesheet",
    type: "curved",
  },
  {
    id: "e-stylesheet-output",
    source: "prompt-stylesheet",
    target: "output-stylesheet",
    type: "curved",
  },
]
