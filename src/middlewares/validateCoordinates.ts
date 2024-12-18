import { Request, Response, NextFunction } from "express";
import { isInIsrael } from "../tools";

export function validateCoordinates(
  req: Request,
  res: Response,
  next: NextFunction
) {
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
    isNaN(startLatNum) ||
    isNaN(startLonNum) ||
    isNaN(endLatNum) ||
    isNaN(endLonNum)
  ) {
    res.status(400).json({ error: "Invalid coordinate format" });
    return;
  }

  if (
    !isInIsrael(startLatNum, startLonNum) ||
    !isInIsrael(endLatNum, endLonNum)
  ) {
    res.status(400).json({ error: "Coordinates are not within Israel" });
    return;
  }

  (req as any).startCoords = { lat: startLatNum, lon: startLonNum };
  (req as any).endCoords = { lat: endLatNum, lon: endLonNum };

  next();
}
