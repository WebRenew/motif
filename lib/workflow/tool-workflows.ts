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
      // URL Input - user enters the website URL to capture
      {
        id: "input-url",
        type: "textInputNode",
        position: { x: 50, y: 100 },
        data: {
          value: "https://stripe.com",
          label: "Website URL",
          placeholder: "https://example.com",
          inputType: "url",
          required: true,
        },
      },

      // CSS Selector Input (optional) - user can target a specific element
      {
        id: "input-selector",
        type: "textInputNode",
        position: { x: 50, y: 330 },
        data: {
          value: "",
          label: "CSS Selector",
          placeholder: ".hero-animation, #main-content",
          inputType: "css-selector",
          required: false,
        },
      },
      
      // Capture Prompt - triggers the animation capture and analysis
      {
        id: "prompt-capture",
        type: "promptNode",
        position: { x: 450, y: 165 },
        data: {
          title: "Capture Animation",
          prompt: `Capture the animations from this website URL and analyze them.

After capturing, describe:
1. What animation libraries were detected (GSAP, Framer Motion, etc.)
2. The CSS keyframes and transitions found
3. The timing, easing, and transform properties used
4. A summary of the animation behavior

Then provide recommendations for recreating these animations in React with Framer Motion.`,
          model: "anthropic/claude-sonnet-4.5",
          outputType: "text",
          status: "idle",
          // Special mode: triggers /api/capture-animation instead of /api/generate-image
          captureMode: true,
        },
      },
      
      // Animation Analysis Output - stores the capture analysis
      {
        id: "output-analysis",
        type: "codeNode",
        position: { x: 900, y: 100 },
        data: {
          content: "",
          language: "markdown",
          label: "Animation Analysis",
          alwaysShowSourceHandle: true,
        },
      },
      
      // Recreate Prompt - generates React component from analysis
      {
        id: "prompt-recreate",
        type: "promptNode",
        position: { x: 1300, y: 165 },
        data: {
          title: "Recreate Animation",
          prompt: `Based on the animation analysis provided, generate a React component that recreates this animation using Framer Motion.

Requirements:
- Use Framer Motion for animations
- TypeScript with proper types
- Include comments explaining timing and easing choices
- Make it reusable with props for customization
- Include variants for hover/tap states if applicable`,
          model: "anthropic/claude-sonnet-4.5",
          outputType: "text",
          status: "idle",
        },
      },
      
      // Final Output - the generated React component
      {
        id: "output-component",
        type: "codeNode",
        position: { x: 1750, y: 165 },
        data: {
          content: "",
          language: "tsx",
          label: "AnimatedComponent.tsx",
        },
      },
    ],
    edges: [
      // Inputs flow into capture prompt
      { id: "e-url-capture", source: "input-url", target: "prompt-capture", type: "curved" },
      { id: "e-selector-capture", source: "input-selector", target: "prompt-capture", type: "curved" },
      // Capture outputs to analysis
      { id: "e-capture-analysis", source: "prompt-capture", target: "output-analysis", type: "curved" },
      // Analysis feeds into recreate prompt
      { id: "e-analysis-recreate", source: "output-analysis", target: "prompt-recreate", type: "curved" },
      // Recreate outputs final component
      { id: "e-recreate-component", source: "prompt-recreate", target: "output-component", type: "curved" },
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
  | "style-fusion" // The main/default workflow

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
    icon: "video",
    createWorkflow: createAnimationCaptureWorkflow,
  },
}

/**
 * List of tool IDs for the menu, excluding style-fusion (which is the home/default).
 */
export const TOOL_LIST = (Object.keys(TOOL_WORKFLOW_CONFIG) as ToolWorkflowType[])
  .filter((id) => id !== "style-fusion")
