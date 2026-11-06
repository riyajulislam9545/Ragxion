import app from "./app";
import { logger } from "./lib/logger";
import { closeDatabase, connectDatabase } from "@workspace/db";

const rawPort = process.env["PORT"] ?? "8080";
const port = Number(rawPort);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

try {
  await connectDatabase();
} catch (error) {
  logger.error(
    { errorType: error instanceof Error ? error.name : "UnknownError" },
    "Failed to connect to MongoDB",
  );
  process.exit(1);
}

const server = app.listen(port, () => {
  logger.info({ port }, "Server listening");
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.close(() => {
      void closeDatabase().catch((error: unknown) => {
        logger.error(
          { errorType: error instanceof Error ? error.name : "UnknownError" },
          "Failed to close MongoDB connection",
        );
        process.exitCode = 1;
      });
    });
  });
}
