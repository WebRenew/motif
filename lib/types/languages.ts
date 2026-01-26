/**
 * Shared code language definitions.
 * 
 * This ensures type safety between:
 * - LANGUAGE_SYSTEM_PROMPTS in generate-image/route.ts
 * - LANGUAGE_OPTIONS in code-node.tsx
 * 
 * Adding a new language requires updates to both the type and the
 * corresponding system prompt/UI option.
 */

/**
 * Supported code languages for code nodes.
 * Ordered by typical usage frequency.
 */
export const CODE_LANGUAGES = [
  "text",
  "tsx",
  "jsx",
  "css",
  "json",
  "typescript",
  "javascript",
  "mdx",
  "markdown",
] as const

/**
 * Type representing valid code language values.
 */
export type CodeLanguage = (typeof CODE_LANGUAGES)[number]

/**
 * Language options with display metadata.
 * Used by code-node.tsx for the language selector dropdown.
 */
export const LANGUAGE_OPTIONS: ReadonlyArray<{
  value: CodeLanguage
  label: string
  description: string
}> = [
  { value: "text", label: "Text", description: "Plain text input" },
  { value: "tsx", label: "TSX", description: "React TypeScript" },
  { value: "jsx", label: "JSX", description: "React JavaScript" },
  { value: "css", label: "CSS", description: "Stylesheets" },
  { value: "json", label: "JSON", description: "Data/Config" },
  { value: "typescript", label: "TypeScript", description: "Node/Scripts" },
  { value: "javascript", label: "JavaScript", description: "Node/Scripts" },
  { value: "mdx", label: "MDX", description: "Markdown + JSX" },
  { value: "markdown", label: "Markdown", description: "Documentation" },
] as const

/**
 * Default language for new code nodes.
 */
export const DEFAULT_CODE_LANGUAGE: CodeLanguage = "text"

/**
 * Check if a string is a valid CodeLanguage.
 */
export function isValidCodeLanguage(value: string): value is CodeLanguage {
  return CODE_LANGUAGES.includes(value as CodeLanguage)
}
