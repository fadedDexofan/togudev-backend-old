import { HttpError } from "routing-controllers";
import { ApiErrorEnum } from "../errors/apiErrorEnum";

export class ApiError extends HttpError {
  public code: ApiErrorEnum;
  public message: string;

  constructor(code: ApiErrorEnum, message: string = "") {
    let httpCode;
    if (code >= 100 && code < 200) {
      httpCode = 400;
    } else if (code >= 200 && code < 300) {
      httpCode = 500;
    } else if (code === 404) {
      httpCode = 404;
    } else if (code === 401) {
      httpCode = 401;
    } else {
      httpCode = 400;
    }

    super(httpCode);

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
