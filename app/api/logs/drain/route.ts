/**
 * Vercel Log Drain Webhook Receiver
 * 
 * Receives logs from Vercel Log Drains and stores them in Supabase.
 * Configure in Vercel Dashboard: Team Settings > Log Drains
 * 
 * Endpoint: POST /api/logs/drain
 * Format: JSON or NDJSON
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// Use service role for inserting logs (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Vercel Log schema (subset of fields we care about)
interface VercelLog {
  id: string
  deploymentId: string
  projectId: string
  projectName?: string
  source: 'static' | 'lambda' | 'edge' | 'build' | 'external' | 'firewall' | 'redirect'
  level: 'info' | 'warning' | 'error' | 'debug'
  message?: string
  host?: string
  path?: string
  statusCode?: number
  requestId?: string
  environment?: 'production' | 'preview'
  branch?: string
  region?: string
  timestamp: number // Unix timestamp in ms
  proxy?: {
    timestamp: number
    method: string
    host: string
    path: string
    statusCode?: number
    clientIp?: string
  }
}

/**
 * Verify the webhook signature from Vercel
 */
function verifySignature(payload: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false
  
  const hmac = crypto.createHmac('sha1', secret)
  hmac.update(payload)
  const expectedSignature = hmac.digest('hex')
  
  return crypto.timingSafeEqual(
    new Uint8Array(Buffer.from(signature)),
    new Uint8Array(Buffer.from(expectedSignature))
  )
}

export async function POST(request: NextRequest) {
  const secret = process.env.VERCEL_LOG_DRAIN_SECRET
  
  // Get raw body for signature verification
  const rawBody = await request.text()
  
  // Verify signature if secret is configured
  if (secret) {
    const signature = request.headers.get('x-vercel-signature')
    if (!verifySignature(rawBody, signature, secret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }
  
  // Parse logs - can be JSON array or NDJSON
  let logs: VercelLog[]
  try {
    const contentType = request.headers.get('content-type') || ''
    
    if (contentType.includes('application/x-ndjson')) {
      // NDJSON format: one JSON object per line
      logs = rawBody
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line))
    } else {
      // JSON array format
      const parsed = JSON.parse(rawBody)
      logs = Array.isArray(parsed) ? parsed : [parsed]
    }
  } catch (error) {
    console.error('Failed to parse log drain payload:', error)
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }
  
  if (logs.length === 0) {
    return NextResponse.json({ success: true, count: 0 })
  }
  
  // Transform logs for database
  const rows = logs.map(log => ({
    log_id: log.id,
    deployment_id: log.deploymentId,
    project_id: log.projectId,
    project_name: log.projectName,
    source: log.source,
    level: log.level,
    message: log.message,
    host: log.host || log.proxy?.host,
    path: log.path || log.proxy?.path,
    status_code: log.statusCode ?? log.proxy?.statusCode,
    request_id: log.requestId,
    environment: log.environment,
    branch: log.branch,
    region: log.region,
    timestamp: new Date(log.timestamp),
    raw_payload: log,
  }))
  
  // Batch insert into Supabase
  const { error } = await supabase
    .from('vercel_logs')
    .insert(rows)
  
  if (error) {
    console.error('Failed to insert logs:', error)
    // Return 200 anyway to prevent Vercel from retrying
    // Log the error but don't fail the webhook
    return NextResponse.json({ 
      success: false, 
      error: 'Database insert failed',
      count: 0 
    })
  }
  
  return NextResponse.json({ success: true, count: rows.length })
}

// Health check for the endpoint
export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    endpoint: 'Vercel Log Drain',
    configured: !!process.env.VERCEL_LOG_DRAIN_SECRET
  })
}
