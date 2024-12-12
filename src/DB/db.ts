import { Pool, PoolClient } from "pg";
import { cacheCoordinates, getCachedCoordinates } from "../services/redis";

type Coordinates = {
  lon: number;
  lat: number;
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
  public async getCoordinates(address: string): Promise<Coordinates | null> {
    const cached = await getCachedCoordinates(address);
    if (cached) {
      return cached;
    }
    const client = await this.getClient();
    try {
      const pointQuery = `
        SELECT 
          ST_X(ST_Transform(way, 4326)) AS lon,
          ST_Y(ST_Transform(way, 4326)) AS lat
        FROM planet_osm_point
        WHERE name ILIKE $1
        LIMIT 1;
      `;
      let res = await client.query(pointQuery, [`%${address}%`]);

      if (res.rows.length === 0) {
        const polygonQuery = `
          SELECT 
            ST_X(ST_Centroid(ST_Transform(way, 4326))) AS lon,
            ST_Y(ST_Centroid(ST_Transform(way, 4326))) AS lat
          FROM planet_osm_polygon
          WHERE name ILIKE $1
          LIMIT 1;
        `;
        res = await client.query(polygonQuery, [`%${address}%`]);
      }

      if (res.rows.length > 0) {
        await cacheCoordinates(address, res.rows[0].lat, res.rows[0].lon);
        return { lat: res.rows[0].lat, lon: res.rows[0].lon };
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
