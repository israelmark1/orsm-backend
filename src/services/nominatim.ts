import axios from "axios";
import { cacheCoordinates, getCachedCoordinates } from "./redis";

export const geocodeAddress = async (address: string) => {
  console.log("Geocoding address:", address);

  if (!process.env.NOMINATIM_URL) {
    throw new Error(
      "NOMINATIM_URL is not defined in the environment variables."
    );
  }

  // Check cache first
  const cached = await getCachedCoordinates(address);
  if (cached) {
    return cached;
  }

  const nominatimUrl = `${
    process.env.NOMINATIM_URL
  }/search?format=json&q=${encodeURIComponent(address)}`;

  try {
    const response = await axios.get(nominatimUrl);

    if (
      !response.data ||
      response.data.length === 0 ||
      !response.data[0].lat ||
      !response.data[0].lon
    ) {
      console.error(
        "Invalid or no response from Nominatim for address:",
        address
      );
      return null;
    }

    const { lat, lon } = response.data[0];
    const coords = { lat: parseFloat(lat), lon: parseFloat(lon) };

    await cacheCoordinates(address, coords.lat, coords.lon);

    return coords;
  } catch (error: any) {
    console.error(
      "Error fetching data from Nominatim for address:",
      address,
      error.message
    );
    return null;
  }
};
