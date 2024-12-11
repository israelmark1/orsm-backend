import { Request, Response, Router } from "express";
import axios from "axios";

const router: Router = Router();

// Rough bounding box for Israel
// These coordinates are approximate and may need refinement.
const ISRAEL_BOUNDS = {
  minLat: 29.0,
  maxLat: 33.5,
  minLon: 34.0,
  maxLon: 35.9,
};

function isInIsrael(lat: number, lon: number): boolean {
  return (
    lat >= ISRAEL_BOUNDS.minLat &&
    lat <= ISRAEL_BOUNDS.maxLat &&
    lon >= ISRAEL_BOUNDS.minLon &&
    lon <= ISRAEL_BOUNDS.maxLon
  );
}

router.get("/routeByCoordinate", async (req: Request, res: Response) => {
  const { startLat, startLon, endLat, endLon } = req.query;

  if (!startLat || !startLon || !endLat || !endLon) {
    res.status(400).json({ error: "Missing coordinates" });
    return
  }

  const startLatNum = Number(startLat);
  const startLonNum = Number(startLon);
  const endLatNum = Number(endLat);
  const endLonNum = Number(endLon);

  // Check if both start and end coordinates are inside Israel
  if (
    !isInIsrael(startLatNum, startLonNum) ||
    !isInIsrael(endLatNum, endLonNum)
  ) {
    res.status(400).json({ error: "Coordinates are not within Israel" });
    return
  }

  try {
    const osrmUrl = `${process.env.ORSM_URL}/${startLonNum},${startLatNum};${endLonNum},${endLatNum}?overview=full&geometries=polyline`;

    const response = await axios.get(osrmUrl);
    const data = response.data;

    if (data && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const geometry = route.geometry;
      const distance = route.distance;
      const durationSeconds = route.duration;
      const etaTimestamp = Date.now() + durationSeconds * 1000;
      const eta = new Date(etaTimestamp).toUTCString();

      const result = {
        routeGeometry: geometry,
        distanceMeters: distance,
        durationSeconds: durationSeconds,
        etaMinutes: eta,
      };

      res.json(result);
    } else {
      res.status(404).json({ error: "No route found" });
      return;
    }
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
    return;
  }
});

export default router;
