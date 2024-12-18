import { Pool, PoolClient, QueryResult } from "pg";
import { cacheCoordinates, getCachedCoordinates } from "../services/redis";
import { isInIsrael } from "../tools";
import { Coordinates } from "../types/coordinates";

type TableQueryConfig = {
  table: string;
  transform: string;
};

class Database {
  private pool: Pool;

  constructor() {
    const dbUser = process.env.DB_USER;
    const dbHost = process.env.DB_HOST;
    const dbName = process.env.DB_NAME;
    const dbPassword = process.env.DB_PASSWORD;
    const dbPort = parseInt(process.env.DB_PORT ?? "5432", 10);

    if (!dbUser || !dbHost || !dbName || !dbPassword) {
      throw new Error("Database environment variables are not properly set.");
    }

    this.pool = new Pool({
      user: dbUser,
      host: dbHost,
      database: dbName,
      password: dbPassword,
      port: dbPort,
    });
  }

  private async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  public async checkConnection(): Promise<void> {
    let client: PoolClient | null = null;
    try {
      client = await this.pool.connect();
      console.log("Postgres DB connection successful!");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Postgres DB connection failed:", message);
      throw new Error("Unable to connect to the database");
    } finally {
      if (client) {
        client.release();
      }
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

    const queries = [
      {
        text: `
          SELECT ST_X(${geometryFunction}) AS lon, ST_Y(${geometryFunction}) AS lat
          FROM ${table}
          WHERE name = $1
          LIMIT 1;
        `,
        values: [address],
      },
      {
        text: `
          SELECT ST_X(${geometryFunction}) AS lon, ST_Y(${geometryFunction}) AS lat
          FROM ${table}
          WHERE name ILIKE $1
          LIMIT 1;
        `,
        values: [`%${address}%`],
      },
      {
        text: `
          SELECT ST_X(${geometryFunction}) AS lon, ST_Y(${geometryFunction}) AS lat
          FROM ${table}
          WHERE 
            place ILIKE $1 OR 
            tags->'name:en' ILIKE $1 OR
            tags->'name:he' ILIKE $1 OR
            tags->'alt_name' ILIKE $1
          LIMIT 1;
        `,
        values: [`%${address}%`],
      },
    ];

    try {
      for (const query of queries) {
        const res: QueryResult = await client.query(query.text, query.values);
        if (res.rows.length > 0) {
          const { lat, lon } = res.rows[0];
          if (typeof lat === "number" && typeof lon === "number") {
            return { lat, lon };
          } else {
            console.warn(
              "Query returned invalid coordinate types for address:",
              address
            );
          }
        }
      }

      return null;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Error querying coordinates:", message);
      throw new Error("Unable to query coordinates");
    }
  }
  public async getCoordinates(address: string): Promise<Coordinates | null> {
    if (!address || typeof address !== "string" || address.trim() === "") {
      throw new Error("Address is required");
    }

    const trimmedAddress = address.trim();
    const cached = await getCachedCoordinates(trimmedAddress);
    if (cached && isInIsrael(cached.lat, cached.lon)) {
      console.log(`Returning cached coordinates for "${address}":`, cached);
      return cached;
    }

    let client: PoolClient | null = null;
    try {
      client = await this.getClient();
      console.log(`Attempting to find coordinates for address: "${address}"`);

      const tables: TableQueryConfig[] = [
        { table: "planet_osm_point", transform: "ST_Transform(way, 4326)" },
        // { table: "planet_osm_polygon", transform: "ST_Centroid(ST_Transform(way, 4326))" },
        // { table: "planet_osm_line", transform: "ST_Transform(way, 4326)" },
      ];

      let coords: Coordinates | null = null;

      for (const { table, transform } of tables) {
        console.log(`Querying table: ${table}`);
        coords = await this.queryCoordinates(
          client,
          trimmedAddress,
          table,
          transform
        );
        if (coords !== null) {
          break;
        }
      }

      if (coords && isInIsrael(coords.lat, coords.lon)) {
        console.log("Coordinates found and are in Israel:", coords);
        await cacheCoordinates(trimmedAddress, coords.lat, coords.lon);
        return coords;
      } else {
        console.warn(
          `Coordinates not found or outside Israel for address: "${address}"`
        );
        return null;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Error in getCoordinates:", message);
      throw new Error("Error retrieving coordinates from DB");
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}

export default Database;
