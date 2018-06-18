import { decode, sign, verify } from "jsonwebtoken";
import { Service } from "typedi";
import { User } from "../db/entities";

import config from "../../config/config.json";

const JWT_SECRET: string = config.auth.jwtSecret || "secret";

@Service()
export class JWTService {
  public async sign(payload: any, options: any) {
    return sign(payload, JWT_SECRET, options);
  }

  public async verify(token: string) {
    return verify(token, JWT_SECRET);
  }

  public extractToken(headers: any) {
    let token: string =
      headers && headers.authorization ? headers.authorization : "";
    token = token.replace(/Bearer\s+/gm, "");
    return token;
  }

  public async makeAccessToken(user: User) {
    const configAccess = {
      payload: {
        accessToken: true,
        phoneNumber: user.phoneNumber,
      },
      options: {
        algorithm: "HS512",
        subject: user.uuid,
        expiresIn: "30m",
      },
    };
    const token = await this.sign(configAccess.payload, configAccess.options);
    const tokenData = decode(token);
    // @ts-ignore
    const exp = tokenData.exp;
    return { token, exp };
  }

  public async makeRefreshToken(user: User) {
    const configRefresh = {
      payload: {
        refreshToken: true,
        phoneNumber: user.phoneNumber,
      },
      options: {
        algorithm: "HS512",
        subject: user.uuid,
        expiresIn: "60d",
      },
    };

    return this.sign(configRefresh.payload, configRefresh.options);
  }
}
