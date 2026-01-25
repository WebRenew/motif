import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { headers } from "next/headers"
import { createLogger } from "@/lib/logger"

const logger = createLogger('rate-limit')

// Rate limit configuration
const GLOBAL_LIMIT = 200
const GLOBAL_WINDOW = "1 h"
const USER_LIMIT = 6
const USER_WINDOW = "1 h"

// Users exempt from rate limiting (by email)
const RATE_LIMIT_EXEMPT_EMAILS = [
  'charles@webrenew.io',
]

interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
  limitType: "user" | "global"
}

interface RateLimitError {
  success: false
  error: string
  limitType: "configuration"
}

type CheckRateLimitResult = RateLimitResult | RateLimitError

function createRedisClient(): Redis | null {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN

  if (!url || !token) {
    logger.error('Missing required environment variables: KV_REST_API_URL or KV_REST_API_TOKEN')
    return null
  }

  return new Redis({ url, token })
}

const redis = createRedisClient()

const globalRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(GLOBAL_LIMIT, GLOBAL_WINDOW),
      analytics: true,
      prefix: "motif:global-ratelimit",
    })
  : null

const userRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(USER_LIMIT, USER_WINDOW),
      analytics: true,
      prefix: "motif:user-ratelimit",
    })
  : null

// IP validation patterns to prevent header spoofing
const IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/
const IPV6_REGEX = /^([0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}$/i

/**
 * Validates that a string is a properly formatted IP address.
 * This helps prevent rate limit bypass via header spoofing.
 */
function isValidIp(ip: string | null | undefined): ip is string {
  if (!ip) return false
  const trimmed = ip.trim()
  return IPV4_REGEX.test(trimmed) || IPV6_REGEX.test(trimmed)
}

/**
 * Extracts user identifier from request headers for rate limiting.
 *
 * SECURITY NOTE: In production, these headers should only be trusted when
 * the request comes from a known proxy (e.g., Vercel, Cloudflare, nginx).
 * Configure your deployment to strip/overwrite these headers at the edge
 * to prevent clients from spoofing them directly.
 */
async function getUserIdentifier(): Promise<string> {
  try {
    const headersList = await headers()
    // Try various headers for user identification
    const forwarded = headersList.get("x-forwarded-for")?.split(",")[0]?.trim()
    const realIp = headersList.get("x-real-ip")
    const cfConnectingIp = headersList.get("cf-connecting-ip")

    // Validate that extracted values are actually valid IP addresses
    // to prevent rate limit bypass via header spoofing
    if (isValidIp(forwarded)) return forwarded
    if (isValidIp(realIp)) return realIp
    if (isValidIp(cfConnectingIp)) return cfConnectingIp

    // Fall back to anonymous if no valid IP found
    return "anonymous"
  } catch (error) {
    logger.error('Failed to get user identifier', { error: error instanceof Error ? error.message : String(error) })
    return "anonymous"
  }
}

export async function checkRateLimit(userEmail?: string): Promise<CheckRateLimitResult> {
  // Bypass rate limit for exempt users
  if (userEmail && RATE_LIMIT_EXEMPT_EMAILS.includes(userEmail.toLowerCase())) {
    return {
      success: true,
      limit: Infinity,
      remaining: Infinity,
      reset: 0,
      limitType: "user",
    }
  }

  // Fail-closed if rate limiters aren't configured
  if (!globalRateLimiter || !userRateLimiter) {
    return {
      success: false,
      error: "Rate limiting is not configured. Please check server environment variables.",
      limitType: "configuration",
    }
  }

  try {
    const userId = await getUserIdentifier()

    // Check user rate limit FIRST (cheaper, per-user check)
    // This prevents global counter inflation when user limit would fail
    const userResult = await userRateLimiter.limit(userId)
    if (!userResult.success) {
      return {
        success: false,
        limit: userResult.limit,
        remaining: userResult.remaining,
        reset: userResult.reset,
        limitType: "user",
      }
    }

    // User limit passed - now check global limit
    // If global fails here, user quota was consumed but that's acceptable
    // (user was within their limit, system is just overloaded)
    const globalResult = await globalRateLimiter.limit("global")
    if (!globalResult.success) {
      return {
        success: false,
        limit: globalResult.limit,
        remaining: globalResult.remaining,
        reset: globalResult.reset,
        limitType: "global",
      }
    }

    // Both passed - return the more restrictive remaining count
    return {
      success: true,
      limit: userResult.limit,
      remaining: Math.min(userResult.remaining, globalResult.remaining),
      reset: Math.min(userResult.reset, globalResult.reset),
      limitType: "user",
    }
  } catch (error) {
    logger.error('Rate limit check failed', { error: error instanceof Error ? error.message : String(error) })
    // Fail-closed on errors
    return {
      success: false,
      error: "Rate limit check failed. Please try again.",
      limitType: "configuration",
    }
  }
}

export { GLOBAL_LIMIT, USER_LIMIT }
