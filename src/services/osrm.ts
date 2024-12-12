// src/services/osrm.ts
import axios from "axios";

interface Coordinates {
  lat: number;
  lon: number;
}

export async function getRouteFromOSRM(start: Coordinates, end: Coordinates) {
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
  const distance = route.distance; // in meters
  const duration = route.duration; // in seconds
  const geometry = route.geometry; // polyline string if geometries=polyline
  const etaTimestamp = Date.now() + duration * 1000;
  const eta = new Date(etaTimestamp).toISOString();

  return {
    polyline: geometry,
    distance_meters: distance,
    duration_seconds: duration,
    eta: eta,
  };
}
