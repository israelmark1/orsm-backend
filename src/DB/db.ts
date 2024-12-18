import { Pool, PoolClient } from "pg";
import { cacheCoordinates, getCachedCoordinates } from "../services/redis";
import { isInIsrael } from "../tools";

type Coordinates = {
  lat: number;
  lon: number;
};

export class Database {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: parseInt(process.env.DB_PORT || "5432"),
    });
  }

  private async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  public async checkConnection() {
    try {
      const client = await this.pool.connect();
      client.release();
      console.log("Postgres DB connection successful!");
    } catch (error: any) {
      console.error("Postgres DB connection failed:", error.message);
      throw new Error("Unable to connect to the database");
    }
  }

  private async queryCoordinates(
    client: PoolClient,
    address: string,
    table: string,
    transformFunction: string
  ): Promise<Coordinates | null> {
    const geometryFunction =
      table === "planet_osm_line"
        ? `ST_Centroid(${transformFunction})`
        : transformFunction;

    const query = `
    SELECT 
      ST_X(${geometryFunction}) AS lon,
      ST_Y(${geometryFunction}) AS lat
    FROM ${table}
    WHERE 
      name ILIKE $1 OR 
      place ILIKE $1 OR 
      tags->'name:en' ILIKE $1 OR
      tags->'name:he' ILIKE $1 OR
      tags->'alt_name' ILIKE $1
    LIMIT 1;
  `;

    try {
      const values = [`%${address}%`];
      const res = await client.query(query, values);

      if (res.rows.length > 0) {
        const { lat, lon } = res.rows[0];
        return { lat, lon };
      }
      return null;
    } catch (error: any) {
      console.error("Error querying coordinates:", error.message);
      throw new Error("Unable to query coordinates");
    }
  }

  public async getCoordinates(address: string): Promise<Coordinates | null> {
    if (!address || typeof address !== "string" || address.trim() === "") {
      throw new Error("Address is required");
    }

    const cached = await getCachedCoordinates(address.trim());
    if (cached && isInIsrael(cached.lat, cached.lon)) {
      console.log(`Returning cached coordinates for "${address}":`, cached);
      return cached;
    }

    const client = await this.getClient();
    try {
      console.log(`Attempting to find coordinates for address: "${address}"`);

      const tables = [
        { table: "planet_osm_point", transform: "ST_Transform(way, 4326)" },
        {
          table: "planet_osm_polygon",
          transform: "ST_Centroid(ST_Transform(way, 4326))",
        },
        { table: "planet_osm_line", transform: "ST_Transform(way, 4326)" },
      ];

      let coords: Coordinates | null = null;

      for (const { table, transform } of tables) {
        console.log(`Querying table: ${table}`);
        coords = await this.queryCoordinates(
          client,
          address.trim(),
          table,
          transform
        );
        if (coords) break;
      }

      if (coords && isInIsrael(coords.lat, coords.lon)) {
        console.log(`Coordinates found and are in Israel:`, coords);
        await cacheCoordinates(address, coords.lat, coords.lon);
        return coords;
      } else {
        console.warn(
          `Coordinates not found or outside Israel for address: "${address}"`
        );
      }

      return null;
    } finally {
      client.release();
    }
  }

  public async close() {
    await this.pool.end();
  }
}
