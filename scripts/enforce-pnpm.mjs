import { rm } from "node:fs/promises";
import { resolve } from "node:path";

if (!process.env.npm_config_user_agent?.startsWith("pnpm/")) {
  console.error("Use pnpm instead");
  process.exit(1);
}

await Promise.all(
  ["package-lock.json", "yarn.lock"].map((file) =>
    rm(resolve(process.cwd(), file), { force: true }),
  ),
);
