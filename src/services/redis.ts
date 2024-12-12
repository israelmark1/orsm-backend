// src/services/cache.ts
import { createClient } from "redis";

const redisClient = createClient({
  url: `redis://${process.env.REDIS_HOST || "redis"}:${process.env.REDIS_PORT || 6379}`,
});
redisClient.on("error", (err) => console.error("Redis Client Error", err));

export async function initCache() {
  await redisClient.connect();
}

export async function getCachedCoordinates(
  address: string
): Promise<{ lat: number; lon: number } | null> {
  const data = await redisClient.get(address.toLowerCase());
  return data ? JSON.parse(data) : null;
}

export async function cacheCoordinates(
  address: string,
  lat: number,
  lon: number
) {
  await redisClient.set(address.toLowerCase(), JSON.stringify({ lat, lon }), {
    EX: 60 * 60 * 24,
  });
  // EX sets expiry (in seconds), here we set 24 hours
}
