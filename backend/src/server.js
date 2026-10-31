import { app } from "./app.js";
import { env } from "./config/env.js";
import { startGatepassLifecycleJobs } from "./services/gatepassLifecycleService.js";

app.listen(env.PORT, () => {
  console.log(`Mehman API running on http://localhost:${env.PORT}`);
  if (env.NODE_ENV !== "test") {
    startGatepassLifecycleJobs();
  }
});
