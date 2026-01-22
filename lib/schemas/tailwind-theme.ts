import { z } from "zod"

// Tailwind 4 CSS Theme Schema - structured output for design tokens
export const tailwindThemeSchema = z.object({
  colors: z.object({
    primary: z.string().describe("Primary brand color in oklch()"),
    secondary: z.string().describe("Secondary brand color"),
    accent: z.string().describe("Accent/highlight color"),
    background: z.string().describe("Page background color"),
    foreground: z.string().describe("Primary text color"),
    muted: z.string().describe("Muted/secondary text color"),
    mutedForeground: z.string().describe("Text on muted backgrounds"),
    card: z.string().describe("Card/surface background"),
    cardForeground: z.string().describe("Text on card surfaces"),
    border: z.string().describe("Border color"),
    input: z.string().describe("Input field background"),
    ring: z.string().describe("Focus ring color"),
    destructive: z.string().describe("Error/destructive action color"),
    success: z.string().describe("Success state color"),
    warning: z.string().describe("Warning state color"),
  }),
  typography: z.object({
    fontSans: z.string().describe("Sans-serif font stack"),
    fontMono: z.string().describe("Monospace font stack"),
    fontSerif: z.string().optional().describe("Serif font stack if applicable"),
    fontSize: z.object({
      xs: z.string().describe("Extra small text size"),
      sm: z.string().describe("Small text size"),
      base: z.string().describe("Base/body text size"),
      lg: z.string().describe("Large text size"),
      xl: z.string().describe("Extra large text size"),
      "2xl": z.string().describe("2x large heading"),
      "3xl": z.string().describe("3x large heading"),
      "4xl": z.string().describe("4x large heading"),
      "5xl": z.string().describe("5x large hero heading"),
    }),
    fontWeight: z.object({
      normal: z.string(),
      medium: z.string(),
      semibold: z.string(),
      bold: z.string(),
    }),
    lineHeight: z.object({
      tight: z.string(),
      normal: z.string(),
      relaxed: z.string(),
    }),
    letterSpacing: z.object({
      tight: z.string(),
      normal: z.string(),
      wide: z.string(),
    }),
  }),
  spacing: z.object({
    xs: z.string().describe("4px"),
    sm: z.string().describe("8px"),
    md: z.string().describe("16px"),
    lg: z.string().describe("24px"),
    xl: z.string().describe("32px"),
    "2xl": z.string().describe("48px"),
    "3xl": z.string().describe("64px"),
    "4xl": z.string().describe("96px"),
  }),
  borderRadius: z.object({
    none: z.string(),
    sm: z.string(),
    md: z.string(),
    lg: z.string(),
    xl: z.string(),
    full: z.string(),
  }),
  shadows: z.object({
    sm: z.string().describe("Subtle shadow"),
    md: z.string().describe("Medium elevation shadow"),
    lg: z.string().describe("Large card shadow"),
    xl: z.string().describe("Extra large modal shadow"),
    glow: z.string().optional().describe("Glow effect if present in design"),
  }),
  gradients: z
    .array(
      z.object({
        name: z.string(),
        value: z.string().describe("CSS gradient value"),
      }),
    )
    .optional()
    .describe("Named gradients from the design"),
})

type TailwindTheme = z.infer<typeof tailwindThemeSchema>

// Convert structured theme to CSS custom properties
export function themeToCss(theme: TailwindTheme): string {
  const lines: string[] = ["@theme {"]

  // Colors
  lines.push("  /* Colors */")
  Object.entries(theme.colors).forEach(([key, value]) => {
    const cssKey = key.replace(/([A-Z])/g, "-$1").toLowerCase()
    lines.push(`  --color-${cssKey}: ${value};`)
  })

  // Typography
  lines.push("")
  lines.push("  /* Typography */")
  lines.push(`  --font-sans: ${theme.typography.fontSans};`)
  lines.push(`  --font-mono: ${theme.typography.fontMono};`)
  if (theme.typography.fontSerif) {
    lines.push(`  --font-serif: ${theme.typography.fontSerif};`)
  }

  lines.push("")
  lines.push("  /* Font Sizes */")
  Object.entries(theme.typography.fontSize).forEach(([key, value]) => {
    lines.push(`  --text-${key}: ${value};`)
  })

  lines.push("")
  lines.push("  /* Font Weights */")
  Object.entries(theme.typography.fontWeight).forEach(([key, value]) => {
    lines.push(`  --font-${key}: ${value};`)
  })

  lines.push("")
  lines.push("  /* Line Heights */")
  Object.entries(theme.typography.lineHeight).forEach(([key, value]) => {
    lines.push(`  --leading-${key}: ${value};`)
  })

  lines.push("")
  lines.push("  /* Letter Spacing */")
  Object.entries(theme.typography.letterSpacing).forEach(([key, value]) => {
    lines.push(`  --tracking-${key}: ${value};`)
  })

  // Spacing
  lines.push("")
  lines.push("  /* Spacing */")
  Object.entries(theme.spacing).forEach(([key, value]) => {
    lines.push(`  --spacing-${key}: ${value};`)
  })

  // Border Radius
  lines.push("")
  lines.push("  /* Border Radius */")
  Object.entries(theme.borderRadius).forEach(([key, value]) => {
    lines.push(`  --radius-${key}: ${value};`)
  })

  // Shadows
  lines.push("")
  lines.push("  /* Shadows */")
  Object.entries(theme.shadows).forEach(([key, value]) => {
    if (value) {
      lines.push(`  --shadow-${key}: ${value};`)
    }
  })

  // Gradients
  if (theme.gradients && theme.gradients.length > 0) {
    lines.push("")
    lines.push("  /* Gradients */")
    theme.gradients.forEach((g) => {
      lines.push(`  --gradient-${g.name}: ${g.value};`)
    })
  }

  lines.push("}")

  return lines.join("\n")
}
