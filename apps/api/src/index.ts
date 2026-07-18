import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// npm workspaces run this script with cwd = apps/api, but the single .env
// lives at the repo root — resolve it explicitly so env vars load regardless
// of how/where the process was launched from.
dotenv.config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const { app } = await import("./app.js");
const { env } = await import("./config/env.js");
const { logger } = await import("./lib/logger.js");
const { persistence } = await import("./lib/persistence.js");
const { store } = await import("./lib/store.js");

await persistence.hydrateToStore({
  loadProfile: store.loadProfile,
  loadTwin: store.loadTwin,
  loadSimulation: store.loadSimulation,
  loadReport: store.loadReport,
  loadAnalysis: store.loadAnalysis,
  loadInterview: store.loadInterview
});

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "CareerTwin API is running");
});
