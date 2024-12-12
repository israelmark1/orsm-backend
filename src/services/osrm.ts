import axios from "axios";
import { cacheRoute, getCachedRoute } from "./redis";
import dotenv from "dotenv";
dotenv.config();

if (!process.env.ORSM_URL) {
  throw new Error("ORSM_URL is not defined in the environment variables.");
}

interface Coordinates {
  lat: number;
  lon: number;
}

export const getRouteFromOSRM = async (
  start: Coordinates,
  end: Coordinates
) => {
  if (!process.env.ORSM_URL) {
    throw new Error("ORSM_URL is not defined in the environment variables.");
  }
  try {
    const cachedRoute = await getCachedRoute(
      start.lat,
      start.lon,
      end.lat,
      end.lon
    );
    if (cachedRoute) {
      return cachedRoute;
    }

    const osrmUrl = `${process.env.ORSM_URL}${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=polyline`;

    const routeResponse = await axios.get(osrmUrl);

    if (
      !routeResponse.data ||
      !routeResponse.data.routes ||
      routeResponse.data.routes.length === 0
    ) {
      throw new Error("No route found");
    }

    const route = routeResponse.data.routes[0];
    const distance = route.distance;
    const duration = route.duration;
    const geometry = route.geometry;
    const etaTimestamp = Date.now() + duration * 1000;
    const eta = new Date(etaTimestamp).toISOString();

    const routeData = {
      polyline: geometry,
      distance_meters: distance,
      duration_seconds: duration,
      eta: eta,
    };

    await cacheRoute(start.lat, start.lon, end.lat, end.lon, routeData);

    return routeData;
  } catch (err: any) {
    console.error("Error fetching route from OSRM:", err.message);
    throw new Error("Failed to fetch route from OSRM");
  }
};
