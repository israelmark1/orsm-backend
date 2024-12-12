// src/services/nominatim.ts
import axios from "axios";
import { cacheCoordinates, getCachedCoordinates } from "./redis";

export async function geocodeAddress(address: string) {
  console.log("geocodeAddress called with address:", address);
  const cached = await getCachedCoordinates(address);
  if (cached) {
    return cached;
  }

  // Not in cache, call Nominatim
  const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    address
  )}`;
  try {
    const response = await axios.get(nominatimUrl);

    if (response.data && response.data.length > 0) {
      const { lat, lon } = response.data[0];
      const coords = { lat: parseFloat(lat), lon: parseFloat(lon) };

      await cacheCoordinates(address, coords.lat, coords.lon);
      return coords;
    }
  } catch (error) {
    console.error("Error fetching data from Nominatim:", error);
    return null;
  }
}
