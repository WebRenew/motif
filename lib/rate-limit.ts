import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { headers } from "next/headers"

// Rate limit configuration
const GLOBAL_LIMIT = 200
const GLOBAL_WINDOW = "1 h"
const USER_LIMIT = 6
const USER_WINDOW = "1 h"

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
    console.error("[rate-limit] Missing required environment variables: KV_REST_API_URL or KV_REST_API_TOKEN")
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

async function getUserIdentifier(): Promise<string> {
  try {
    const headersList = await headers()
    // Try various headers for user identification
    const forwarded = headersList.get("x-forwarded-for")
    const realIp = headersList.get("x-real-ip")
    const cfConnectingIp = headersList.get("cf-connecting-ip")

    const ip = forwarded?.split(",")[0]?.trim() || realIp || cfConnectingIp || "anonymous"
    return ip
  } catch (error) {
    console.error("[rate-limit] Failed to get user identifier:", error)
    return "anonymous"
  }
}

export async function checkRateLimit(): Promise<CheckRateLimitResult> {
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
    console.error("[rate-limit] Rate limit check failed:", error)
    // Fail-closed on errors
    return {
      success: false,
      error: "Rate limit check failed. Please try again.",
      limitType: "configuration",
    }
  }
}

export { GLOBAL_LIMIT, USER_LIMIT }
