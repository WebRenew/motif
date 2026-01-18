import type { Node, Edge } from "@xyflow/react"

// Workflow configurations for each tool
export function createComponentExtractorWorkflow(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [
      {
        id: "input-design",
        type: "imageNode",
        position: { x: 0, y: 200 },
        data: {
          imageUrl: "",
          aspect: "landscape",
          isInput: true,
          label: "Upload Design",
        },
      },
      {
        id: "prompt-extract",
        type: "promptNode",
        position: { x: 500, y: 200 },
        data: {
          title: "Extract Components",
          prompt: `Analyze this UI design screenshot and generate clean, production-ready React component code with Tailwind CSS.

Requirements:
- Use semantic HTML elements
- Apply appropriate Tailwind utility classes
- Include responsive breakpoints where needed
- Add proper accessibility attributes (aria-labels, roles)
- Use modern React patterns (functional components, hooks if needed)
- Export the component as default

Focus on accurately recreating the layout, spacing, typography, and visual hierarchy shown in the design.`,
          model: "anthropic/claude-sonnet-4.5",
          outputType: "text",
          status: "idle",
        },
      },
      {
        id: "output-code",
        type: "codeNode",
        position: { x: 960, y: 200 },
        data: {
          content: "",
          language: "tsx",
          label: "React Component",
        },
      },
    ],
    edges: [
      { id: "e-design-extract", source: "input-design", target: "prompt-extract", type: "curved" },
      { id: "e-extract-code", source: "prompt-extract", target: "output-code", type: "curved" },
    ],
  }
}

export function createColorPaletteWorkflow(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [
      {
        id: "input-image",
        type: "imageNode",
        position: { x: 0, y: 200 },
        data: {
          imageUrl: "",
          aspect: "landscape",
          isInput: true,
          label: "Upload Image",
        },
      },
      {
        id: "prompt-colors",
        type: "promptNode",
        position: { x: 500, y: 200 },
        data: {
          title: "Extract Colors",
          prompt: `Analyze this image and extract a comprehensive color palette. Generate:

1. Primary Colors (3-5 dominant colors from the image)
2. Extended Palette:
   - Lighter variations (for backgrounds, hover states)
   - Darker variations (for text, emphasis)
3. Semantic Assignments:
   - Primary, Secondary, Accent colors
   - Background & Surface colors
   - Text colors (primary, secondary, muted)
   - Border colors
   - Success, Warning, Error, Info colors

Output as CSS custom properties using oklch() color space for better perceptual uniformity.
Include both light and dark mode variations.`,
          model: "anthropic/claude-sonnet-4.5",
          outputType: "text",
          status: "idle",
        },
      },
      {
        id: "output-palette",
        type: "codeNode",
        position: { x: 960, y: 200 },
        data: {
          content: "",
          language: "css",
          label: "Color Palette",
        },
      },
    ],
    edges: [
      { id: "e-image-colors", source: "input-image", target: "prompt-colors", type: "curved" },
      { id: "e-colors-palette", source: "prompt-colors", target: "output-palette", type: "curved" },
    ],
  }
}

export function createTypographyMatcherWorkflow(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [
      {
        id: "input-design",
        type: "imageNode",
        position: { x: 0, y: 200 },
        data: {
          imageUrl: "",
          aspect: "landscape",
          isInput: true,
          label: "Upload Design",
        },
      },
      {
        id: "prompt-fonts",
        type: "promptNode",
        position: { x: 500, y: 200 },
        data: {
          title: "Identify Typography",
          prompt: `Analyze the typography in this design and provide:

1. Font Identification:
   - Identify the fonts used (or closest matches)
   - Note characteristics: serif/sans-serif, weight, style
   
2. Google Fonts Recommendations:
   - Best matching Google Fonts for each identified font
   - Alternative options with similar feel
   
3. Font Pairing Suggestions:
   - Heading + Body combinations
   - Display + UI text pairings
   
4. Typography Scale:
   - Recommended sizes for headings (h1-h6)
   - Body text, captions, labels
   - Line heights and letter spacing

Output as CSS with @import for Google Fonts and complete typography system.`,
          model: "anthropic/claude-sonnet-4.5",
          outputType: "text",
          status: "idle",
        },
      },
      {
        id: "output-typography",
        type: "codeNode",
        position: { x: 960, y: 200 },
        data: {
          content: "",
          language: "css",
          label: "Typography System",
        },
      },
    ],
    edges: [
      { id: "e-design-fonts", source: "input-design", target: "prompt-fonts", type: "curved" },
      { id: "e-fonts-typography", source: "prompt-fonts", target: "output-typography", type: "curved" },
    ],
  }
}

export function createDesignCritiqueWorkflow(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [
      {
        id: "input-ui",
        type: "imageNode",
        position: { x: 0, y: 200 },
        data: {
          imageUrl: "",
          aspect: "landscape",
          isInput: true,
          label: "Upload UI Screenshot",
        },
      },
      {
        id: "prompt-critique",
        type: "promptNode",
        position: { x: 500, y: 200 },
        data: {
          title: "Design Critique",
          prompt: `Provide a professional design critique of this UI. Analyze:

1. Visual Hierarchy
   - Is the most important content emphasized?
   - Clear information architecture?

2. Layout & Spacing
   - Consistent spacing system?
   - Proper alignment and grid usage?
   - Breathing room vs cramped areas?

3. Typography
   - Readability and legibility
   - Appropriate font sizes and weights
   - Line length and spacing

4. Color & Contrast
   - WCAG contrast compliance
   - Color harmony and purpose
   - Effective use of color for emphasis

5. Accessibility
   - Touch target sizes
   - Focus indicators
   - Screen reader considerations

6. Overall Assessment
   - Strengths to keep
   - Priority improvements
   - Quick wins

Be constructive and specific with actionable recommendations.`,
          model: "anthropic/claude-sonnet-4.5",
          outputType: "text",
          status: "idle",
        },
      },
      {
        id: "output-feedback",
        type: "codeNode",
        position: { x: 960, y: 200 },
        data: {
          content: "",
          language: "markdown",
          label: "Design Feedback",
        },
      },
    ],
    edges: [
      { id: "e-ui-critique", source: "input-ui", target: "prompt-critique", type: "curved" },
      { id: "e-critique-feedback", source: "prompt-critique", target: "output-feedback", type: "curved" },
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

export type ToolWorkflowType =
  | "component-extractor"
  | "color-palette"
  | "typography-matcher"
  | "design-critique"
  | "brand-kit"
  | "style-fusion" // The main/default workflow

export const TOOL_WORKFLOW_CONFIG: Record<
  ToolWorkflowType,
  {
    name: string
    description: string
    createWorkflow: () => { nodes: Node[]; edges: Edge[] }
  }
> = {
  "style-fusion": {
    name: "Style Fusion",
    description: "Combine two design aesthetics into one cohesive style",
    createWorkflow: () => ({ nodes: [], edges: [] }), // Uses main workflow
  },
  "component-extractor": {
    name: "Component Extractor",
    description: "Convert designs to React/HTML code",
    createWorkflow: createComponentExtractorWorkflow,
  },
  "color-palette": {
    name: "Color Palette",
    description: "Extract & generate color systems",
    createWorkflow: createColorPaletteWorkflow,
  },
  "typography-matcher": {
    name: "Typography Matcher",
    description: "Identify fonts & get pairings",
    createWorkflow: createTypographyMatcherWorkflow,
  },
  "design-critique": {
    name: "Design Critique",
    description: "Get AI feedback on your UI",
    createWorkflow: createDesignCritiqueWorkflow,
  },
  "brand-kit": {
    name: "Brand Kit Generator",
    description: "Generate complete brand systems",
    createWorkflow: createBrandKitWorkflow,
  },
}
