import { Request, Response, Router } from "express";
import axios from "axios";
import { geocodeAddress } from "../services/nominatim";
import { getRouteFromOSRM } from "../services/osrm";

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
    return;
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
    return;
  }

  try {
    const result = await getRouteFromOSRM(
      { lat: startLatNum, lon: startLonNum },
      { lat: endLatNum, lon: endLonNum }
    );
    if (result) {
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

router.get("/routeByAddress", async (req: Request, res: Response) => {
  const { startAddress, endAddress } = req.query;

  if (!startAddress || !endAddress) {
    res
      .status(400)
      .json({ error: "Must provide startAddress and endAddress." });
    return;
  }

  try {
    const startCoords = await geocodeAddress(startAddress as string);
    const endCoords = await geocodeAddress(endAddress as string);

    if (!startCoords || !endCoords) {
      res
        .status(404)
        .json({ error: "Unable to geocode one of the addresses." });
      return;
    }

    const routeData = await getRouteFromOSRM(startCoords, endCoords);
    res.json(routeData);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
    return;
  }
});

export default router;
