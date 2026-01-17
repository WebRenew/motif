import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

export const rateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 h"),
  analytics: true,
  prefix: "motif:global-ratelimit",
})

export async function checkRateLimit(): Promise<{
  success: boolean
  limit: number
  remaining: number
  reset: number
}> {
  const { success, limit, remaining, reset } = await rateLimiter.limit("global")
  return { success, limit, remaining, reset }
}
