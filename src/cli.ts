import commander from "commander";
import { exec } from "shelljs";
import { Container } from "typedi";

import { writeFileSync } from "fs";
import { join } from "path";
import { Database } from "./db/database";

const db = Container.get(Database);

commander.version("0.0.1", "-v --version");

commander
  .command("db:reset")
  .description("Resets database based on NODE_ENV")
  .action(async () => {
    try {
      await db.connect();
      await db.reset();
      await db.disconnect();
      console.log("Database successfully reseted");
    } catch (err) {
      throw new Error(`Cannot reset database. Error: ${err}`);
    }
  });

commander.command("migration:up").action(() => {
  exec(`typeorm migration:run`, (code: any, stdout: any, stderr: any) => {
    if (stderr) {
      console.log("migration error:", stderr);
      return;
    }
    console.log("migration output:", stdout);
  });
});

commander.command("migration:down").action(() => {
  exec(`typeorm migration:revert`, (code: any, stdout: any, stderr: any) => {
    if (stderr) {
      console.log("migration error:", stderr);
      return;
    }
    console.log("migration output:", stdout);
  });
});

commander.command("migration:create <name>").action((name: string) => {
  exec(
    `typeorm migration:create -n ${name}`,
    (code: any, stdout: any, stderr: any) => {
      if (stderr) {
        console.log("migration error:", stderr);
        return;
      }
      console.log("migration output:", stdout);
    },
  );
});

commander.command("migration:generate <name>").action((name: string) => {
  exec(
    `typeorm migration:generate -n ${name}`,
    (code: any, stdout: any, stderr: any) => {
      if (stderr) {
        console.log("migration error:", stderr);
        return;
      }
      console.log("migration output:", stdout);
    },
  );
});

commander.command("test:ormConfig").action(() => {
  try {
    const ormConfig = require("../config/ormconfig.test.json");
    const fileData = `#!/usr/bin/env bash
        psql -U postgres -c "CREATE DATABASE ${ormConfig.database};"
        psql -U postgres -c "CREATE USER ${ormConfig.username} WITH PASSWORD '${
      ormConfig.password
    }'"
        psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE ${
          ormConfig.database
        } TO ${ormConfig.username};"`;
    writeFileSync(
      join(process.cwd(), "scripts", "database.setup.sh"),
      fileData,
    );
  } catch (error) {
    throw new Error("Failed to create a database.config for test");
  }
});

commander.command("production:ormConfig").action(() => {
  try {
    const ormConfig = require("../config/ormconfig.production.json");
    const fileData = `#!/usr/bin/env bash
        psql -U postgres -c "CREATE DATABASE ${ormConfig.database};"
        psql -U postgres -c "CREATE USER ${ormConfig.username} WITH PASSWORD '${
      ormConfig.password
    }'"
        psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE ${
          ormConfig.database
        } TO ${ormConfig.username};"`;
    writeFileSync(
      join(process.cwd(), "scripts", "database.setup.sh"),
      fileData,
    );
  } catch (error) {
    throw new Error("Failed to create a database.config for test");
  }
});

commander.command("*").action(async () => {
  console.log(
    "No command has been catched please use -h for display all commands",
  );
});

commander.parse(process.argv);
