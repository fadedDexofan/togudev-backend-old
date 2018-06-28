import { HttpError } from "routing-controllers";
import { ApiErrorEnum } from "../errors/apiErrorEnum";

export class ApiError extends HttpError {
  public code: ApiErrorEnum;
  public message: string;

  constructor(code: ApiErrorEnum, message: string = "") {
    super(200);
    Object.setPrototypeOf(this, ApiError.prototype);
    this.code = code;
    this.message = message;
  }

  public toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
      },
    };
  }
}
