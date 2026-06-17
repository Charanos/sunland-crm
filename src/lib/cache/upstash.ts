import { Redis } from "@upstash/redis";

let redisClient: Redis | null = null;

export function getRedis() {
  if (redisClient) {
    return redisClient;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  redisClient = new Redis({ url, token });
  return redisClient;
}

export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number,
): Promise<T> {
  const redis = getRedis();

  if (!redis) {
    return fetcher();
  }

  const cached = await redis.get<T>(key);
  if (cached) {
    return cached;
  }

  const fresh = await fetcher();
  await redis.setex(key, ttlSeconds, fresh);
  return fresh;
}
