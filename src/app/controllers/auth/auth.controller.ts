import * as jwt from "jsonwebtoken";
import { Context } from "koa";
import moment from "moment";
import {
  Authorized,
  BadRequestError,
  Body,
  BodyParam,
  Ctx,
  CurrentUser,
  Get,
  HttpCode,
  HttpError,
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
    @Ctx() ctx: Context,
    @BodyParam("password") password: string,
  ) {
    const phoneToken = this.jwtService.extractToken(ctx.headers);
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
      await this.roleRepository.createRole("user");
      role = await this.roleRepository.getRoleByName("user");
      if (!role) {
        throw new HttpError(500, "Role creation error");
      }
    }

    const newUser = new User();

    newUser.phoneNumber = phoneNumber;
    newUser.password = password;
    newUser.roles = [role];
    newUser.profile = new Profile();

    try {
      const createdUser: User = await this.userRepository.save(newUser);
      delete createdUser.password;
      return createdUser;
    } catch (err) {
      if (err.name === "QueryFailedError") {
        throw new UserAlreadyExistsError(
          "User with this credentials already exists",
        );
      } else {
        throw new InternalServerError(err);
      }
    }
  }

  @Post("/login")
  public async login(
    @Ctx() ctx: Context,
    @Body({ validate: false })
    loginData: User,
  ) {
    const { phoneNumber, password } = loginData;

    const user = await this.userRepository
      .createQueryBuilder("user")
      .leftJoinAndSelect("user.refreshTokens", "refreshToken")
      .leftJoinAndSelect("user_roles", "role", "role.userUuid = user.uuid")
      .addSelect("user.password")
      .where("user.phoneNumber = :phoneNumber", { phoneNumber })
      .getOne();

    if (!user) {
      throw new UserNotFoundError("User with this credentials not found");
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

    await this.userRepository.save(user);

    return {
      accessToken: accessToken.token,
      refreshToken,
      expires_in: accessToken.exp,
    };
  }

  @Post("/refresh-tokens")
  public async refreshTokens(
    @Ctx() ctx: Context,
    @BodyParam("refreshToken") refreshToken: string,
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
      throw new NotFoundError("Token not found");
    }
    try {
      const _valid = await this.jwtService.verify(refreshToken);
    } catch (err) {
      await this.refreshRepository.remove(tokenInDB);
      throw new HttpError(403, "Invalid Refresh Token");
    }
    if (expired) {
      await this.refreshRepository.remove(tokenInDB);
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
    await this.refreshRepository.save(rToken);

    return {
      accessToken: newAccessToken.token,
      refreshToken: newRefreshToken,
      expires_in: newAccessToken.exp,
    };
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
        message: "User tokens successfully reseted. You need to relogin",
      };
    } catch (err) {
      throw new InternalServerError(err);
    }
  }

  @Post("/verification")
  public async phoneVerification(
    @BodyParam("phoneNumber") phoneNumber: string,
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
    await this.phoneVerificationRepository.save(searchResult);
    try {
      await this.smsService.sendSMS(
        phoneNumber,
        `Ваш проверочный код для togudev.ru: ${generatedCode}`,
      );
    } catch (err) {
      throw new InternalServerError("Ошибка отправки SMS сообщения");
    }
    return {
      status: 200,
      message: `Проверочный код отправлен на номер ${phoneNumber}`,
    };
  }

  @Post("/verification/code")
  public async codeVerification(
    @BodyParam("phoneNumber") phoneNumber: string,
    @BodyParam("verificationCode") verificationCode: number,
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
    } catch (err) {
      throw new InternalServerError(err);
    }
    const phoneToken = await this.jwtService.sign(
      { phoneToken: true, phoneNumber },
      { algorithm: "HS512", expiresIn: "1d" },
    );
    return {
      status: 200,
      message: "Номер успешно подтвержден",
      phoneToken,
    };
  }
}
