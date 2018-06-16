import { Context } from "koa";
import {
  Authorized,
  Ctx,
  CurrentUser,
  Get,
  JsonController,
  NotFoundError,
  OnUndefined,
  Param,
} from "routing-controllers";
import { Service } from "typedi";
import { InjectRepository } from "typeorm-typedi-extensions";

import { User } from "../../../db/entities";
import { RatingRepository, UserRepository } from "../../../db/repositories";
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
  public async profile(@Ctx() ctx: Context, @CurrentUser() user: User) {
    if (!user) {
      return new NotFoundError("Текущий пользователь не найден");
    }

    return user;
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
    const user = await this.userRepository.findOne(uuid);
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
