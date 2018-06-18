import { compare, hash } from "bcryptjs";
import { Service } from "typedi";

import config from "../../config/config.json";

const SALT_ROUNDS: number = config.auth.saltRounds || 10;

@Service()
export class BcryptService {
  public async hashString(
    plainText: string,
    saltRounds: number = SALT_ROUNDS,
  ): Promise<string> {
    return hash(plainText, saltRounds);
  }

  public async compareHash(
    plainText: string,
    hashString: string,
  ): Promise<boolean> {
    return compare(plainText, hashString);
  }
}
