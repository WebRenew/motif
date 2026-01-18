import { z } from "zod"

/**
 * Schemas for structured code generation output
 * These ensure the AI returns clean, parseable code without markdown or explanations
 */

export const codeOutputSchema = z.object({
  code: z.string().describe("The generated code without any markdown backticks or explanations"),
  language: z.string().describe("The programming language of the code"),
  filename: z.string().optional().describe("Suggested filename for the code"),
})

export type CodeOutput = z.infer<typeof codeOutputSchema>

// Language-specific schemas with validation
export const tsxOutputSchema = z.object({
  code: z.string().describe("Complete TSX component code with TypeScript types"),
  componentName: z.string().describe("The main exported component name"),
  imports: z.array(z.string()).optional().describe("Required imports"),
  props: z
    .array(
      z.object({
        name: z.string(),
        type: z.string(),
        required: z.boolean(),
      }),
    )
    .optional()
    .describe("Component props interface"),
})

export const cssOutputSchema = z.object({
  code: z.string().describe("Complete CSS code with custom properties"),
  variables: z
    .array(
      z.object({
        name: z.string(),
        value: z.string(),
      }),
    )
    .optional()
    .describe("CSS custom properties defined"),
  selectors: z.array(z.string()).optional().describe("Main CSS selectors used"),
})

export const jsonOutputSchema = z.object({
  data: z.record(z.unknown()).describe("The JSON data structure"),
})

// Generic schema for languages without specific structure needs
export const genericCodeSchema = z.object({
  code: z.string().describe("The generated code, clean without markdown formatting"),
})

// Multi-file output schema for when AI generates multiple related files
export const multiFileOutputSchema = z.object({
  files: z.array(z.object({
    filename: z.string().describe("The filename with extension (e.g., 'Button.tsx', 'button.css')"),
    language: z.enum(["tsx", "jsx", "css", "json", "typescript", "javascript", "mdx", "markdown"]).describe("The programming language"),
    content: z.string().describe("The file content, clean without markdown formatting"),
    description: z.string().optional().describe("Brief description of what this file contains"),
  })).min(1).describe("Array of generated files"),
  primaryFile: z.string().optional().describe("The filename of the main/primary file"),
})

export type TsxOutput = z.infer<typeof tsxOutputSchema>
export type CssOutput = z.infer<typeof cssOutputSchema>
export type JsonOutput = z.infer<typeof jsonOutputSchema>
export type GenericCodeOutput = z.infer<typeof genericCodeSchema>
export type MultiFileOutput = z.infer<typeof multiFileOutputSchema>