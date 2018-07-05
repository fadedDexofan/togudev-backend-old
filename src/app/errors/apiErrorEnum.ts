export enum ApiErrorEnum {
  UNAUTHORIZED = 401,
  NOT_FOUND = 404,
  WRONG_PASSWORD = 100,
  BAD_PASSWORD = 101,
  BAD_REGISTRATION_TOKEN = 102,
  BAD_REFRESH_TOKEN = 103,
  BAD_EMAIL = 104,
  USER_EXISTS = 105,
  DIRECTION_EXISTS = 106,
  BAD_VERIFICATION_CODE = 108,
  BAD_PHONE = 109,
  WRONG_VERIFICATION_CODE = 110,
  VERIFICATION_NOTFOUND = 111,
  SMS_DAILY_LIMIT = 112,
  SMS_MINUTE_LIMIT = 113,
  TOKEN_REQUIRED = 114,
  BAD_UUID = 115,
  ALREADY_IN_DIRECTION = 116,
  ALREADY_APPLIED = 117,
  TOKEN_EXPIRED = 118,
  NOT_A_NUMBER = 119,
  ROLE_CREATION = 200,
  REGISTRATION = 201,
  ACHIEVEMENT_GIVE = 202,
  APPLICATION_APPROVE = 203,
  APPLICATION_DECLINE = 204,
  PROFILE_EDIT = 205,
  RATING_ADD = 206,
  APPLICATION_CREATE = 207,
  DIRECTION_CREATE = 208,
  DIRECTION_EDIT = 209,
  LOGIN_FAIL = 210,
  TOKEN_REMOVAL = 211,
  TOKEN_REFRESH = 212,
  TOKEN_RESET = 213,
  SMS_SEND = 214,
  PHONE_VERIFICATION = 215,
  VERIFICATION_CREATE = 216,
  PASSWORD_CHANGE = 217,
}
