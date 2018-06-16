import config from "config";
import Raven from "raven";

const ravenDSN = config.get("raven.dsn");

Raven.config(ravenDSN).install();

export { Raven };
