import express from "express";
import dotenv from "dotenv";
import router from "./routes/routes";
import cors from "cors";
import { initCache } from "./services/redis";
import Database from "./DB/db";
import { errorHandler } from "./middlewares/errorHandler";

dotenv.config();

const app = express();
const db = new Database();
const PORT = process.env.PORT;
app.use(cors());
app.use(express.json());
app.use("/api", router);
app.use(errorHandler);

initCache()
  .then(() => {
    console.log("Redis cache connected.");
  })
  .catch((err) => {
    console.error("Error connecting to Redis:", err);
  });

db.checkConnection()
  .then()
  .catch((err: any) => {
    console.error("Error connecting to database:", err);
  });
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

app.get("/", (req, res) => {
  res.send("health check");
});
