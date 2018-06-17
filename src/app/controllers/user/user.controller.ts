import {
  Authorized,
  Body,
  CurrentUser,
  Get,
  InternalServerError,
  JsonController,
  NotFoundError,
  OnUndefined,
  Param,
  Patch,
} from "routing-controllers";
import { Service } from "typedi";
import { InjectRepository } from "typeorm-typedi-extensions";

import { Profile, User } from "../../../db/entities";
import { RatingRepository, UserRepository } from "../../../db/repositories";
import { logger, Raven } from "../../../utils";
import { UserNotFoundError } from "../../errors";

@Service()
@JsonController("/users")
export class UserController {
  constructor(
    @InjectRepository() private userRepository: UserRepository,
    @InjectRepository() private ratingRepository: RatingRepository,
  ) {}
  @Authorized(["user"])
  @Get("/profile")
  public async profile(@CurrentUser() user: User) {
    if (!user) {
      return new NotFoundError("Текущий пользователь не найден");
    }

    return user;
  }

  @Authorized(["user"])
  @Patch("/profile")
  public async updateProfile(
    @CurrentUser() user: User,
    @Body() profile: Profile,
  ) {
    user.profile = profile;
    try {
      await this.userRepository.save(user);
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new InternalServerError("Не удалось отредактировать профиль");
    }
  }

  @Authorized(["user"])
  @Get("/profile/:uuid")
  @OnUndefined(UserNotFoundError)
  public async getUser(@Param("uuid") uuid: string) {
    return this.userRepository.getUserByUuid(uuid);
  }

  @Authorized(["user"])
  @Get("/profile/:uuid/ratings")
  public async getUserRatings(@Param("uuid") uuid: string) {
    const user = await this.userRepository.getUserByUuid(uuid);
    if (!user) {
      throw new UserNotFoundError();
    }
    const userRatings = await this.ratingRepository.find({
      where: { ratingOwner: user },
      relations: ["transaction"],
    });

    return userRatings;
  }
}
