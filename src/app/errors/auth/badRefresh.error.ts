import { BadRequestError } from "routing-controllers";

export class BadRefreshTokenError extends BadRequestError {
  constructor(message: string = "Bad Refresh Token format") {
    super(message);
    this.name = "BadRefreshTokenError";
  }
}
