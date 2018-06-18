import dotenv from "dotenv";
dotenv.config();

import { Container } from "typedi";
import { App } from "./app/app";
import { Database } from "./db/database";

import { logger, Raven } from "./utils";

const PORT = process.env.PORT || 3000;

const app = Container.get(App).getApp();
const database = Container.get(Database);

database.connect().then(async () => {
  app.listen(PORT, () => {
    logger.info(`Server started at http://localhost:${PORT}`);
    if (process.send) {
      process.send!("ready");
    }
  });
});

process.on("SIGINT", () => {
  database
    .disconnect()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      logger.error(err);
      Raven.captureException(err);
      process.exit(1);
    });
});
