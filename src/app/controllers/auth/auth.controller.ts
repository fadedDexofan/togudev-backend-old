import * as jwt from "jsonwebtoken";
import moment from "moment";
import {
  Authorized,
  BodyParam,
  CurrentUser,
  Get,
  HeaderParams,
  HttpCode,
  JsonController,
  Post,
} from "routing-controllers";
import { Service } from "typedi";
import { InjectRepository } from "typeorm-typedi-extensions";
import { isMobilePhone } from "validator";

import {
  PasswordReset,
  PhoneChange,
  PhoneVerification,
  Profile,
  RefreshToken,
  User,
} from "../../../db/entities";
import {
  PasswordResetRepository,
  PhoneChangeRepository,
  PhoneVerificationRepository,
  RefreshRepository,
  RoleRepository,
  UserRepository,
} from "../../../db/repositories";
import { BcryptService, JWTService, SMSService } from "../../../services";
import { logger, Raven } from "../../../utils";
import { ApiErrorEnum } from "../../errors";
import { ApiError, ApiResponse } from "../../helpers";

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min)) + min;
}

@Service()
@JsonController("/auth")
export class AuthController {
  constructor(
    @InjectRepository() private userRepository: UserRepository,
    @InjectRepository() private refreshRepository: RefreshRepository,
    @InjectRepository() private roleRepository: RoleRepository,
    @InjectRepository()
    private phoneVerificationRepository: PhoneVerificationRepository,
    @InjectRepository()
    private passwordResetRepository: PasswordResetRepository,
    @InjectRepository() private phoneChangeRepository: PhoneChangeRepository,
    private jwtService: JWTService,
    private bcryptService: BcryptService,
    private smsService: SMSService,
  ) {}

  @HttpCode(201)
  @Post("/register")
  public async register(
    @HeaderParams() headers: any,
    @BodyParam("password", { required: true })
    password: string,
  ) {
    const phoneToken = this.jwtService.extractToken(headers);

    if (!phoneToken) {
      throw new ApiError(
        ApiErrorEnum.BAD_REGISTRATION_TOKEN,
        "Не передан токен регистрации или он имеет неверный формат. Используйте Authorization: Bearer <token>",
      );
    }

    if (password.length < 6 || password.length > 24) {
      throw new ApiError(
        ApiErrorEnum.BAD_PASSWORD,
        "Пароль должен быть от 6 до 24 символов",
      );
    }

    interface IPhoneToken {
      phoneToken: boolean;
      phoneNumber: string;
    }

    let phoneNumber: string;

    try {
      const registerPayload = (await this.jwtService.verify(
        phoneToken,
      )) as IPhoneToken;

      phoneNumber = registerPayload.phoneNumber;
    } catch (err) {
      throw new ApiError(ApiErrorEnum.JsonWebTokenError, err.message);
    }

    const dupUser = await this.userRepository.getUserByPhone(phoneNumber);
    if (dupUser) {
      throw new ApiError(
        ApiErrorEnum.USER_EXISTS,
        "Пользователь с данным номером уже зарегистрирован",
      );
    }

    let role = await this.roleRepository.getRoleByName("user");

    if (!role) {
      try {
        await this.roleRepository.createRole("user");
      } catch (err) {
        logger.error(err);
        Raven.captureException(err);
        throw new ApiError(
          ApiErrorEnum.ROLE_CREATION,
          'Не удалось создать роль "user"',
        );
      }
      role = await this.roleRepository.getRoleByName("user");
      if (!role) {
        throw new ApiError(ApiErrorEnum.ROLE_CREATION, "Ошибка создания роли");
      }
    }

    const newUser = new User();

    newUser.phoneNumber = phoneNumber;

    password = await this.bcryptService.hashString(password);
    newUser.password = password;

    newUser.roles = [role];
    newUser.profile = new Profile();
    newUser.achievements = [];

    try {
      await this.userRepository.save(newUser);
      logger.info(`Пользователь [${newUser.phoneNumber}] зарегистрировался`);

      return new ApiResponse({
        message: "Пользователь успешно зарегистрирован",
      });
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new ApiError(ApiErrorEnum.REGISTRATION, "Ошибка регистрации");
    }
  }

  @Post("/login")
  public async login(
    @BodyParam("phoneNumber", { required: true })
    phoneNumber: string,
    @BodyParam("password", { required: true })
    password: string,
  ) {
    const user = await this.userRepository
      .createQueryBuilder("user")
      .leftJoinAndSelect("user.refreshTokens", "refreshToken")
      .leftJoinAndSelect("user_roles", "role", "role.userUuid = user.uuid")
      .addSelect("user.password")
      .where("user.phoneNumber = :phoneNumber", { phoneNumber })
      .getOne();

    if (!user) {
      throw new ApiError(
        ApiErrorEnum.NOT_FOUND,
        "Пользователь с таким логином не найден",
      );
    }

    const passwordIsCorrect = await user.checkPassword(password);

    if (!passwordIsCorrect) {
      throw new ApiError(ApiErrorEnum.WRONG_PASSWORD, "Неверный пароль");
    }

    const accessToken = await this.jwtService.makeAccessToken(user);
    const refreshToken = await this.jwtService.makeRefreshToken(user);

    const rToken = new RefreshToken();
    rToken.refreshToken = refreshToken;

    if (user.refreshTokens!.length >= 10) {
      await this.refreshRepository.dropUserTokens(user);
      user.refreshTokens! = [];
    }

    user.refreshTokens!.push(rToken);

    try {
      await this.userRepository.save(user);

      return new ApiResponse({
        accessToken: accessToken.token,
        refreshToken,
        expires_in: accessToken.exp,
      });
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new ApiError(ApiErrorEnum.LOGIN_FAIL, "Ошибка входа");
    }
  }

  @Post("/refresh-tokens")
  public async refreshTokens(
    @BodyParam("refreshToken", { required: true })
    refreshToken: string,
  ) {
    const tokenData: any = jwt.decode(refreshToken);
    if (!tokenData) {
      throw new ApiError(
        ApiErrorEnum.BAD_REFRESH_TOKEN,
        "Некорректный Refresh Token",
      );
    }
    const expired = tokenData.exp < new Date().getTime() / 1000;
    const uuid = tokenData.sub;
    const tokenInDB = await this.refreshRepository.findOne({
      where: {
        user: uuid,
        refreshToken,
      },
    });

    if (!tokenInDB) {
      throw new ApiError(ApiErrorEnum.NOT_FOUND, "Токен не найден");
    }

    try {
      await this.jwtService.verify(refreshToken);
    } catch (err) {
      try {
        await this.refreshRepository.remove(tokenInDB);
      } catch (err) {
        logger.error(err);
        Raven.captureException(err);
        throw new ApiError(
          ApiErrorEnum.TOKEN_REMOVAL,
          "Ошибка удаления токена",
        );
      }
      throw new ApiError(
        ApiErrorEnum.BAD_REFRESH_TOKEN,
        "Некорректный Refresh токен",
      );
    }

    if (expired) {
      try {
        await this.refreshRepository.remove(tokenInDB);
      } catch (err) {
        logger.error(err);
        Raven.captureException(err);
        throw new ApiError(
          ApiErrorEnum.TOKEN_REMOVAL,
          "Ошибка удаления токена",
        );
      }
    }

    const newAccessToken = await this.jwtService.makeAccessToken(
      tokenInDB.user,
    );
    const newRefreshToken = await this.jwtService.makeRefreshToken(
      tokenInDB.user,
    );

    const rToken = new RefreshToken();
    rToken.refreshToken = newRefreshToken;
    rToken.user = tokenInDB.user;

    try {
      await this.refreshRepository.remove(tokenInDB);
      await this.refreshRepository.save(rToken);

      return new ApiResponse({
        accessToken: newAccessToken.token,
        refreshToken: newRefreshToken,
        expires_in: newAccessToken.exp,
      });
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new ApiError(
        ApiErrorEnum.TOKEN_REFRESH,
        "Ошибка обновления токена",
      );
    }
  }

  @Authorized(["user"])
  @Get("/reset-tokens")
  public async resetTokens(@CurrentUser() user: User) {
    const userTokens = await this.refreshRepository.find({
      where: { user: user.uuid },
    });

    try {
      await this.refreshRepository.remove(userTokens);

      return new ApiResponse({
        message: "Токены отозваны. Перезайдите в систему",
      });
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new ApiError(ApiErrorEnum.TOKEN_RESET, "Ошибка сброса токенов");
    }
  }

  @Post("/verification")
  public async phoneVerification(
    @BodyParam("phoneNumber", { required: true })
    phoneNumber: string,
  ) {
    const generatedCode = getRandomInt(10000, 100000);

    if (!isMobilePhone(phoneNumber, "ru-RU")) {
      throw new ApiError(
        ApiErrorEnum.BAD_PHONE,
        "Номер телефона имеет некорректный формат",
      );
    }

    const alreadyRegistered = await this.userRepository.findOne({
      phoneNumber,
    });

    if (alreadyRegistered) {
      throw new ApiError(
        ApiErrorEnum.USER_EXISTS,
        "Пользователь с указанным номером уже зарегистрирован",
      );
    }

    let searchResult = await this.phoneVerificationRepository.findOne({
      phoneNumber,
    });

    if (!searchResult) {
      searchResult = new PhoneVerification();
      searchResult.phoneNumber = phoneNumber;
      searchResult.verificationCode = generatedCode;
      searchResult.attempts = 0;
      searchResult = await this.phoneVerificationRepository.create(
        searchResult,
      );
    }

    const { attempts: triesCount, updatedAt } = searchResult;
    const diffDays = moment().diff(moment(updatedAt), "d");
    const diffSeconds = moment().diff(moment(updatedAt), "s");

    if (triesCount >= 1 && diffSeconds < 60) {
      throw new ApiError(
        ApiErrorEnum.SMS_MINUTE_LIMIT,
        "Превышено количество СМС в минуту",
      );
    }

    if (triesCount >= 3) {
      if (diffDays < 1) {
        throw new ApiError(
          ApiErrorEnum.SMS_DAILY_LIMIT,
          "Превышено количество СМС в сутки",
        );
      } else {
        searchResult.attempts = 0;
      }
    }

    searchResult.attempts += 1;
    searchResult.verificationCode = generatedCode;

    try {
      await this.phoneVerificationRepository.save(searchResult);
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new ApiError(
        ApiErrorEnum.VERIFICATION_CREATE,
        "Ошибка создания заявки на подтверждение номера",
      );
    }

    try {
      const smsTask = await this.smsService.sendSMS(
        phoneNumber,
        `Ваш проверочный код: ${generatedCode}`,
      );

      if (smsTask === 100) {
        logger.info(`СМС подтверждение отправлено на номер [${phoneNumber}]`);
        return new ApiResponse({
          message: `Проверочный код отправлен на номер ${phoneNumber}`,
        });
      } else {
        logger.warn(
          `Не удалось отправить СМС подтверждение на номер [${phoneNumber}]. Код ошибки: ${smsTask}`,
        );
        throw new Error(
          `Не удалось отправить СМС сообщение. status_code: ${smsTask}`,
        );
      }
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new ApiError(
        ApiErrorEnum.SMS_SEND,
        "Ошибка отправки SMS сообщения",
      );
    }
  }

  @Post("/verification/code")
  public async codeVerification(
    @BodyParam("phoneNumber", { required: true })
    phoneNumber: string,
    @BodyParam("verificationCode", { required: true })
    verificationCode: string,
  ) {
    if (!isMobilePhone(phoneNumber, "ru-RU")) {
      throw new ApiError(
        ApiErrorEnum.BAD_PHONE,
        "Номер телефона имеет некорректный формат",
      );
    }

    const searchResult = await this.phoneVerificationRepository.findOne({
      phoneNumber,
    });

    const isCodeCorrect =
      verificationCode && verificationCode.trim().match(/^\d{5}$/);

    if (!isCodeCorrect) {
      throw new ApiError(
        ApiErrorEnum.BAD_VERIFICATION_CODE,
        "Не указан проверочный код или код имеет неверный формат",
      );
    }

    if (!searchResult) {
      throw new ApiError(
        ApiErrorEnum.VERIFICATION_NOTFOUND,
        "Заявка на подтверждение не найдена",
      );
    }

    const isCodeWrong =
      searchResult.verificationCode !== Number(verificationCode);

    if (isCodeWrong) {
      throw new ApiError(
        ApiErrorEnum.WRONG_VERIFICATION_CODE,
        "Указан неверный проверочный код",
      );
    }

    try {
      await this.phoneVerificationRepository.remove(searchResult);
      const phoneToken = await this.jwtService.sign(
        { phoneToken: true, phoneNumber },
        { algorithm: "HS512", expiresIn: "1d" },
      );
      logger.info(`Номер [${phoneNumber}] успешно подтвержден`);

      return new ApiResponse({ phoneToken });
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new ApiError(
        ApiErrorEnum.PHONE_VERIFICATION,
        "Ошибка подтверждения номера",
      );
    }
  }

  @Authorized(["user"])
  @Post("/password")
  public async changePassword(
    @CurrentUser() user: User,
    @BodyParam("oldPassword", { required: true })
    oldPassword: string,
    @BodyParam("newPassword", { required: true })
    newPassword: string,
  ) {
    if (newPassword.length < 6 || newPassword.length > 24) {
      throw new ApiError(
        ApiErrorEnum.BAD_PASSWORD,
        "Пароль должен быть от 6 до 24 символов",
      );
    }

    newPassword = await this.bcryptService.hashString(newPassword);

    const userWithPassoword = await this.userRepository
      .createQueryBuilder("user")
      .addSelect("user.password")
      .where("user.uuid = :uuid", { uuid: user.uuid })
      .getOne();

    const oldPasswordIsCorrect = await userWithPassoword!.checkPassword(
      oldPassword,
    );

    if (!oldPasswordIsCorrect) {
      throw new ApiError(ApiErrorEnum.WRONG_PASSWORD, "Неверный пароль");
    }

    userWithPassoword!.password = newPassword;

    try {
      await this.userRepository.save(userWithPassoword!);
      return new ApiResponse({ message: "Пароль успешно изменен" });
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new ApiError(
        ApiErrorEnum.PASSWORD_CHANGE,
        "Ошибка изменения пароля",
      );
    }
  }

  @Post("/password/reset")
  public async passwordReset(
    @BodyParam("phoneNumber", { required: true })
    phoneNumber: string,
  ) {
    if (!isMobilePhone(phoneNumber, "ru-RU")) {
      throw new ApiError(
        ApiErrorEnum.BAD_PHONE,
        "Номер телефона имеет некорректный формат",
      );
    }

    const userExists = await this.userRepository.getUserByPhone(phoneNumber);

    if (!userExists) {
      throw new ApiError(
        ApiErrorEnum.USER_DONT_EXISTS,
        "Пользователь с данным номером телефона не найден",
      );
    }

    const generatedCode = getRandomInt(10000, 100000);

    let searchResult = await this.passwordResetRepository.findOne({
      where: { phoneNumber },
    });

    if (!searchResult) {
      const passwordResetRequest = new PasswordReset();
      passwordResetRequest.phoneNumber = phoneNumber;
      passwordResetRequest.verificationCode = generatedCode;
      passwordResetRequest.attempts = 0;
      searchResult = await this.passwordResetRepository.create(
        passwordResetRequest,
      );
    }

    const { attempts: triesCount, updatedAt } = searchResult;
    const diffDays = moment().diff(moment(updatedAt), "d");
    const diffSeconds = moment().diff(moment(updatedAt), "s");

    if (triesCount === 1 && diffSeconds < 60) {
      throw new ApiError(
        ApiErrorEnum.SMS_MINUTE_LIMIT,
        "Превышено количество СМС в минуту",
      );
    }

    if (triesCount >= 3) {
      if (diffDays < 1) {
        throw new ApiError(
          ApiErrorEnum.SMS_DAILY_LIMIT,
          "Превышено количество СМС в сутки",
        );
      } else {
        searchResult.attempts = 0;
      }
    }

    searchResult.attempts += 1;
    searchResult.verificationCode = generatedCode;

    try {
      await this.passwordResetRepository.save(searchResult);
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new ApiError(
        ApiErrorEnum.PASSWORD_RESET_CREATE,
        "Ошибка создания заявки на сброс пароля",
      );
    }

    try {
      const smsTask = await this.smsService.sendSMS(
        phoneNumber,
        `Код для сброса пароля: ${generatedCode}`,
      );

      if (smsTask === 100) {
        logger.info(
          `СМС подтверждение для сброса пароля отправлено на номер [${phoneNumber}]`,
        );
        return new ApiResponse({
          message: `Проверочный код отправлен на номер ${phoneNumber}`,
        });
      } else {
        logger.warn(
          `Не удалось отправить СМС подтверждение на номер [${phoneNumber}]. Код ошибки: ${smsTask}`,
        );
        throw new Error(
          `Не удалось отправить СМС сообщение. status_code: ${smsTask}`,
        );
      }
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new ApiError(
        ApiErrorEnum.SMS_SEND,
        "Ошибка отправки SMS сообщения",
      );
    }
  }

  @Post("/password/reset/confirm")
  public async confirmPasswordReset(
    @BodyParam("phoneNumber", { required: true })
    phoneNumber: string,
    @BodyParam("verificationCode", { required: true })
    verificationCode: string,
  ) {
    if (!isMobilePhone(phoneNumber, "ru-RU")) {
      throw new ApiError(
        ApiErrorEnum.BAD_PHONE,
        "Номер телефона имеет некорректный формат",
      );
    }

    const searchResult = await this.passwordResetRepository.findOne({
      phoneNumber,
    });

    const isCodeCorrect =
      verificationCode && verificationCode.trim().match(/^\d{5}$/);

    if (!isCodeCorrect) {
      throw new ApiError(
        ApiErrorEnum.BAD_VERIFICATION_CODE,
        "Не указан проверочный код или код имеет неверный формат",
      );
    }

    if (!searchResult) {
      throw new ApiError(
        ApiErrorEnum.PASSWORD_RESET_NOTFOUND,
        "Заявка на сброс пароля не найдена",
      );
    }

    const isCodeWrong =
      searchResult.verificationCode !== Number(verificationCode);

    if (isCodeWrong) {
      throw new ApiError(
        ApiErrorEnum.WRONG_PASSWORD_RESET_CODE,
        "Указан неверный проверочный код",
      );
    }

    try {
      const passwordResetToken = await this.jwtService.sign(
        { passwordResetToken: true, phoneNumber },
        { algorithm: "HS512", expiresIn: "1d" },
      );

      searchResult.verificationToken = passwordResetToken;
      await this.passwordResetRepository.save(searchResult);

      logger.info(`Заявка на сброс пароля для [${phoneNumber}] подтверждена`);

      return new ApiResponse({ passwordResetToken });
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new ApiError(
        ApiErrorEnum.PASSWORD_RESET_CONFIRM,
        "Ошибка подтверждения сброса пароля",
      );
    }
  }

  @Post("/password/reset/change")
  public async setNewPassword(
    @HeaderParams() headers: any,
    @BodyParam("newPassword", { required: true })
    newPassword: string,
  ) {
    const passwordResetToken = this.jwtService.extractToken(headers);

    if (!passwordResetToken) {
      throw new ApiError(
        ApiErrorEnum.BAD_PASSWORD_RESET_TOKEN,
        "Не передан токен сброса пароля или он имеет неверный формат. Используйте Authorization: Bearer <token>",
      );
    }

    if (newPassword.length < 6 || newPassword.length > 24) {
      throw new ApiError(
        ApiErrorEnum.BAD_PASSWORD,
        "Пароль должен быть от 6 до 24 символов",
      );
    }

    interface IPasswordResetToken {
      passwordResetToken: boolean;
      phoneNumber: string;
    }

    let phoneNumber: string;

    try {
      const resetTokenPayload = (await this.jwtService.verify(
        passwordResetToken,
      )) as IPasswordResetToken;

      phoneNumber = resetTokenPayload.phoneNumber;
    } catch (err) {
      throw new ApiError(ApiErrorEnum.JsonWebTokenError, err.message);
    }

    const resetRequest = await this.passwordResetRepository.findOne({
      where: { verificationToken: passwordResetToken },
    });

    if (!resetRequest) {
      throw new ApiError(
        ApiErrorEnum.PASSWORD_RESET_REQUEST_NOTFOUND,
        "Заявка на сброс для данного токена не найдена",
      );
    }

    const user = await this.userRepository
      .createQueryBuilder("user")
      .addSelect("user.password")
      .where("user.phoneNumber = :phoneNumber", { phoneNumber })
      .getOne();

    if (!user) {
      throw new ApiError(
        ApiErrorEnum.NOT_FOUND,
        "Пользователь с таким логином не найден",
      );
    }

    user.password = await this.bcryptService.hashString(newPassword);

    try {
      await this.userRepository.save(user);
      await this.passwordResetRepository.remove(resetRequest);
      logger.info(
        `Пользователь [${user.phoneNumber}] сбросил и изменил пароль`,
      );

      return new ApiResponse({ message: "Пароль успешно изменен" });
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new ApiError(ApiErrorEnum.PASSWORD_RESET, "Ошибка сброса пароля");
    }
  }

  @Authorized(["user"])
  @Post("/phone/change")
  public async phoneChange(
    @CurrentUser() user: User,
    @BodyParam("newPhone", { required: true })
    newPhone: string,
  ) {
    if (!isMobilePhone(newPhone, "ru-RU")) {
      throw new ApiError(
        ApiErrorEnum.BAD_PHONE,
        "Номер телефона имеет некорректный формат",
      );
    }

    const alreadyTaken = await this.userRepository.getUserByPhone(newPhone);

    if (alreadyTaken) {
      throw new ApiError(
        ApiErrorEnum.PHONE_ALREADY_TAKEN,
        "Указанный номер телефона уже занят",
      );
    }

    const generatedCode = getRandomInt(10000, 100000);

    let searchResult = await this.phoneChangeRepository.findOne({
      where: { oldPhone: user.phoneNumber },
    });

    if (!searchResult) {
      const phoneChangeRequest = new PhoneChange();
      phoneChangeRequest.oldPhone = user.phoneNumber;
      phoneChangeRequest.newPhone = newPhone;
      phoneChangeRequest.verificationCode = generatedCode;
      phoneChangeRequest.attempts = 0;
      searchResult = await this.phoneChangeRepository.create(
        phoneChangeRequest,
      );
    }

    const { attempts: triesCount, updatedAt } = searchResult;
    const diffDays = moment().diff(moment(updatedAt), "d");
    const diffSeconds = moment().diff(moment(updatedAt), "s");

    if (triesCount === 1 && diffSeconds < 60) {
      throw new ApiError(
        ApiErrorEnum.SMS_MINUTE_LIMIT,
        "Превышено количество СМС в минуту",
      );
    }

    if (triesCount >= 3) {
      if (diffDays < 1) {
        throw new ApiError(
          ApiErrorEnum.SMS_DAILY_LIMIT,
          "Превышено количество СМС в сутки",
        );
      } else {
        searchResult.attempts = 0;
      }
    }

    searchResult.attempts += 1;
    searchResult.verificationCode = generatedCode;

    try {
      await this.phoneChangeRepository.save(searchResult);
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new ApiError(
        ApiErrorEnum.PHONE_CHANGE_CREATE,
        "Ошибка создания заявки на изменение номера",
      );
    }

    try {
      const smsTask = await this.smsService.sendSMS(
        newPhone,
        `Код для изменение номера: ${generatedCode}`,
      );

      if (smsTask === 100) {
        logger.info(
          `СМС подтверждение для смены номера телефона отправлено на номер [${newPhone}]`,
        );
        return new ApiResponse({
          message: `Проверочный код отправлен на номер ${newPhone}`,
        });
      } else {
        logger.warn(
          `Не удалось отправить СМС подтверждение на номер [${newPhone}]. Код ошибки: ${smsTask}`,
        );
        throw new Error(
          `Не удалось отправить СМС сообщение. status_code: ${smsTask}`,
        );
      }
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new ApiError(
        ApiErrorEnum.SMS_SEND,
        "Ошибка отправки SMS сообщения",
      );
    }
  }

  @Authorized(["user"])
  @Post("/phone/change/confirm")
  public async phoneChangeConfirm(
    @CurrentUser() user: User,
    @BodyParam("verificationCode", { required: true })
    verificationCode: string,
  ) {
    const isCodeCorrect =
      verificationCode && verificationCode.trim().match(/^\d{5}$/);

    if (!isCodeCorrect) {
      throw new ApiError(
        ApiErrorEnum.BAD_VERIFICATION_CODE,
        "Не указан проверочный код или код имеет неверный формат",
      );
    }

    const searchResult = await this.phoneChangeRepository.findOne({
      where: { oldPhone: user.phoneNumber },
    });

    if (!searchResult) {
      throw new ApiError(
        ApiErrorEnum.PHONE_CHANGE_NOTFOUND,
        "Заявка на изменение номера не найдена",
      );
    }

    const alreadyTaken = await this.userRepository.getUserByPhone(
      searchResult.newPhone,
    );

    if (alreadyTaken) {
      try {
        await this.phoneChangeRepository.remove(searchResult);
      } catch (err) {
        logger.error(err);
        Raven.captureException(err);
        throw new ApiError(
          ApiErrorEnum.PHONE_CHANGE_REMOVE,
          "Ошибка удаления заявки на смену номера",
        );
      }
      throw new ApiError(
        ApiErrorEnum.PHONE_ALREADY_TAKEN,
        "Указанный номер телефона уже занят. Заявка удалена.",
      );
    }

    const isCodeWrong =
      searchResult.verificationCode !== Number(verificationCode);

    if (isCodeWrong) {
      throw new ApiError(
        ApiErrorEnum.WRONG_PHONE_CHANGE_CODE,
        "Указан неверный проверочный код",
      );
    }

    try {
      user.phoneNumber = searchResult.newPhone;
      await this.userRepository.save(user);

      return new ApiResponse({
        message: `Ваш номер успешно изменен на ${user.phoneNumber}`,
      });
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new ApiError(
        ApiErrorEnum.PHONE_CHANGE_CONFIRM,
        "Ошибка изменения номера",
      );
    }
  }
}
