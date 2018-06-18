import Raven from "raven";

const ravenDSN = process.env.RAVEN_DSN;

Raven.config(ravenDSN).install();

export { Raven };
