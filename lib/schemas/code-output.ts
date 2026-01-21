import { z } from "zod"

/**
 * Schemas for structured code generation output
 * These ensure the AI returns clean, parseable code without markdown or explanations
 */

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