import {
  Authorized,
  BadRequestError,
  Body,
  CurrentUser,
  Get,
  InternalServerError,
  JsonController,
  Param,
  Patch,
} from "routing-controllers";
import { Service } from "typedi";
import { InjectRepository } from "typeorm-typedi-extensions";
import { isEmail } from "validator";

import { Profile, User } from "../../../db/entities";
import { UserRepository } from "../../../db/repositories";
import { logger, Raven } from "../../../utils";
import { UserNotFoundError } from "../../errors";
import { RoleHelper } from "../../helpers";

@Service()
@JsonController("/users")
export class UserController {
  constructor(
    @InjectRepository() private userRepository: UserRepository,
    private roleHelper: RoleHelper,
  ) {}

  @Authorized(["user"])
  @Get("/profile")
  public async profile(@CurrentUser() user: User) {
    if (!user) {
      return new UserNotFoundError("Текущий пользователь не найден");
    }

    return user;
  }

  @Authorized(["user"])
  @Patch("/profile")
  public async updateProfile(
    @CurrentUser() user: User,
    @Body() profile: Profile,
  ) {
    if (profile.email) {
      if (!isEmail(profile.email)) {
        throw new BadRequestError("Email имеет некорректный формат");
      }
    }

    Object.assign(user.profile, profile);

    try {
      await this.userRepository.save(user);

      return { message: "Профиль успешно отредактирован" };
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new InternalServerError("Не удалось отредактировать профиль");
    }
  }

  // TODO: Использовать queryBuilder
  @Authorized(["user"])
  @Get("/profile/:uuid")
  public async getUser(@CurrentUser() user: User, @Param("uuid") uuid: string) {
    const isMentor = await this.roleHelper.hasRole("mentor", user.roles);

    const publicRelations = [
      "directions",
      "mentions",
      "userRatings",
      "profile",
      "roles",
    ];

    let userProfile: User | undefined;

    if (isMentor) {
      userProfile = await this.userRepository.findOne(uuid, {
        relations: [...publicRelations, "mentorTransactions"],
      });

      if (!userProfile) {
        throw new UserNotFoundError();
      }

      return userProfile;
    } else {
      userProfile = await this.userRepository.findOne(uuid, {
        relations: publicRelations,
      });

      if (!userProfile) {
        throw new UserNotFoundError();
      }

      delete userProfile.phoneNumber;
      delete userProfile.profile.email;
      delete userProfile.profile.contact;

      return userProfile;
    }
  }
}
