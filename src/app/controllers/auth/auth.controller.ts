import * as jwt from "jsonwebtoken";
import moment from "moment";
import {
  Authorized,
  BadRequestError,
  BodyParam,
  CurrentUser,
  Get,
  HeaderParams,
  HttpCode,
  InternalServerError,
  JsonController,
  NotFoundError,
  Post,
} from "routing-controllers";
import { Service } from "typedi";
import { InjectRepository } from "typeorm-typedi-extensions";
import { isMobilePhone } from "validator";

import {
  PhoneVerification,
  Profile,
  RefreshToken,
  User,
} from "../../../db/entities";
import {
  PhoneVerificationRepository,
  RefreshRepository,
  RoleRepository,
  UserRepository,
} from "../../../db/repositories";
import { JWTService } from "../../../services";
import { SMSService } from "../../../services/sms.service";
import { logger, Raven } from "../../../utils";
import {
  BadRefreshTokenError,
  UserAlreadyExistsError,
  UserNotFoundError,
  WrongPasswordError,
} from "../../errors";

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
    private jwtService: JWTService,
    private smsService: SMSService,
  ) {}

  @HttpCode(201)
  @Post("/register")
  public async register(
    @HeaderParams() headers: any,
    @BodyParam("password", { required: true })
    password: string,
  ) {
    if (password.length < 6 || password.length > 24) {
      throw new BadRequestError("Пароль должен быть от 6 до 24 символов");
    }

    const phoneToken = this.jwtService.extractToken(headers);
    if (!phoneToken) {
      throw new BadRequestError(
        "Не передан токен регистрации или он имеет неверный формат. Используйте Authorization: Bearer <token>",
      );
    }

    interface IPhoneToken {
      phoneToken: boolean;
      phoneNumber: string;
    }

    const { phoneNumber } = (await this.jwtService.verify(
      phoneToken,
    )) as IPhoneToken;

    const dupUser = await this.userRepository.getUserByPhone(phoneNumber);
    if (dupUser) {
      throw new UserAlreadyExistsError();
    }

    let role = await this.roleRepository.getRoleByName("user");
    if (!role) {
      try {
        await this.roleRepository.createRole("user");
      } catch (err) {
        logger.error(err);
        Raven.captureException(err);
        throw new InternalServerError('Не удалось создать роль "user"');
      }
      role = await this.roleRepository.getRoleByName("user");
      if (!role) {
        throw new InternalServerError("Ошибка создания роли");
      }
    }

    const newUser = new User();

    newUser.phoneNumber = phoneNumber;
    newUser.password = password;
    newUser.roles = [role];
    newUser.profile = new Profile();

    try {
      await this.userRepository.save(newUser);

      return { status: 201, message: "Пользователь успешно зарегистрирован" };
    } catch (err) {
      if (err.name === "QueryFailedError") {
        throw new UserAlreadyExistsError(
          "Пользователь с данным телефоном уже зарегистрирован",
        );
      } else {
        logger.error(err);
        Raven.captureException(err);
        throw new InternalServerError("Ошибка регистрации");
      }
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
      throw new UserNotFoundError("Пользователь с таким логином не найден");
    }

    const passwordIsCorrect = await user.checkPassword(password);

    if (!passwordIsCorrect) {
      throw new WrongPasswordError();
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

      return {
        accessToken: accessToken.token,
        refreshToken,
        expires_in: accessToken.exp,
      };
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new InternalServerError("Ошибка входа");
    }
  }

  @Post("/refresh-tokens")
  public async refreshTokens(
    @BodyParam("refreshToken", { required: true })
    refreshToken: string,
  ) {
    const tokenData: any = jwt.decode(refreshToken);
    if (!tokenData) {
      throw new BadRefreshTokenError();
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
      throw new NotFoundError("Токен не найден");
    }
    try {
      const _valid = await this.jwtService.verify(refreshToken);
    } catch (err) {
      try {
        await this.refreshRepository.remove(tokenInDB);
      } catch (err) {
        logger.error(err);
        Raven.captureException(err);
        throw new InternalServerError("Ошибка удаления токена");
      }
      throw new BadRefreshTokenError("Некорректный Refresh токен");
    }

    if (expired) {
      try {
        await this.refreshRepository.remove(tokenInDB);
      } catch (err) {
        logger.error(err);
        Raven.captureException(err);
        throw new InternalServerError("Ошибка удаления токена");
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

      return {
        accessToken: newAccessToken.token,
        refreshToken: newRefreshToken,
        expires_in: newAccessToken.exp,
      };
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new InternalServerError("Ошибка сохранения токена");
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

      return {
        message: "Токены отозваны. Перезайдите в систему",
      };
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new InternalServerError(err);
    }
  }

  @Post("/verification")
  public async phoneVerification(
    @BodyParam("phoneNumber", { required: true })
    phoneNumber: string,
  ) {
    const generatedCode = getRandomInt(1000, 10000);

    if (!isMobilePhone(phoneNumber, "ru-RU")) {
      throw new BadRequestError("Номер телефона имеет некорректный формат");
    }

    const alreadyRegistered = await this.userRepository.findOne({
      phoneNumber,
    });

    if (alreadyRegistered) {
      throw new UserAlreadyExistsError(
        "Пользователь с указанным номером уже зарегистрирована",
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
      throw new BadRequestError("Превышено количество СМС в минуту");
    }

    if (triesCount >= 3) {
      if (diffDays < 1) {
        throw new BadRequestError("Превышено количество СМС в сутки");
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
      throw new InternalServerError(
        "Ошибка создания заявки на подтверждение номера",
      );
    }

    try {
      const smsTask = await this.smsService.sendSMS(
        phoneNumber,
        `Ваш проверочный код: ${generatedCode}`,
      );

      if (smsTask === 100) {
        return {
          status: 200,
          message: `Проверочный код отправлен на номер ${phoneNumber}`,
        };
      } else {
        throw new Error(
          `Не удалось отправить СМС сообщение. status_code: ${smsTask}`,
        );
      }
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new InternalServerError("Ошибка отправки SMS сообщения");
    }
  }

  @Post("/verification/code")
  public async codeVerification(
    @BodyParam("phoneNumber", { required: true })
    phoneNumber: string,
    @BodyParam("verificationCode", { required: true })
    verificationCode: number,
  ) {
    const searchResult = await this.phoneVerificationRepository.findOne({
      phoneNumber,
    });

    const isCodeCorrect = verificationCode && !Number.isNaN(verificationCode);
    if (!isCodeCorrect) {
      throw new BadRequestError(
        "Не указан проверочный код или код имеет неверный формат",
      );
    }

    if (!searchResult) {
      throw new BadRequestError("Заявка на подтверждение не найдена");
    }

    const isCodeWrong =
      searchResult.verificationCode !== Number(verificationCode);

    if (isCodeWrong) {
      throw new BadRequestError("Указан неверный проверочный код");
    }

    try {
      await this.phoneVerificationRepository.remove(searchResult);
      const phoneToken = await this.jwtService.sign(
        { phoneToken: true, phoneNumber },
        { algorithm: "HS512", expiresIn: "1d" },
      );
      return {
        status: 200,
        message: "Номер успешно подтвержден",
        phoneToken,
      };
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new InternalServerError("Ошибка подтверждения номера");
    }
  }
}
