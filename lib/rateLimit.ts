import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis: Redis | null = (() => {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!redisUrl || !redisToken) return null;
  return new Redis({ url: redisUrl, token: redisToken });
})();

const limiters: Record<string, Ratelimit> = {};

let rateLimitWarnedOnce = false;

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  if (!redis) {
    if (!rateLimitWarnedOnce) {
      console.warn("Rate limiting disabled: UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not configured");
      rateLimitWarnedOnce = true;
    }
    return true;
  }

  const windowKey = `${limit}:${windowSeconds}`;
  if (!limiters[windowKey]) {
    limiters[windowKey] = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
    });
  }

  try {
    const { success } = await limiters[windowKey].limit(key);
    return success;
  } catch (error) {
    console.error("Rate limit check failed:", error);
    return true;
  }
}
