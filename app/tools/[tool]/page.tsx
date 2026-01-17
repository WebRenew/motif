import { ToolPageClient } from "./client"

export default async function ToolPage({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params
  return <ToolPageClient tool={tool} />
}
