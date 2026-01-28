import type { Node, Edge } from "@xyflow/react"

// Workflow configurations for each tool
export function createComponentExtractorWorkflow(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [
      // Input
      {
        id: "input-design",
        type: "imageNode",
        position: { x: 50, y: 280 },
        data: {
          imageUrl: "",
          aspect: "landscape",
          isInput: true,
          label: "Upload Design",
        },
      },
      
      // Row 1: React Component
      {
        id: "prompt-extract",
        type: "promptNode",
        position: { x: 420, y: 50 },
        data: {
          title: "Extract Component",
          prompt: `Analyze this UI design and generate a production-ready React component:

Requirements:
- TypeScript with proper interface for props
- Semantic HTML elements (header, nav, main, section, article, etc.)
- Tailwind CSS utilities (no custom CSS)
- Responsive: mobile-first with sm:, md:, lg: breakpoints
- Accessibility: aria-labels, roles, alt text, focus states
- Modern React: functional component, proper hooks usage

Structure the component with:
1. Props interface at the top
2. Main component function
3. Default export

Match the design's layout, spacing, colors, and typography as closely as possible using Tailwind classes.`,
          model: "anthropic/claude-sonnet-4.5",
          outputType: "text",
          status: "idle",
        },
      },
      {
        id: "output-component",
        type: "codeNode",
        position: { x: 880, y: 50 },
        data: {
          content: "",
          language: "tsx",
          label: "Component.tsx",
        },
      },
      
      // Row 2: Storybook Story
      {
        id: "prompt-story",
        type: "promptNode",
        position: { x: 420, y: 330 },
        data: {
          title: "Generate Story",
          prompt: `Based on the UI design, generate a Storybook story file for testing and documentation:

Requirements:
- CSF 3.0 format (Component Story Format)
- Meta object with title, component, tags
- Default story showing the main state
- At least 2-3 variant stories (e.g., Loading, Empty, WithData)
- Args/argTypes for interactive controls
- Proper TypeScript typing

Example structure:
import type { Meta, StoryObj } from '@storybook/react'
import { ComponentName } from './ComponentName'

const meta: Meta<typeof ComponentName> = { ... }
export default meta

type Story = StoryObj<typeof ComponentName>

export const Default: Story = { ... }
export const Variant: Story = { ... }`,
          model: "anthropic/claude-sonnet-4.5",
          outputType: "text",
          status: "idle",
        },
      },
      {
        id: "output-story",
        type: "codeNode",
        position: { x: 880, y: 330 },
        data: {
          content: "",
          language: "tsx",
          label: "Component.stories.tsx",
        },
      },
    ],
    edges: [
      { id: "e-design-extract", source: "input-design", target: "prompt-extract", type: "curved" },
      { id: "e-design-story", source: "input-design", target: "prompt-story", type: "curved" },
      { id: "e-extract-code", source: "prompt-extract", target: "output-component", type: "curved" },
      { id: "e-story-output", source: "prompt-story", target: "output-story", type: "curved" },
    ],
  }
}

export function createColorPaletteWorkflow(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [
      // Input
      {
        id: "input-image",
        type: "imageNode",
        position: { x: 50, y: 280 },
        data: {
          imageUrl: "",
          aspect: "landscape",
          isInput: true,
          label: "Upload Image",
        },
      },
      
      // Row 1: CSS Variables
      {
        id: "prompt-css",
        type: "promptNode",
        position: { x: 420, y: 50 },
        data: {
          title: "CSS Variables",
          prompt: `Analyze this image and extract a comprehensive color palette as CSS custom properties:

Extract the dominant colors and generate:

:root {
  /* Primary palette - extracted from image */
  --color-primary: oklch(...);
  --color-primary-50: oklch(...);  /* lightest */
  --color-primary-100 through --color-primary-900;
  --color-primary-950: oklch(...); /* darkest */
  
  /* Secondary & Accent - complementary colors */
  --color-secondary: oklch(...);
  --color-accent: oklch(...);
  
  /* Semantic colors */
  --color-background: oklch(...);
  --color-foreground: oklch(...);
  --color-muted: oklch(...);
  --color-border: oklch(...);
  
  /* Status colors - harmonized with palette */
  --color-success: oklch(...);
  --color-warning: oklch(...);
  --color-error: oklch(...);
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  :root { ... }
}

Use oklch() for perceptually uniform color scales. Output ONLY valid CSS.`,
          model: "anthropic/claude-sonnet-4.5",
          outputType: "text",
          status: "idle",
        },
      },
      {
        id: "output-css",
        type: "codeNode",
        position: { x: 880, y: 50 },
        data: {
          content: "",
          language: "css",
          label: "CSS Variables",
        },
      },
      
      // Row 2: Design Tokens JSON (Figma-compatible)
      {
        id: "prompt-json",
        type: "promptNode",
        position: { x: 420, y: 330 },
        data: {
          title: "Design Tokens",
          prompt: `Analyze this image and extract colors as Design Tokens in Figma Variables format (JSON):

{
  "colors": {
    "primary": {
      "$type": "color",
      "$value": "#hexvalue",
      "$description": "Primary brand color"
    },
    "primary-50": { "$type": "color", "$value": "#..." },
    "primary-100": { "$type": "color", "$value": "#..." },
    ...
    "primary-900": { "$type": "color", "$value": "#..." },
    "secondary": { "$type": "color", "$value": "#..." },
    "accent": { "$type": "color", "$value": "#..." },
    "background": { "$type": "color", "$value": "#..." },
    "foreground": { "$type": "color", "$value": "#..." },
    "muted": { "$type": "color", "$value": "#..." },
    "border": { "$type": "color", "$value": "#..." },
    "success": { "$type": "color", "$value": "#..." },
    "warning": { "$type": "color", "$value": "#..." },
    "error": { "$type": "color", "$value": "#..." }
  }
}

Include both hex values and a description for each color explaining its intended use.
This format is compatible with Figma's Variables import. Output ONLY valid JSON.`,
          model: "anthropic/claude-sonnet-4.5",
          outputType: "text",
          status: "idle",
        },
      },
      {
        id: "output-json",
        type: "codeNode",
        position: { x: 880, y: 330 },
        data: {
          content: "",
          language: "json",
          label: "Design Tokens",
        },
      },
    ],
    edges: [
      { id: "e-image-css", source: "input-image", target: "prompt-css", type: "curved" },
      { id: "e-image-json", source: "input-image", target: "prompt-json", type: "curved" },
      { id: "e-css-output", source: "prompt-css", target: "output-css", type: "curved" },
      { id: "e-json-output", source: "prompt-json", target: "output-json", type: "curved" },
    ],
  }
}

export function createTypographyMatcherWorkflow(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [
      // Input
      {
        id: "input-design",
        type: "imageNode",
        position: { x: 50, y: 280 },
        data: {
          imageUrl: "",
          aspect: "landscape",
          isInput: true,
          label: "Upload Design",
        },
      },
      
      // Row 1: Font Analysis Report
      {
        id: "prompt-analysis",
        type: "promptNode",
        position: { x: 420, y: 50 },
        data: {
          title: "Font Analysis",
          prompt: `Analyze the typography in this design and create a detailed report in Markdown:

# Typography Analysis

## Identified Fonts

### Headings
- **Detected Font:** [name or "Custom/Unknown"]
- **Characteristics:** serif/sans-serif, weight, x-height, contrast
- **Google Fonts Match:** [exact or closest match]
- **Alternatives:** [2-3 similar options]

### Body Text
- **Detected Font:** [name]
- **Characteristics:** [describe]
- **Google Fonts Match:** [match]
- **Alternatives:** [options]

## Recommended Pairings

| Use Case | Font | Weight | Size |
|----------|------|--------|------|
| H1 | [font] | 700 | 48px |
| H2 | [font] | 600 | 36px |
| ... | ... | ... | ... |
| Body | [font] | 400 | 16px |
| Caption | [font] | 400 | 12px |

## Implementation

\`\`\`html
<link href="https://fonts.googleapis.com/css2?family=..." rel="stylesheet">
\`\`\`

## Visual Hierarchy Notes
- [Observations about how typography creates hierarchy]
- [Spacing relationships]
- [Color usage with type]`,
          model: "anthropic/claude-sonnet-4.5",
          outputType: "text",
          status: "idle",
        },
      },
      {
        id: "output-analysis",
        type: "codeNode",
        position: { x: 880, y: 50 },
        data: {
          content: "",
          language: "markdown",
          label: "Font Analysis",
        },
      },
      
      // Row 2: CSS Typography System
      {
        id: "prompt-css",
        type: "promptNode",
        position: { x: 420, y: 330 },
        data: {
          title: "Typography CSS",
          prompt: `Based on the typography in this design, generate a complete CSS type system:

/* Google Fonts import */
@import url('https://fonts.googleapis.com/css2?family=...');

:root {
  /* Font families */
  --font-heading: '[Google Font]', system-ui, sans-serif;
  --font-body: '[Google Font]', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  
  /* Font sizes - fluid scale */
  --text-xs: clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem);
  --text-sm: clamp(0.875rem, 0.8rem + 0.35vw, 1rem);
  --text-base: clamp(1rem, 0.9rem + 0.5vw, 1.125rem);
  --text-lg: clamp(1.125rem, 1rem + 0.6vw, 1.25rem);
  --text-xl: clamp(1.25rem, 1.1rem + 0.75vw, 1.5rem);
  --text-2xl: clamp(1.5rem, 1.25rem + 1.25vw, 2rem);
  --text-3xl: clamp(1.875rem, 1.5rem + 1.875vw, 2.5rem);
  --text-4xl: clamp(2.25rem, 1.75rem + 2.5vw, 3rem);
  
  /* Line heights */
  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;
  
  /* Letter spacing */
  --tracking-tight: -0.025em;
  --tracking-normal: 0;
  --tracking-wide: 0.025em;
}

/* Utility classes */
.heading-1 { font: 700 var(--text-4xl)/var(--leading-tight) var(--font-heading); }
.heading-2 { font: 600 var(--text-3xl)/var(--leading-tight) var(--font-heading); }
/* ... continue for all levels */

Output ONLY valid CSS.`,
          model: "anthropic/claude-sonnet-4.5",
          outputType: "text",
          status: "idle",
        },
      },
      {
        id: "output-css",
        type: "codeNode",
        position: { x: 880, y: 330 },
        data: {
          content: "",
          language: "css",
          label: "Typography CSS",
        },
      },
    ],
    edges: [
      { id: "e-design-analysis", source: "input-design", target: "prompt-analysis", type: "curved" },
      { id: "e-design-css", source: "input-design", target: "prompt-css", type: "curved" },
      { id: "e-analysis-output", source: "prompt-analysis", target: "output-analysis", type: "curved" },
      { id: "e-css-output", source: "prompt-css", target: "output-css", type: "curved" },
    ],
  }
}

export function createDesignCritiqueWorkflow(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [
      // Input
      {
        id: "input-ui",
        type: "imageNode",
        position: { x: 50, y: 280 },
        data: {
          imageUrl: "",
          aspect: "landscape",
          isInput: true,
          label: "Upload UI Screenshot",
        },
      },
      
      // Row 1: Detailed Critique
      {
        id: "prompt-critique",
        type: "promptNode",
        position: { x: 420, y: 50 },
        data: {
          title: "Design Critique",
          prompt: `Provide a professional design critique of this UI in Markdown:

# Design Critique

## Score: X/10

## Executive Summary
[2-3 sentence overview of the design's effectiveness]

## What's Working Well ✓
- [Specific strength with example from the design]
- [Another strength]
- [Keep doing this]

## Critical Issues ✗

### 1. [Issue Name] - Priority: High/Medium/Low
**Problem:** [Describe what's wrong]
**Impact:** [Why this matters for users]
**Fix:** [Specific actionable solution]

### 2. [Next Issue]
...

## Visual Hierarchy
- Current focal point: [what draws attention first]
- Recommended changes: [specific improvements]

## Spacing & Layout
- Grid consistency: [assessment]
- White space: [too much/too little/good]
- Alignment issues: [specific elements]

## Typography
- Readability score: [assessment]
- Issues: [font size, contrast, line length problems]

## Accessibility Audit
| Check | Status | Notes |
|-------|--------|-------|
| Color contrast | ✓/✗ | [details] |
| Touch targets (44px min) | ✓/✗ | [details] |
| Text size (16px min) | ✓/✗ | [details] |
| Focus indicators | ✓/✗ | [details] |

## Quick Wins (< 30 min to fix)
1. [Easy fix with big impact]
2. [Another quick improvement]
3. [Third quick win]`,
          model: "anthropic/claude-sonnet-4.5",
          outputType: "text",
          status: "idle",
        },
      },
      {
        id: "output-critique",
        type: "codeNode",
        position: { x: 880, y: 50 },
        data: {
          content: "",
          language: "markdown",
          label: "Design Critique",
        },
      },
      
      // Row 2: Improvement Checklist
      {
        id: "prompt-checklist",
        type: "promptNode",
        position: { x: 420, y: 330 },
        data: {
          title: "Action Checklist",
          prompt: `Analyze this UI and create an actionable improvement checklist in Markdown:

# UI Improvement Checklist

## Before You Start
- [ ] Take a screenshot of current state for comparison
- [ ] Review with stakeholders which issues to prioritize

---

## High Priority (Fix First)

### Layout & Structure
- [ ] [Specific task, e.g., "Increase padding around hero section to 64px"]
- [ ] [Another specific task]

### Typography
- [ ] [e.g., "Change body text from 14px to 16px for readability"]
- [ ] [e.g., "Reduce heading line-height from 1.8 to 1.3"]

### Color & Contrast
- [ ] [e.g., "Darken gray text #999 to #666 for WCAG AA compliance"]
- [ ] [specific color fixes]

---

## Medium Priority

### Visual Polish
- [ ] [specific improvement]
- [ ] [specific improvement]

### Consistency
- [ ] [e.g., "Standardize button border-radius to 8px across all instances"]
- [ ] [specific consistency fix]

---

## Low Priority (Nice to Have)

- [ ] [enhancement]
- [ ] [enhancement]

---

## Accessibility Fixes

- [ ] [specific a11y fix with implementation detail]
- [ ] [another a11y fix]

---

## Testing Checklist (After Fixes)
- [ ] Test on mobile (375px width)
- [ ] Test on tablet (768px width)  
- [ ] Run Lighthouse accessibility audit
- [ ] Test with keyboard navigation
- [ ] Verify color contrast with WebAIM tool

Be extremely specific - each item should be directly actionable without ambiguity.`,
          model: "anthropic/claude-sonnet-4.5",
          outputType: "text",
          status: "idle",
        },
      },
      {
        id: "output-checklist",
        type: "codeNode",
        position: { x: 880, y: 330 },
        data: {
          content: "",
          language: "markdown",
          label: "Action Checklist",
        },
      },
    ],
    edges: [
      { id: "e-ui-critique", source: "input-ui", target: "prompt-critique", type: "curved" },
      { id: "e-ui-checklist", source: "input-ui", target: "prompt-checklist", type: "curved" },
      { id: "e-critique-output", source: "prompt-critique", target: "output-critique", type: "curved" },
      { id: "e-checklist-output", source: "prompt-checklist", target: "output-checklist", type: "curved" },
    ],
  }
}

export function createBrandKitWorkflow(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [
      // Input
      {
        id: "input-logo",
        type: "imageNode",
        position: { x: 50, y: 300 },
        data: {
          imageUrl: "",
          aspect: "square",
          isInput: true,
          label: "Upload Logo",
        },
      },
      
      // Row 1: OG Image Generator
      {
        id: "prompt-og",
        type: "promptNode",
        position: { x: 420, y: 0 },
        data: {
          title: "Generate OG Image",
          prompt: `Create a professional Open Graph social sharing image (1200x630) for this brand:
- Feature the logo prominently but not too large (roughly 20-30% of space)
- Use brand colors extracted from the logo for background gradient or pattern
- Add subtle, sophisticated visual elements that complement the brand
- Leave space for potential text overlay (company name/tagline area)
- Modern, clean, premium aesthetic
- Should look great when shared on Twitter/LinkedIn/Facebook`,
          model: "google/gemini-3-pro-image",
          outputType: "image",
          status: "idle",
        },
      },
      {
        id: "output-og",
        type: "imageNode",
        position: { x: 880, y: 0 },
        data: {
          imageUrl: "",
          aspect: "landscape",
          label: "OG Image",
        },
      },
      
      // Row 2: Brand Style Guide
      {
        id: "prompt-guidelines",
        type: "promptNode",
        position: { x: 420, y: 280 },
        data: {
          title: "Brand Style Guide",
          prompt: `Analyze this logo and create a comprehensive Brand Style Guide in Markdown:

# Brand Style Guide

## Logo Usage
- Describe the logo's visual elements and meaning
- Minimum size recommendations (px and physical)
- Clear space requirements (measured in logo units)
- Approved background colors (light/dark usage)
- What NOT to do with the logo (distort, recolor, etc.)

## Color Palette
- Primary color (extracted from logo) with hex, RGB, HSL
- Secondary colors (complementary to primary)
- Accent color for CTAs and highlights
- Neutral palette (grays for text and backgrounds)
- Accessibility notes (contrast ratios)

## Typography
- Recommended heading font (Google Fonts suggestion)
- Recommended body font (pairing that works well)
- Font scale (h1-h6, body, small, caption sizes)
- Line height and letter spacing guidelines

## Voice & Tone
- 3-5 adjectives that describe the brand personality
- Writing style guidelines
- Example phrases that fit the brand

## Visual Style
- Photography style recommendations
- Iconography style (outlined, filled, rounded, etc.)
- Illustration style if applicable
- UI component style (rounded vs sharp, shadows, etc.)

Be specific and actionable. This should be a usable reference document.`,
          model: "anthropic/claude-sonnet-4.5",
          outputType: "text",
          status: "idle",
        },
      },
      {
        id: "output-guidelines",
        type: "codeNode",
        position: { x: 880, y: 280 },
        data: {
          content: "",
          language: "markdown",
          label: "Style Guide",
        },
      },
      
      // Row 3: Tailwind Config
      {
        id: "prompt-tailwind",
        type: "promptNode",
        position: { x: 420, y: 560 },
        data: {
          title: "Tailwind Theme",
          prompt: `Analyze this logo and generate a complete Tailwind CSS v4 theme configuration:

Generate CSS with @theme directive containing:

1. Colors (using oklch for better color manipulation):
   --color-primary: [extracted from logo]
   --color-primary-50 through --color-primary-950 (full scale)
   --color-secondary: [complementary color]
   --color-accent: [for CTAs, links]
   --color-background, --color-foreground
   --color-muted, --color-muted-foreground
   --color-card, --color-card-foreground
   --color-border, --color-input, --color-ring

2. Typography:
   --font-sans: [recommended Google Font stack]
   --font-heading: [if different from sans]
   
3. Spacing & Sizing:
   --radius-sm, --radius-md, --radius-lg (based on brand feel)
   
4. Effects:
   --shadow-sm, --shadow-md, --shadow-lg

Output ONLY valid CSS starting with @theme { and closing }. Include @import for Google Fonts at the top.`,
          model: "anthropic/claude-sonnet-4.5",
          outputType: "text",
          status: "idle",
        },
      },
      {
        id: "output-tailwind",
        type: "codeNode",
        position: { x: 880, y: 560 },
        data: {
          content: "",
          language: "css",
          label: "Tailwind Theme",
        },
      },
    ],
    edges: [
      // Logo connects to all three generators
      { id: "e-logo-og", source: "input-logo", target: "prompt-og", type: "curved" },
      { id: "e-logo-guidelines", source: "input-logo", target: "prompt-guidelines", type: "curved" },
      { id: "e-logo-tailwind", source: "input-logo", target: "prompt-tailwind", type: "curved" },
      // Outputs
      { id: "e-og-output", source: "prompt-og", target: "output-og", type: "curved" },
      { id: "e-guidelines-output", source: "prompt-guidelines", target: "output-guidelines", type: "curved" },
      { id: "e-tailwind-output", source: "prompt-tailwind", target: "output-tailwind", type: "curved" },
    ],
  }
}

export function createAnimationCaptureWorkflow(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [
      // Capture Node - handles URL input, capture process, and video output
      {
        id: "capture-animation",
        type: "captureNode",
        position: { x: 50, y: 200 },
        data: {
          url: "",
          selector: "",
          duration: 3,
          status: "idle",
          progress: 0,
          currentFrame: 0,
          totalFrames: 30,
        },
      },
      
      // Analysis Agent - figures out HOW the animation works
      {
        id: "prompt-analyze",
        type: "promptNode",
        position: { x: 450, y: 200 },
        data: {
          title: "Analyze Animation",
          prompt: `Analyze the captured animation data and provide a detailed technical breakdown:

1. **Animation Libraries Detected** - GSAP, Framer Motion, CSS animations, Lottie, etc.
2. **CSS Keyframes & Transitions** - The actual animation code found
3. **Timing & Easing** - Duration, delay, easing functions (cubic-bezier values)
4. **Transform Properties** - translate, scale, rotate, opacity, skew changes
5. **Animation Triggers** - On load, on scroll, on hover, on click
6. **Sequence & Stagger** - How multiple elements animate together
7. **Animation Behavior Summary** - What the animation does visually

Be specific with values so another developer can recreate this exactly.`,
          model: "anthropic/claude-sonnet-4.5",
          outputType: "text",
          status: "idle",
        },
      },
      
      // Analysis Findings Output
      {
        id: "output-analysis",
        type: "codeNode",
        position: { x: 900, y: 50 },
        data: {
          content: "",
          language: "markdown",
          label: "Animation Analysis",
          alwaysShowSourceHandle: true,
        },
      },
      
      // Recreate Agent - takes analysis and outputs components + prompt
      {
        id: "prompt-recreate",
        type: "promptNode",
        position: { x: 1300, y: 200 },
        data: {
          title: "Recreate Animation",
          prompt: `Based on the animation analysis, generate production-ready code to recreate this animation.

Output THREE separate code blocks:

1. **React Component** (TSX) - A reusable Framer Motion component
   - TypeScript with proper props interface
   - Framer Motion for animations
   - Comments explaining timing/easing choices
   - Configurable via props

2. **CSS Styles** (CSS) - Supporting styles if needed
   - CSS variables for customization
   - Keyframes for any CSS-only animations
   - Responsive considerations

3. **Recreation Prompt** (Markdown) - A prompt another AI agent could use
   - Detailed instructions to recreate this animation from scratch
   - Include timing values, easing curves, transform sequences
   - Reference the original visual behavior`,
          model: "anthropic/claude-sonnet-4.5",
          outputType: "text",
          status: "idle",
        },
      },
      
      // Output 1: React Component
      {
        id: "output-component",
        type: "codeNode",
        position: { x: 1750, y: 50 },
        data: {
          content: "",
          language: "tsx",
          label: "AnimatedComponent.tsx",
        },
      },
      
      // Output 2: CSS Styles
      {
        id: "output-css",
        type: "codeNode",
        position: { x: 1750, y: 200 },
        data: {
          content: "",
          language: "css",
          label: "animation.css",
        },
      },
      
      // Output 3: Recreation Prompt for other agents
      {
        id: "output-prompt",
        type: "codeNode",
        position: { x: 1750, y: 350 },
        data: {
          content: "",
          language: "markdown",
          label: "Recreation Prompt",
        },
      },
    ],
    edges: [
      // Capture → Analyze Agent
      { id: "e-capture-analyze", source: "capture-animation", target: "prompt-analyze", type: "curved" },
      // Analyze Agent → Analysis Findings (MD)
      { id: "e-analyze-output", source: "prompt-analyze", target: "output-analysis", type: "curved" },
      // Analysis Findings → Recreate Agent
      { id: "e-analysis-recreate", source: "output-analysis", target: "prompt-recreate", type: "curved" },
      // Recreate Agent → Multiple Outputs
      { id: "e-recreate-component", source: "prompt-recreate", target: "output-component", type: "curved" },
      { id: "e-recreate-css", source: "prompt-recreate", target: "output-css", type: "curved" },
      { id: "e-recreate-prompt", source: "prompt-recreate", target: "output-prompt", type: "curved" },
    ],
  }
}

// ============================================
// BRANDING WORKFLOWS
// ============================================

export function createLogoVariationsWorkflow(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [
      {
        id: "input-logo",
        type: "imageNode",
        position: { x: 50, y: 200 },
        data: {
          imageUrl: "",
          aspect: "square",
          isInput: true,
          label: "Upload Logo",
        },
      },
      {
        id: "prompt-variations",
        type: "promptNode",
        position: { x: 420, y: 50 },
        data: {
          title: "Color Variations",
          prompt: `Generate logo color variations based on the uploaded logo:

Create 4 variations:
1. Monochrome black version
2. Monochrome white version (on dark background)
3. Inverted/negative version
4. Grayscale version

Maintain the exact shape, proportions, and design elements of the original logo.
Each variation should be production-ready for different use cases (print, digital, dark mode, etc.)`,
          model: "google/gemini-2.0-flash-exp:free",
          outputType: "image",
          status: "idle",
        },
      },
      {
        id: "output-mono",
        type: "imageNode",
        position: { x: 880, y: 50 },
        data: {
          imageUrl: "",
          aspect: "square",
          label: "Monochrome Variations",
        },
      },
      {
        id: "prompt-brand-colors",
        type: "promptNode",
        position: { x: 420, y: 350 },
        data: {
          title: "Brand Color Variations",
          prompt: `Generate logo variations in different brand color schemes:

Create 3 variations:
1. Primary brand color version (analyze the original and suggest a primary)
2. Secondary/complementary color version
3. Accent/highlight color version

Keep the exact logo shape but apply different cohesive color treatments.
Each should feel like part of a unified brand system.`,
          model: "google/gemini-2.0-flash-exp:free",
          outputType: "image",
          status: "idle",
        },
      },
      {
        id: "output-colors",
        type: "imageNode",
        position: { x: 880, y: 350 },
        data: {
          imageUrl: "",
          aspect: "square",
          label: "Color Variations",
        },
      },
    ],
    edges: [
      { id: "e-logo-mono", source: "input-logo", target: "prompt-variations", type: "curved" },
      { id: "e-mono-output", source: "prompt-variations", target: "output-mono", type: "curved" },
      { id: "e-logo-colors", source: "input-logo", target: "prompt-brand-colors", type: "curved" },
      { id: "e-colors-output", source: "prompt-brand-colors", target: "output-colors", type: "curved" },
    ],
  }
}

export function createBrandStyleGuideWorkflow(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [
      {
        id: "input-brand",
        type: "imageNode",
        position: { x: 50, y: 280 },
        data: {
          imageUrl: "",
          aspect: "landscape",
          isInput: true,
          label: "Upload Brand Assets",
        },
      },
      {
        id: "prompt-colors",
        type: "promptNode",
        position: { x: 420, y: 50 },
        data: {
          title: "Extract Brand Colors",
          prompt: `Analyze the brand assets and create a comprehensive color specification:

Generate CSS custom properties for:
- Primary brand colors (with full shade scale 50-950)
- Secondary colors
- Accent colors
- Neutral/gray scale
- Semantic colors (success, warning, error, info)

Use oklch() color format for modern color space support.
Include comments explaining each color's intended usage.`,
          model: "anthropic/claude-sonnet-4.5",
          outputType: "text",
          status: "idle",
        },
      },
      {
        id: "output-colors",
        type: "codeNode",
        position: { x: 880, y: 50 },
        data: {
          content: "",
          language: "css",
          label: "brand-colors.css",
        },
      },
      {
        id: "prompt-typography",
        type: "promptNode",
        position: { x: 420, y: 280 },
        data: {
          title: "Typography System",
          prompt: `Analyze the brand assets and create a typography specification:

Include:
- Primary font family recommendations (with Google Fonts alternatives)
- Heading styles (h1-h6) with sizes, weights, line-heights
- Body text styles
- Caption/small text styles
- Font scale using a consistent ratio

Output as Tailwind CSS theme extension or CSS custom properties.
Include usage guidelines as comments.`,
          model: "anthropic/claude-sonnet-4.5",
          outputType: "text",
          status: "idle",
        },
      },
      {
        id: "output-typography",
        type: "codeNode",
        position: { x: 880, y: 280 },
        data: {
          content: "",
          language: "css",
          label: "typography.css",
        },
      },
      {
        id: "prompt-guidelines",
        type: "promptNode",
        position: { x: 420, y: 510 },
        data: {
          title: "Usage Guidelines",
          prompt: `Create comprehensive brand usage guidelines in Markdown:

Include sections for:
1. Logo Usage
   - Minimum size requirements
   - Clear space rules
   - Do's and Don'ts
   
2. Color Usage
   - When to use each color
   - Accessibility considerations (contrast ratios)
   - Color combinations to avoid
   
3. Typography Usage
   - Heading hierarchy
   - Body text guidelines
   - Font pairing rules
   
4. Spacing & Layout
   - Recommended spacing scale
   - Grid system suggestions
   - Component spacing guidelines`,
          model: "anthropic/claude-sonnet-4.5",
          outputType: "text",
          status: "idle",
        },
      },
      {
        id: "output-guidelines",
        type: "codeNode",
        position: { x: 880, y: 510 },
        data: {
          content: "",
          language: "markdown",
          label: "brand-guidelines.md",
        },
      },
    ],
    edges: [
      { id: "e-brand-colors", source: "input-brand", target: "prompt-colors", type: "curved" },
      { id: "e-colors-output", source: "prompt-colors", target: "output-colors", type: "curved" },
      { id: "e-brand-typography", source: "input-brand", target: "prompt-typography", type: "curved" },
      { id: "e-typography-output", source: "prompt-typography", target: "output-typography", type: "curved" },
      { id: "e-brand-guidelines", source: "input-brand", target: "prompt-guidelines", type: "curved" },
      { id: "e-guidelines-output", source: "prompt-guidelines", target: "output-guidelines", type: "curved" },
    ],
  }
}

export function createSocialMediaKitWorkflow(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [
      {
        id: "input-brand",
        type: "imageNode",
        position: { x: 50, y: 280 },
        data: {
          imageUrl: "",
          aspect: "square",
          isInput: true,
          label: "Upload Logo/Brand Image",
        },
      },
      {
        id: "prompt-instagram",
        type: "promptNode",
        position: { x: 420, y: 50 },
        data: {
          title: "Instagram Assets",
          prompt: `Generate Instagram-optimized brand assets:

Create:
1. Profile picture (1:1 square, 320x320px optimized)
2. Post template (1:1 square, 1080x1080px)
3. Story template (9:16 vertical, 1080x1920px)

Keep the brand identity consistent.
Use the brand colors and style from the uploaded image.
Make them clean and professional with proper safe zones for text.`,
          model: "google/gemini-2.0-flash-exp:free",
          outputType: "image",
          status: "idle",
        },
      },
      {
        id: "output-instagram",
        type: "imageNode",
        position: { x: 880, y: 50 },
        data: {
          imageUrl: "",
          aspect: "square",
          label: "Instagram Assets",
        },
      },
      {
        id: "prompt-twitter",
        type: "promptNode",
        position: { x: 420, y: 280 },
        data: {
          title: "Twitter/X Assets",
          prompt: `Generate Twitter/X-optimized brand assets:

Create:
1. Profile picture (1:1 square, 400x400px)
2. Header/banner image (3:1 ratio, 1500x500px)
3. Post image template (16:9 ratio, 1200x675px)

Maintain brand consistency with the uploaded image.
Header should have safe zones for profile picture overlay.
Clean, professional look that works on both light and dark modes.`,
          model: "google/gemini-2.0-flash-exp:free",
          outputType: "image",
          status: "idle",
        },
      },
      {
        id: "output-twitter",
        type: "imageNode",
        position: { x: 880, y: 280 },
        data: {
          imageUrl: "",
          aspect: "landscape",
          label: "Twitter/X Assets",
        },
      },
      {
        id: "prompt-linkedin",
        type: "promptNode",
        position: { x: 420, y: 510 },
        data: {
          title: "LinkedIn Assets",
          prompt: `Generate LinkedIn-optimized brand assets:

Create:
1. Company logo (1:1 square, 300x300px)
2. Cover/banner image (4:1 ratio, 1584x396px)
3. Post image template (1.91:1 ratio, 1200x628px)

Professional, corporate-appropriate design.
Maintain brand identity from uploaded image.
Include safe zones for text overlays.`,
          model: "google/gemini-2.0-flash-exp:free",
          outputType: "image",
          status: "idle",
        },
      },
      {
        id: "output-linkedin",
        type: "imageNode",
        position: { x: 880, y: 510 },
        data: {
          imageUrl: "",
          aspect: "landscape",
          label: "LinkedIn Assets",
        },
      },
    ],
    edges: [
      { id: "e-brand-instagram", source: "input-brand", target: "prompt-instagram", type: "curved" },
      { id: "e-instagram-output", source: "prompt-instagram", target: "output-instagram", type: "curved" },
      { id: "e-brand-twitter", source: "input-brand", target: "prompt-twitter", type: "curved" },
      { id: "e-twitter-output", source: "prompt-twitter", target: "output-twitter", type: "curved" },
      { id: "e-brand-linkedin", source: "input-brand", target: "prompt-linkedin", type: "curved" },
      { id: "e-linkedin-output", source: "prompt-linkedin", target: "output-linkedin", type: "curved" },
    ],
  }
}

export function createBrandColorExpanderWorkflow(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [
      {
        id: "input-color",
        type: "imageNode",
        position: { x: 50, y: 200 },
        data: {
          imageUrl: "",
          aspect: "square",
          isInput: true,
          label: "Upload Brand Color Sample",
        },
      },
      {
        id: "prompt-complementary",
        type: "promptNode",
        position: { x: 420, y: 50 },
        data: {
          title: "Complementary Palette",
          prompt: `Analyze the brand color and generate a complementary color palette:

Extract the dominant color and create:
1. The original brand color
2. Its direct complement (opposite on color wheel)
3. Split-complementary colors (adjacent to complement)

Show as a cohesive palette swatch visualization.
Colors should work harmoniously together for brand applications.`,
          model: "google/gemini-2.0-flash-exp:free",
          outputType: "image",
          status: "idle",
        },
      },
      {
        id: "output-complementary",
        type: "imageNode",
        position: { x: 880, y: 50 },
        data: {
          imageUrl: "",
          aspect: "landscape",
          label: "Complementary Palette",
        },
      },
      {
        id: "prompt-analogous",
        type: "promptNode",
        position: { x: 420, y: 280 },
        data: {
          title: "Analogous Palette",
          prompt: `Generate an analogous color palette from the brand color:

Create a harmonious palette using colors adjacent on the color wheel:
1. Original brand color (center)
2. Two colors on each side (30° increments)

Show as elegant palette swatches.
These colors create a cohesive, unified look for brand materials.`,
          model: "google/gemini-2.0-flash-exp:free",
          outputType: "image",
          status: "idle",
        },
      },
      {
        id: "output-analogous",
        type: "imageNode",
        position: { x: 880, y: 280 },
        data: {
          imageUrl: "",
          aspect: "landscape",
          label: "Analogous Palette",
        },
      },
      {
        id: "prompt-css",
        type: "promptNode",
        position: { x: 420, y: 510 },
        data: {
          title: "CSS Color System",
          prompt: `Analyze the brand color and generate a complete CSS color system:

Create CSS custom properties with:
1. Primary color scale (50-950 shades)
2. Complementary color scale
3. Analogous accent colors
4. Neutral gray scale derived from brand color (slightly tinted)

Use oklch() format for all colors.
Include semantic color mappings (success, warning, error, info).`,
          model: "anthropic/claude-sonnet-4.5",
          outputType: "text",
          status: "idle",
        },
      },
      {
        id: "output-css",
        type: "codeNode",
        position: { x: 880, y: 510 },
        data: {
          content: "",
          language: "css",
          label: "color-system.css",
        },
      },
    ],
    edges: [
      { id: "e-color-comp", source: "input-color", target: "prompt-complementary", type: "curved" },
      { id: "e-comp-output", source: "prompt-complementary", target: "output-complementary", type: "curved" },
      { id: "e-color-analog", source: "input-color", target: "prompt-analogous", type: "curved" },
      { id: "e-analog-output", source: "prompt-analogous", target: "output-analogous", type: "curved" },
      { id: "e-color-css", source: "input-color", target: "prompt-css", type: "curved" },
      { id: "e-css-output", source: "prompt-css", target: "output-css", type: "curved" },
    ],
  }
}

// ============================================
// FASHION WORKFLOWS
// ============================================

export function createOutfitColorMatcherWorkflow(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [
      {
        id: "input-clothing",
        type: "imageNode",
        position: { x: 50, y: 200 },
        data: {
          imageUrl: "",
          aspect: "portrait",
          isInput: true,
          label: "Upload Clothing Item",
        },
      },
      {
        id: "prompt-complement",
        type: "promptNode",
        position: { x: 420, y: 50 },
        data: {
          title: "Complementary Pieces",
          prompt: `Analyze this clothing item and suggest complementary pieces:

Generate an image showing:
1. The original item (simplified)
2. 3-4 complementary clothing pieces that would pair well
3. Color swatches showing why these colors work together

Consider:
- Color harmony (complementary, analogous, triadic)
- Style consistency (casual, formal, streetwear, etc.)
- Seasonal appropriateness

Layout as a stylish outfit mood board.`,
          model: "google/gemini-2.0-flash-exp:free",
          outputType: "image",
          status: "idle",
        },
      },
      {
        id: "output-complement",
        type: "imageNode",
        position: { x: 880, y: 50 },
        data: {
          imageUrl: "",
          aspect: "square",
          label: "Complementary Pieces",
        },
      },
      {
        id: "prompt-palette",
        type: "promptNode",
        position: { x: 420, y: 350 },
        data: {
          title: "Outfit Color Palette",
          prompt: `Extract the color palette from this clothing item and suggest outfit combinations:

Generate a fashion color guide showing:
1. Main color extracted from the item
2. Neutral colors that pair well (white, black, gray, beige, navy)
3. Accent colors for accessories
4. Colors to avoid with this piece

Present as an elegant color palette card suitable for fashion reference.`,
          model: "google/gemini-2.0-flash-exp:free",
          outputType: "image",
          status: "idle",
        },
      },
      {
        id: "output-palette",
        type: "imageNode",
        position: { x: 880, y: 350 },
        data: {
          imageUrl: "",
          aspect: "landscape",
          label: "Color Palette Guide",
        },
      },
    ],
    edges: [
      { id: "e-clothing-complement", source: "input-clothing", target: "prompt-complement", type: "curved" },
      { id: "e-complement-output", source: "prompt-complement", target: "output-complement", type: "curved" },
      { id: "e-clothing-palette", source: "input-clothing", target: "prompt-palette", type: "curved" },
      { id: "e-palette-output", source: "prompt-palette", target: "output-palette", type: "curved" },
    ],
  }
}

export function createPatternGeneratorWorkflow(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [
      {
        id: "input-inspiration",
        type: "imageNode",
        position: { x: 50, y: 200 },
        data: {
          imageUrl: "",
          aspect: "square",
          isInput: true,
          label: "Upload Inspiration Image",
        },
      },
      {
        id: "prompt-seamless",
        type: "promptNode",
        position: { x: 420, y: 50 },
        data: {
          title: "Seamless Pattern",
          prompt: `Create a seamless repeating pattern inspired by this image:

Generate a tileable pattern that:
1. Captures the essence/mood of the inspiration image
2. Uses a similar color palette
3. Is truly seamless (edges match perfectly when tiled)
4. Works for textile/fabric printing

The pattern should be sophisticated and suitable for fashion applications.
Show as a single tile that would repeat seamlessly.`,
          model: "google/gemini-2.0-flash-exp:free",
          outputType: "image",
          status: "idle",
        },
      },
      {
        id: "output-seamless",
        type: "imageNode",
        position: { x: 880, y: 50 },
        data: {
          imageUrl: "",
          aspect: "square",
          label: "Seamless Pattern Tile",
        },
      },
      {
        id: "prompt-variations",
        type: "promptNode",
        position: { x: 420, y: 350 },
        data: {
          title: "Pattern Variations",
          prompt: `Create pattern color variations based on the inspiration image:

Generate 4 colorway variations of a pattern:
1. Original colorway (from inspiration)
2. Monochromatic version
3. Complementary color scheme
4. Neutral/muted version

Each variation should maintain the same pattern structure but with different color treatments.
Suitable for fashion collections offering multiple colorways.`,
          model: "google/gemini-2.0-flash-exp:free",
          outputType: "image",
          status: "idle",
        },
      },
      {
        id: "output-variations",
        type: "imageNode",
        position: { x: 880, y: 350 },
        data: {
          imageUrl: "",
          aspect: "landscape",
          label: "Pattern Colorways",
        },
      },
    ],
    edges: [
      { id: "e-inspo-seamless", source: "input-inspiration", target: "prompt-seamless", type: "curved" },
      { id: "e-seamless-output", source: "prompt-seamless", target: "output-seamless", type: "curved" },
      { id: "e-inspo-variations", source: "input-inspiration", target: "prompt-variations", type: "curved" },
      { id: "e-variations-output", source: "prompt-variations", target: "output-variations", type: "curved" },
    ],
  }
}

export function createLookbookCreatorWorkflow(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [
      {
        id: "input-product",
        type: "imageNode",
        position: { x: 50, y: 200 },
        data: {
          imageUrl: "",
          aspect: "portrait",
          isInput: true,
          label: "Upload Product Photo",
        },
      },
      {
        id: "prompt-editorial",
        type: "promptNode",
        position: { x: 420, y: 50 },
        data: {
          title: "Editorial Composition",
          prompt: `Transform this product photo into an editorial lookbook image:

Create a high-fashion editorial composition featuring the product:
1. Professional lighting and composition
2. Lifestyle context (appropriate setting/background)
3. Elegant styling with complementary props
4. Magazine-quality aesthetic

The image should feel like it belongs in a high-end fashion publication.
Maintain the product as the hero while elevating the presentation.`,
          model: "google/gemini-2.0-flash-exp:free",
          outputType: "image",
          status: "idle",
        },
      },
      {
        id: "output-editorial",
        type: "imageNode",
        position: { x: 880, y: 50 },
        data: {
          imageUrl: "",
          aspect: "portrait",
          label: "Editorial Shot",
        },
      },
      {
        id: "prompt-flatlay",
        type: "promptNode",
        position: { x: 420, y: 350 },
        data: {
          title: "Flat Lay Composition",
          prompt: `Create a stylish flat lay composition featuring this product:

Generate a top-down flat lay image with:
1. The main product prominently featured
2. Complementary accessories and styling props
3. Clean, minimal background (white, marble, or wood)
4. Perfect arrangement with intentional negative space

Style should be Instagram-worthy, suitable for social media marketing.
Include subtle shadows for depth and realism.`,
          model: "google/gemini-2.0-flash-exp:free",
          outputType: "image",
          status: "idle",
        },
      },
      {
        id: "output-flatlay",
        type: "imageNode",
        position: { x: 880, y: 350 },
        data: {
          imageUrl: "",
          aspect: "square",
          label: "Flat Lay Shot",
        },
      },
    ],
    edges: [
      { id: "e-product-editorial", source: "input-product", target: "prompt-editorial", type: "curved" },
      { id: "e-editorial-output", source: "prompt-editorial", target: "output-editorial", type: "curved" },
      { id: "e-product-flatlay", source: "input-product", target: "prompt-flatlay", type: "curved" },
      { id: "e-flatlay-output", source: "prompt-flatlay", target: "output-flatlay", type: "curved" },
    ],
  }
}

// ============================================
// DESIGN WORKFLOWS
// ============================================

export function createMoodBoardWorkflow(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [
      {
        id: "input-reference",
        type: "imageNode",
        position: { x: 50, y: 200 },
        data: {
          imageUrl: "",
          aspect: "landscape",
          isInput: true,
          label: "Upload Reference Images",
        },
      },
      {
        id: "prompt-moodboard",
        type: "promptNode",
        position: { x: 420, y: 50 },
        data: {
          title: "Generate Mood Board",
          prompt: `Create a cohesive mood board inspired by this reference:

Generate a professional mood board that includes:
1. Color palette swatches extracted from the reference
2. Texture/material samples that complement the aesthetic
3. Typography suggestions (shown as sample text)
4. Supporting imagery that reinforces the mood
5. Layout with clean grid arrangement

The mood board should communicate a clear visual direction.
Style: modern, minimal presentation suitable for client presentations.`,
          model: "google/gemini-2.0-flash-exp:free",
          outputType: "image",
          status: "idle",
        },
      },
      {
        id: "output-moodboard",
        type: "imageNode",
        position: { x: 880, y: 50 },
        data: {
          imageUrl: "",
          aspect: "landscape",
          label: "Mood Board",
        },
      },
      {
        id: "prompt-tokens",
        type: "promptNode",
        position: { x: 420, y: 350 },
        data: {
          title: "Design Tokens",
          prompt: `Extract design tokens from this reference image:

Generate a comprehensive design token file including:
- Color tokens (primary, secondary, accent, neutrals)
- Typography tokens (font families, sizes, weights, line heights)
- Spacing scale (4px base unit system)
- Border radius values
- Shadow definitions

Output as JSON design tokens compatible with Style Dictionary.
Include semantic naming for easy implementation.`,
          model: "anthropic/claude-sonnet-4.5",
          outputType: "text",
          status: "idle",
        },
      },
      {
        id: "output-tokens",
        type: "codeNode",
        position: { x: 880, y: 350 },
        data: {
          content: "",
          language: "json",
          label: "design-tokens.json",
        },
      },
    ],
    edges: [
      { id: "e-ref-moodboard", source: "input-reference", target: "prompt-moodboard", type: "curved" },
      { id: "e-moodboard-output", source: "prompt-moodboard", target: "output-moodboard", type: "curved" },
      { id: "e-ref-tokens", source: "input-reference", target: "prompt-tokens", type: "curved" },
      { id: "e-tokens-output", source: "prompt-tokens", target: "output-tokens", type: "curved" },
    ],
  }
}

export function createUIComponentExtractorWorkflow(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [
      {
        id: "input-ui",
        type: "imageNode",
        position: { x: 50, y: 280 },
        data: {
          imageUrl: "",
          aspect: "landscape",
          isInput: true,
          label: "Upload UI Screenshot",
        },
      },
      {
        id: "prompt-button",
        type: "promptNode",
        position: { x: 420, y: 50 },
        data: {
          title: "Extract Buttons",
          prompt: `Extract and recreate all button styles from this UI:

Generate React components for:
1. Primary button
2. Secondary button
3. Ghost/text button
4. Icon button (if present)

Each button should include:
- All states (default, hover, active, disabled)
- Proper TypeScript props interface
- Tailwind CSS styling matching the original
- Size variants (sm, md, lg)`,
          model: "anthropic/claude-sonnet-4.5",
          outputType: "text",
          status: "idle",
        },
      },
      {
        id: "output-button",
        type: "codeNode",
        position: { x: 880, y: 50 },
        data: {
          content: "",
          language: "tsx",
          label: "Button.tsx",
        },
      },
      {
        id: "prompt-card",
        type: "promptNode",
        position: { x: 420, y: 280 },
        data: {
          title: "Extract Cards",
          prompt: `Extract and recreate card components from this UI:

Generate React components for card patterns visible:
1. Basic card with padding and border
2. Card with header/body/footer sections
3. Interactive card (if hover states visible)

Include:
- TypeScript props for customization
- Tailwind CSS matching the exact shadows, borders, radius
- Responsive behavior
- Composable sub-components (CardHeader, CardContent, etc.)`,
          model: "anthropic/claude-sonnet-4.5",
          outputType: "text",
          status: "idle",
        },
      },
      {
        id: "output-card",
        type: "codeNode",
        position: { x: 880, y: 280 },
        data: {
          content: "",
          language: "tsx",
          label: "Card.tsx",
        },
      },
      {
        id: "prompt-inputs",
        type: "promptNode",
        position: { x: 420, y: 510 },
        data: {
          title: "Extract Form Inputs",
          prompt: `Extract and recreate form input components from this UI:

Generate React components for:
1. Text input
2. Select/dropdown (if present)
3. Checkbox/radio (if present)
4. Form labels and error states

Include:
- Full TypeScript typing
- Tailwind CSS matching exact styles
- All states (focus, error, disabled)
- Accessible markup with proper ARIA`,
          model: "anthropic/claude-sonnet-4.5",
          outputType: "text",
          status: "idle",
        },
      },
      {
        id: "output-inputs",
        type: "codeNode",
        position: { x: 880, y: 510 },
        data: {
          content: "",
          language: "tsx",
          label: "FormInputs.tsx",
        },
      },
    ],
    edges: [
      { id: "e-ui-button", source: "input-ui", target: "prompt-button", type: "curved" },
      { id: "e-button-output", source: "prompt-button", target: "output-button", type: "curved" },
      { id: "e-ui-card", source: "input-ui", target: "prompt-card", type: "curved" },
      { id: "e-card-output", source: "prompt-card", target: "output-card", type: "curved" },
      { id: "e-ui-inputs", source: "input-ui", target: "prompt-inputs", type: "curved" },
      { id: "e-inputs-output", source: "prompt-inputs", target: "output-inputs", type: "curved" },
    ],
  }
}

export function createDesignSystemStarterWorkflow(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [
      {
        id: "input-brand",
        type: "imageNode",
        position: { x: 50, y: 280 },
        data: {
          imageUrl: "",
          aspect: "landscape",
          isInput: true,
          label: "Upload Brand Assets",
        },
      },
      {
        id: "prompt-tokens",
        type: "promptNode",
        position: { x: 420, y: 50 },
        data: {
          title: "Design Tokens",
          prompt: `Create a complete design token system from this brand:

Generate design-tokens.json with:
1. Colors - Primary, secondary, accent, semantic, neutrals (all with scales)
2. Typography - Font families, sizes, weights, line heights
3. Spacing - 4px base unit scale (0-96)
4. Border radius - sm, md, lg, full
5. Shadows - sm, md, lg, xl
6. Breakpoints - sm, md, lg, xl, 2xl

Use the brand's visual identity to inform all decisions.
Format compatible with Style Dictionary or Tailwind config.`,
          model: "anthropic/claude-sonnet-4.5",
          outputType: "text",
          status: "idle",
        },
      },
      {
        id: "output-tokens",
        type: "codeNode",
        position: { x: 880, y: 50 },
        data: {
          content: "",
          language: "json",
          label: "design-tokens.json",
        },
      },
      {
        id: "prompt-tailwind",
        type: "promptNode",
        position: { x: 420, y: 280 },
        data: {
          title: "Tailwind Config",
          prompt: `Generate a Tailwind CSS configuration based on the brand:

Create tailwind.config.js with:
- Extended colors matching brand palette
- Custom font families
- Extended spacing if needed
- Custom border radius values
- Box shadow definitions
- Animation/keyframe definitions if applicable

Include semantic color aliases (background, foreground, muted, etc.)
Compatible with Tailwind v4 theme inline syntax.`,
          model: "anthropic/claude-sonnet-4.5",
          outputType: "text",
          status: "idle",
        },
      },
      {
        id: "output-tailwind",
        type: "codeNode",
        position: { x: 880, y: 280 },
        data: {
          content: "",
          language: "javascript",
          label: "tailwind.config.js",
        },
      },
      {
        id: "prompt-components",
        type: "promptNode",
        position: { x: 420, y: 510 },
        data: {
          title: "Base Components",
          prompt: `Generate starter React components styled for this brand:

Create a components file with:
1. Button - primary, secondary, ghost variants
2. Card - basic card with header, body, footer
3. Badge - for status/tags
4. Avatar - with fallback

Each component should:
- Use Tailwind CSS with the brand's design tokens
- Include TypeScript props
- Support size variants
- Be accessible (ARIA, focus states)

Follow shadcn/ui patterns for consistency.`,
          model: "anthropic/claude-sonnet-4.5",
          outputType: "text",
          status: "idle",
        },
      },
      {
        id: "output-components",
        type: "codeNode",
        position: { x: 880, y: 510 },
        data: {
          content: "",
          language: "tsx",
          label: "components.tsx",
        },
      },
    ],
    edges: [
      { id: "e-brand-tokens", source: "input-brand", target: "prompt-tokens", type: "curved" },
      { id: "e-tokens-output", source: "prompt-tokens", target: "output-tokens", type: "curved" },
      { id: "e-brand-tailwind", source: "input-brand", target: "prompt-tailwind", type: "curved" },
      { id: "e-tailwind-output", source: "prompt-tailwind", target: "output-tailwind", type: "curved" },
      { id: "e-brand-components", source: "input-brand", target: "prompt-components", type: "curved" },
      { id: "e-components-output", source: "prompt-components", target: "output-components", type: "curved" },
    ],
  }
}

export function createThumbnailHeroWorkflow(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [
      {
        id: "input-product",
        type: "imageNode",
        position: { x: 50, y: 200 },
        data: {
          imageUrl: "",
          aspect: "square",
          isInput: true,
          label: "Upload Product Image",
        },
      },
      {
        id: "prompt-hero",
        type: "promptNode",
        position: { x: 420, y: 50 },
        data: {
          title: "Hero Image",
          prompt: `Create a marketing hero image featuring this product:

Generate a stunning hero/banner image (16:9 ratio) with:
1. Product prominently featured
2. Professional studio-quality lighting
3. Clean gradient or lifestyle background
4. Space on left or right for text overlay
5. Modern, premium aesthetic

The image should be suitable for:
- Website hero sections
- Email headers
- Ad banners

Make it eye-catching and conversion-focused.`,
          model: "google/gemini-2.0-flash-exp:free",
          outputType: "image",
          status: "idle",
        },
      },
      {
        id: "output-hero",
        type: "imageNode",
        position: { x: 880, y: 50 },
        data: {
          imageUrl: "",
          aspect: "landscape",
          label: "Hero Banner",
        },
      },
      {
        id: "prompt-thumbnail",
        type: "promptNode",
        position: { x: 420, y: 350 },
        data: {
          title: "Product Thumbnails",
          prompt: `Create clean product thumbnails for e-commerce:

Generate product images (1:1 square) with:
1. Pure white background (e-commerce standard)
2. Consistent lighting and shadows
3. Product centered with proper padding
4. Multiple angles if possible (front, side, detail)

These should meet marketplace standards:
- Amazon, Shopify, etc. compatible
- Clean, professional, distraction-free
- Optimized for small display sizes`,
          model: "google/gemini-2.0-flash-exp:free",
          outputType: "image",
          status: "idle",
        },
      },
      {
        id: "output-thumbnail",
        type: "imageNode",
        position: { x: 880, y: 350 },
        data: {
          imageUrl: "",
          aspect: "square",
          label: "Product Thumbnails",
        },
      },
    ],
    edges: [
      { id: "e-product-hero", source: "input-product", target: "prompt-hero", type: "curved" },
      { id: "e-hero-output", source: "prompt-hero", target: "output-hero", type: "curved" },
      { id: "e-product-thumbnail", source: "input-product", target: "prompt-thumbnail", type: "curved" },
      { id: "e-thumbnail-output", source: "prompt-thumbnail", target: "output-thumbnail", type: "curved" },
    ],
  }
}

export type ToolWorkflowType =
  | "component-extractor"
  | "color-palette"
  | "typography-matcher"
  | "design-critique"
  | "brand-kit"
  | "animation-capture"
  | "style-fusion"
  // Branding
  | "logo-variations"
  | "brand-style-guide"
  | "social-media-kit"
  | "brand-color-expander"
  // Fashion
  | "outfit-color-matcher"
  | "pattern-generator"
  | "lookbook-creator"
  // Design
  | "mood-board"
  | "ui-component-extractor"
  | "design-system-starter"
  | "thumbnail-hero"

export const TOOL_WORKFLOW_CONFIG: Record<
  ToolWorkflowType,
  {
    name: string
    description: string
    icon: string
    createWorkflow: () => { nodes: Node[]; edges: Edge[] }
  }
> = {
  "style-fusion": {
    name: "Style Fusion",
    description: "Combine two design aesthetics into one cohesive style",
    icon: "home",
    createWorkflow: () => ({ nodes: [], edges: [] }), // Uses main workflow
  },
  "component-extractor": {
    name: "Component Extractor",
    description: "Convert designs to React/HTML code",
    icon: "code",
    createWorkflow: createComponentExtractorWorkflow,
  },
  "color-palette": {
    name: "Color Palette",
    description: "Extract & generate color systems",
    icon: "palette",
    createWorkflow: createColorPaletteWorkflow,
  },
  "typography-matcher": {
    name: "Typography Matcher",
    description: "Identify fonts & get pairings",
    icon: "type",
    createWorkflow: createTypographyMatcherWorkflow,
  },
  "design-critique": {
    name: "Design Critique",
    description: "Get AI feedback on your UI",
    icon: "message",
    createWorkflow: createDesignCritiqueWorkflow,
  },
  "brand-kit": {
    name: "Brand Kit Generator",
    description: "Generate complete brand systems",
    icon: "sparkles",
    createWorkflow: createBrandKitWorkflow,
  },
  "animation-capture": {
    name: "Animation Capture",
    description: "Capture & recreate website animations",
    icon: "keyframes",
    createWorkflow: createAnimationCaptureWorkflow,
  },
  // Branding workflows
  "logo-variations": {
    name: "Logo Variations",
    description: "Generate monochrome & color logo variants",
    icon: "sparkles",
    createWorkflow: createLogoVariationsWorkflow,
  },
  "brand-style-guide": {
    name: "Brand Style Guide",
    description: "Extract colors, typography & usage guidelines",
    icon: "book",
    createWorkflow: createBrandStyleGuideWorkflow,
  },
  "social-media-kit": {
    name: "Social Media Kit",
    description: "Generate Instagram, Twitter, LinkedIn assets",
    icon: "share",
    createWorkflow: createSocialMediaKitWorkflow,
  },
  "brand-color-expander": {
    name: "Color System Builder",
    description: "Generate complementary & analogous palettes",
    icon: "palette",
    createWorkflow: createBrandColorExpanderWorkflow,
  },
  // Fashion workflows
  "outfit-color-matcher": {
    name: "Outfit Color Matcher",
    description: "Find complementary clothing pieces",
    icon: "shirt",
    createWorkflow: createOutfitColorMatcherWorkflow,
  },
  "pattern-generator": {
    name: "Pattern Generator",
    description: "Create seamless patterns & colorways",
    icon: "grid",
    createWorkflow: createPatternGeneratorWorkflow,
  },
  "lookbook-creator": {
    name: "Lookbook Creator",
    description: "Transform products into editorial shots",
    icon: "camera",
    createWorkflow: createLookbookCreatorWorkflow,
  },
  // Design workflows
  "mood-board": {
    name: "Mood Board Generator",
    description: "Create cohesive mood boards & design tokens",
    icon: "layout",
    createWorkflow: createMoodBoardWorkflow,
  },
  "ui-component-extractor": {
    name: "UI Component Extractor",
    description: "Extract buttons, cards & inputs from UI",
    icon: "component",
    createWorkflow: createUIComponentExtractorWorkflow,
  },
  "design-system-starter": {
    name: "Design System Starter",
    description: "Generate design tokens, Tailwind config & components",
    icon: "layers",
    createWorkflow: createDesignSystemStarterWorkflow,
  },
  "thumbnail-hero": {
    name: "Marketing Asset Generator",
    description: "Create hero banners & product thumbnails",
    icon: "image",
    createWorkflow: createThumbnailHeroWorkflow,
  },
}

/**
 * List of tool IDs for the menu, excluding style-fusion (which is the home/default).
 */
export const TOOL_LIST = (Object.keys(TOOL_WORKFLOW_CONFIG) as ToolWorkflowType[])
  .filter((id) => id !== "style-fusion")
