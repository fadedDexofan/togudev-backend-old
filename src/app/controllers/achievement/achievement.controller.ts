import {
  Authorized,
  BodyParam,
  Get,
  JsonController,
  Param,
  Post,
} from "routing-controllers";
import { Service } from "typedi";
import { InjectRepository } from "typeorm-typedi-extensions";
import { isUUID } from "validator";
import {
  AchievementRepository,
  UserRepository,
} from "../../../db/repositories";
import { ApiErrorEnum } from "../../errors";
import { ApiError, ApiResponse } from "../../helpers";

@Service()
@JsonController("/achievements")
export class AchievementController {
  constructor(
    @InjectRepository() private achievementRepository: AchievementRepository,
    @InjectRepository() private userRepository: UserRepository,
  ) {}

  @Get()
  @Authorized(["user"])
  public async availableAchievements() {
    const achievements = await this.achievementRepository.find();
    return new ApiResponse(achievements);
  }

  @Get("/:id")
  @Authorized(["user"])
  public async getAchievement(@Param("id") id: number) {
    const achievement = await this.achievementRepository.findOne(id);

    if (!achievement) {
      throw new ApiError(
        ApiErrorEnum.NOT_FOUND,
        "Достижение с указанным id не найдено",
      );
    }

    return new ApiResponse(achievement);
  }

  @Post()
  @Authorized(["mentor"])
  public async giveAchievement(
    @BodyParam("achievementId", { required: true })
    achievementId: number,
    @BodyParam("userUuid", { required: true })
    userUuid: string,
  ) {
    if (!isUUID(userUuid)) {
      throw new ApiError(ApiErrorEnum.BAD_UUID, "Некорректный uuid");
    }

    const achievement = await this.achievementRepository.findOne(achievementId);

    if (!achievement) {
      throw new ApiError(
        ApiErrorEnum.NOT_FOUND,
        "Достижение с указанным id не найдено",
      );
    }

    const user = await this.userRepository.findOne(userUuid);

    if (!user) {
      throw new ApiError(
        ApiErrorEnum.NOT_FOUND,
        "Пользователь с указанным uuid не найден",
      );
    }

    user.achievements.push(achievement);

    try {
      await this.userRepository.save(user);
      return new ApiResponse({
        message: `Достижение успешно выдано пользователю [${user.phoneNumber}]`,
      });
    } catch (err) {
      throw new ApiError(
        ApiErrorEnum.ACHIEVEMENT_GIVE,
        "Ошибка выдачи достижения",
      );
    }
  }
}
