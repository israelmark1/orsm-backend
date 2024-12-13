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
    const query = `
      SELECT 
        ST_X(${transformFunction}) AS lon,
        ST_Y(${transformFunction}) AS lat
      FROM ${table}
      WHERE name ILIKE $1
      LIMIT 1;
    `;

    try {
      const res = await client.query(query, [`%${address}%`]);
      if (res.rows.length > 0) {
        const { lat, lon } = res.rows[0];
        return { lat, lon };
      }
    } catch (error: any) {
      console.error("Error querying coordinates:", error.message);
      throw new Error("Unable to query coordinates");
    }
    return null;
  }

  public async getCoordinates(address: string): Promise<Coordinates | null> {
    if (!address || typeof address !== "string" || address.trim() === "") {
      throw new Error("Address is required");
    }
    const cached = await getCachedCoordinates(address);
    if (cached && isInIsrael(cached.lat, cached.lon)) {
      return cached;
    }
    const client = await this.getClient();
    try {
      let coords = await this.queryCoordinates(
        client,
        address,
        "planet_osm_point",
        "ST_Transform(way, 4326)"
      );
      if (!coords) {
        coords = await this.queryCoordinates(
          client,
          address,
          "planet_osm_polygon",
          "ST_Centroid(ST_Transform(way, 4326))"
        );
      }

      if (coords && isInIsrael(coords.lat, coords.lon)) {
        await cacheCoordinates(address, coords.lat, coords.lon);
        return coords;
      } else {
        console.warn("Coordinates are not within Israel:", coords);
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
