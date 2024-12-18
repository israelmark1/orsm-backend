import { Request, Response, Router } from "express";
import { getRouteFromOSRM } from "../services/osrm";
import Database from "../DB/db";
import { geocodeAddress } from "../services/nominatim";
import { validateCoordinates } from "../middlewares/validateCoordinates";
const db = new Database();

const router: Router = Router();

router.get(
  "/routeByCoordinate",
  validateCoordinates,
  async (req: Request, res: Response) => {
    const { startCoords, endCoords } = req as any;

    try {
      const result = await getRouteFromOSRM(startCoords, endCoords);
      if (result) {
        res.json(result);
      } else {
        res.status(404).json({ error: "No route found" });
      }
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);
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
    if (!startCoords) {
      startCoords = await geocodeAddress(startAddress);
      if (!startCoords) {
        res.status(404).json({ error: "Unable to geocode start address." });
        return;
      }
    }
    let endCoords = await db.getCoordinates(endAddress as string);

    if (!endCoords) {
      endCoords = await geocodeAddress(endAddress);
      if (!endCoords) {
        res.status(404).json({ error: "Unable to geocode end address." });
        return;
      }
    }
    console.log("startCoords:", startCoords, "endCoords:", endCoords);

    const routeData = await getRouteFromOSRM(startCoords, endCoords);
    res.json(routeData);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
    return;
  }
});

export default router;
