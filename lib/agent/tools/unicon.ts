/**
 * Unicon MCP Tools
 * 
 * Tools for searching and retrieving icons from the Unicon API.
 * Uses the SSE/HTTP endpoint at unicon.webrenew.com/api/mcp
 */

import { z } from 'zod'

const UNICON_MCP_URL = 'https://unicon.webrenew.com/api/mcp'

// Schema for search_icons
export const searchIconsSchema = z.object({
  query: z.string().describe('Search query for icons (e.g., "dashboard", "user profile", "settings gear")'),
  limit: z.number().min(1).max(50).optional().default(10).describe('Number of icons to return (1-50, default 10)'),
  library: z.string().optional().describe('Filter by specific library (e.g., "lucide", "heroicons", "phosphor")'),
})

export type SearchIconsParams = z.infer<typeof searchIconsSchema>

// Schema for get_icon
export const getIconSchema = z.object({
  id: z.string().describe('The unique icon ID to retrieve'),
  format: z.enum(['svg', 'react', 'vue']).optional().default('svg').describe('Output format for the icon'),
})

export type GetIconParams = z.infer<typeof getIconSchema>

// Schema for get_multiple_icons
export const getMultipleIconsSchema = z.object({
  ids: z.array(z.string()).min(1).max(20).describe('Array of icon IDs to retrieve (max 20)'),
  format: z.enum(['svg', 'react', 'vue']).optional().default('svg').describe('Output format for the icons'),
})

export type GetMultipleIconsParams = z.infer<typeof getMultipleIconsSchema>

// Schema for list_libraries
export const listLibrariesSchema = z.object({})

// Schema for list_categories
export const listCategoriesSchema = z.object({
  library: z.string().optional().describe('Filter categories by library'),
})

export type ListCategoriesParams = z.infer<typeof listCategoriesSchema>

// Schema for get_starter_pack
export const getStarterPackSchema = z.object({
  pack: z.string().optional().describe('Name of the starter pack (e.g., "dashboard", "ecommerce", "social")'),
})

export type GetStarterPackParams = z.infer<typeof getStarterPackSchema>

/**
 * Call the Unicon MCP endpoint
 */
async function callUniconMCP(toolName: string, args: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(UNICON_MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Unicon API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  
  if (data.error) {
    throw new Error(`Unicon tool error: ${data.error.message || JSON.stringify(data.error)}`)
  }

  return data.result
}

/**
 * Search for icons using AI-powered semantic search
 */
export async function executeSearchIcons(params: SearchIconsParams): Promise<{
  success: boolean
  icons?: Array<{ id: string; name: string; library: string; tags?: string[] }>
  error?: string
}> {
  try {
    const result = await callUniconMCP('search_icons', {
      query: params.query,
      limit: params.limit,
      ...(params.library && { library: params.library }),
    })
    
    return {
      success: true,
      icons: result as Array<{ id: string; name: string; library: string; tags?: string[] }>,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search icons',
    }
  }
}

/**
 * Get a single icon by ID
 */
export async function executeGetIcon(params: GetIconParams): Promise<{
  success: boolean
  icon?: { id: string; name: string; svg?: string; react?: string; vue?: string }
  error?: string
}> {
  try {
    const result = await callUniconMCP('get_icon', {
      id: params.id,
      format: params.format,
    })
    
    return {
      success: true,
      icon: result as { id: string; name: string; svg?: string; react?: string; vue?: string },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get icon',
    }
  }
}

/**
 * Get multiple icons at once
 */
export async function executeGetMultipleIcons(params: GetMultipleIconsParams): Promise<{
  success: boolean
  icons?: Array<{ id: string; name: string; svg?: string; react?: string; vue?: string }>
  error?: string
}> {
  try {
    const result = await callUniconMCP('get_multiple_icons', {
      ids: params.ids,
      format: params.format,
    })
    
    return {
      success: true,
      icons: result as Array<{ id: string; name: string; svg?: string; react?: string; vue?: string }>,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get icons',
    }
  }
}

/**
 * List available icon libraries
 */
export async function executeListLibraries(): Promise<{
  success: boolean
  libraries?: Array<{ id: string; name: string; iconCount?: number }>
  error?: string
}> {
  try {
    const result = await callUniconMCP('list_libraries', {})
    
    return {
      success: true,
      libraries: result as Array<{ id: string; name: string; iconCount?: number }>,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list libraries',
    }
  }
}

/**
 * List icon categories
 */
export async function executeListCategories(params: ListCategoriesParams): Promise<{
  success: boolean
  categories?: Array<{ id: string; name: string; iconCount?: number }>
  error?: string
}> {
  try {
    const result = await callUniconMCP('list_categories', {
      ...(params.library && { library: params.library }),
    })
    
    return {
      success: true,
      categories: result as Array<{ id: string; name: string; iconCount?: number }>,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list categories',
    }
  }
}

/**
 * Get a curated starter pack of icons
 */
export async function executeGetStarterPack(params: GetStarterPackParams): Promise<{
  success: boolean
  pack?: { name: string; icons: Array<{ id: string; name: string; svg?: string }> }
  error?: string
}> {
  try {
    const result = await callUniconMCP('get_starter_pack', {
      ...(params.pack && { pack: params.pack }),
    })
    
    return {
      success: true,
      pack: result as { name: string; icons: Array<{ id: string; name: string; svg?: string }> },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get starter pack',
    }
  }
}

// Tool descriptions
export const searchIconsDescription = `Search for icons using AI-powered semantic search.
Returns a list of matching icons with their IDs, names, and libraries.
Use this to find icons that match a concept, style, or use case.
Examples: "dashboard analytics", "user profile avatar", "shopping cart ecommerce"`

export const getIconDescription = `Get a single icon by its ID.
Returns the icon in the requested format (svg, react, or vue).
Use after searching to retrieve the actual icon content.`

export const getMultipleIconsDescription = `Get multiple icons at once by their IDs.
More efficient than calling get_icon multiple times.
Returns up to 20 icons in the requested format.`

export const listLibrariesDescription = `List all available icon libraries.
Returns library names and icon counts.
Use to discover what icon sets are available (lucide, heroicons, phosphor, etc.)`

export const listCategoriesDescription = `List icon categories, optionally filtered by library.
Returns category names and icon counts.
Use to explore icons by category (arrows, communication, weather, etc.)`

export const getStarterPackDescription = `Get a curated starter pack of icons for common use cases.
Available packs: dashboard, ecommerce, social, weather, media, etc.
Use to quickly get a set of related icons for a project.`
