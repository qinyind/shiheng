import { readConfig } from "./config.mjs";
import { PostgresRepository } from "./repository.mjs";
import { buildApp } from "./app.mjs";

const config = readConfig();
const repository = new PostgresRepository(config.databaseURL);
await repository.initialize();
const app = await buildApp({ config, repository });

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await app.close();
    await repository.close();
    process.exit(0);
  });
}

await app.listen({ host: "0.0.0.0", port: config.port });
