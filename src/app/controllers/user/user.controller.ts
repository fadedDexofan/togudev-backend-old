import {
  Authorized,
  Body,
  CurrentUser,
  Get,
  JsonController,
  Param,
  Patch,
} from "routing-controllers";
import { Service } from "typedi";
import { InjectRepository } from "typeorm-typedi-extensions";
import { isEmail, isUUID } from "validator";

import { Profile, User } from "../../../db/entities";
import { UserRepository } from "../../../db/repositories";
import { logger, Raven } from "../../../utils";
import { ApiErrorEnum } from "../../errors";
import { ApiError, ApiResponse, RoleHelper } from "../../helpers";

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
    return new ApiResponse(user);
  }

  @Authorized(["user"])
  @Patch("/profile")
  public async updateProfile(
    @CurrentUser() user: User,
    @Body() profile: Profile,
  ) {
    if (profile.email) {
      if (!isEmail(profile.email)) {
        throw new ApiError(
          ApiErrorEnum.BAD_EMAIL,
          "Email имеет некорректный формат",
        );
      }
    }

    Object.assign(user.profile, profile);

    try {
      await this.userRepository.save(user);

      return new ApiResponse({ message: "Профиль успешно отредактирован" });
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new ApiError(
        ApiErrorEnum.PROFILE_EDIT,
        "Не удалось отредактировать профиль",
      );
    }
  }

  // TODO: Использовать queryBuilder
  @Authorized(["user"])
  @Get("/profile/:uuid")
  public async getUser(@CurrentUser() user: User, @Param("uuid") uuid: string) {
    if (!isUUID(uuid)) {
      throw new ApiError(ApiErrorEnum.BAD_UUID, "Некорректный uuid");
    }

    const isMentor = await this.roleHelper.hasRole("mentor", user.roles);
    const isAdmin = await this.roleHelper.hasRole("admin", user.roles);

    const publicRelations = [
      "directions",
      "mentions",
      "userRatings",
      "userRatings.direction",
      "profile",
      "roles",
      "achievements",
    ];

    let userProfile: User | undefined;

    if (isAdmin || isMentor) {
      userProfile = await this.userRepository.findOne(uuid, {
        relations: [...publicRelations, "mentorTransactions"],
      });

      if (!userProfile) {
        throw new ApiError(ApiErrorEnum.NOT_FOUND, "Пользователь не найден");
      }

      return new ApiResponse(userProfile);
    } else {
      userProfile = await this.userRepository.findOne(uuid, {
        relations: publicRelations,
      });

      if (!userProfile) {
        throw new ApiError(ApiErrorEnum.NOT_FOUND, "Пользователь не найден");
      }

      delete userProfile.phoneNumber;
      delete userProfile.profile.email;
      delete userProfile.profile.contact;

      return new ApiResponse(userProfile);
    }
  }
}
