import Raven from "raven";

import config from "../../config/config.json";

const ravenDSN = config.raven.dsn;

Raven.config(ravenDSN).install();

export { Raven };
