import { createClient } from "redis";
import dotenv from "dotenv";
dotenv.config();

type RouteCacheData = {
  polyline: string;
  distance_meters: number;
  duration_seconds: number;
  eta: string;
};

const redisClient = createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));

const CACHE_EXPIRY = 60 * 60 * 24;
const KEY_PREFIX = "route:";

const roundedKey = (value: number) => value.toFixed(5);

export const initCache = async () => {
  try {
    await redisClient.connect();
    console.log("Connected to Redis.");
  } catch (err) {
    console.error("Failed to connect to Redis:", err);
  }
};

export const closeCache = async () => {
  try {
    await redisClient.disconnect();
    console.log("Redis connection closed.");
  } catch (err) {
    console.error("Error closing Redis connection:", err);
  }
};

export const getCachedCoordinates = async (
  address: string
): Promise<{ lat: number; lon: number } | null> => {
  try {
    const data = await redisClient.get(
      `${KEY_PREFIX}address:${address.toLowerCase()}`
    );
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error("Error retrieving cached coordinates:", err);
    return null;
  }
};

export const cacheCoordinates = async (
  address: string,
  lat: number,
  lon: number
) => {
  try {
    await redisClient.set(
      `${KEY_PREFIX}address:${address.toLowerCase()}`,
      JSON.stringify({ lat, lon }),
      { EX: CACHE_EXPIRY }
    );
  } catch (err) {
    console.error("Error caching coordinates:", err);
  }
};

export const getCachedRoute = async (
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number
): Promise<RouteCacheData | null> => {
  try {
    const routeKey = `${KEY_PREFIX}route:${roundedKey(startLat)},${roundedKey(
      startLon
    )}:${roundedKey(endLat)},${roundedKey(endLon)}`;
    const data = await redisClient.get(routeKey);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error("Error retrieving cached route:", err);
    return null;
  }
};

export const cacheRoute = async (
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  routeData: RouteCacheData
) => {
  try {
    const routeKey = `${KEY_PREFIX}:${roundedKey(startLat)},${roundedKey(
      startLon
    )}:${roundedKey(endLat)},${roundedKey(endLon)}`;
    await redisClient.set(routeKey, JSON.stringify(routeData), {
      EX: CACHE_EXPIRY,
    });
  } catch (err) {
    console.error("Error caching route:", err);
  }
};
