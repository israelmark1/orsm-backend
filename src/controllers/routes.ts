import { Request, Response, Router } from "express";
import { getRouteFromOSRM } from "../services/osrm";
import { isInIsrael } from "../tools";
import { Database } from "../DB/db";
import { geocodeAddress } from "../services/nominatim";
const db = new Database();

const router: Router = Router();

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

  if (typeof startAddress !== "string" || typeof endAddress !== "string") {
    res.status(400).json({ error: "Invalid address format" });
    return;
  }
  try {
    let startCoords = await db.getCoordinates(startAddress as string);
    let endCoords = await db.getCoordinates(endAddress as string);

    if (!startCoords || !endCoords) {
      startCoords = await geocodeAddress(startAddress);
      endCoords = await geocodeAddress(endAddress);
      if (!startCoords || !endCoords) {
        res
          .status(404)
          .json({ error: "Unable to geocode one of the addresses." });
        return;
      }
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
