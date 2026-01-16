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
          model: "anthropic/claude-sonnet-4-5",
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
          model: "anthropic/claude-sonnet-4-5",
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
          model: "anthropic/claude-sonnet-4-5",
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
          model: "anthropic/claude-sonnet-4-5",
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
      {
        id: "input-logo",
        type: "imageNode",
        position: { x: 100, y: 350 },
        data: {
          imageUrl: "",
          aspect: "square",
          isInput: true,
          label: "Upload Image",
        },
      },
      {
        id: "prompt-visual",
        type: "promptNode",
        position: { x: 500, y: 50 },
        data: {
          title: "Generate Brand Visual",
          prompt: `Create a brand hero image that embodies this logo's visual identity. Generate a sophisticated, abstract background pattern or hero visual that:
- Uses colors extracted from the logo
- Reflects the brand's personality and style
- Works as a website hero background
- Premium, modern aesthetic
- No text, just visual elements`,
          model: "google/gemini-3-pro-image",
          outputType: "image",
          status: "idle",
        },
      },
      {
        id: "prompt-brand",
        type: "promptNode",
        position: { x: 500, y: 400 },
        data: {
          title: "Generate Brand Kit",
          prompt: `Analyze this logo/brand image and generate a complete brand system:

1. Color Palette
   - Extract brand colors from the logo
   - Generate extended palette (tints, shades)
   - Define semantic color assignments
   - Include dark mode variants

2. Typography Recommendations
   - Suggest fonts that complement the brand personality
   - Heading and body font pairings
   - Complete type scale

3. Design Tokens
   - Spacing scale
   - Border radius (matching brand feel)
   - Shadow styles
   - Animation/transition timings

4. Brand Personality
   - Key adjectives describing the brand
   - Tone of voice guidelines
   - Visual style direction

Output as comprehensive CSS custom properties ready for Tailwind v4.`,
          model: "anthropic/claude-sonnet-4-5",
          outputType: "text",
          status: "idle",
        },
      },
      {
        id: "output-visual",
        type: "imageNode",
        position: { x: 960, y: 50 },
        data: {
          imageUrl: "",
          aspect: "landscape",
          label: "Output",
        },
      },
      {
        id: "output-tokens",
        type: "codeNode",
        position: { x: 960, y: 550 },
        data: {
          content: "",
          language: "css",
          label: "Brand Tokens",
        },
      },
    ],
    edges: [
      { id: "e-logo-visual", source: "input-logo", target: "prompt-visual", type: "curved" },
      { id: "e-logo-brand", source: "input-logo", target: "prompt-brand", type: "curved" },
      { id: "e-visual-output", source: "prompt-visual", target: "output-visual", type: "curved" },
      { id: "e-brand-tokens", source: "prompt-brand", target: "output-tokens", type: "curved" },
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
