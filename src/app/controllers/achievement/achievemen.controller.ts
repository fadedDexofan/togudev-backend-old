import {
  Authorized,
  BodyParam,
  Get,
  InternalServerError,
  JsonController,
  NotFoundError,
  OnUndefined,
  Param,
  Post,
} from "routing-controllers";
import { Service } from "typedi";
import { InjectRepository } from "typeorm-typedi-extensions";
import {
  AchievementRepository,
  UserRepository,
} from "../../../db/repositories";

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
    return this.achievementRepository.find();
  }

  @Get("/:id")
  @Authorized(["user"])
  @OnUndefined(NotFoundError)
  public async getAchievement(@Param("id") id: number) {
    return this.achievementRepository.findOne(id);
  }

  @Post()
  @Authorized(["mentor"])
  public async giveAchievement(
    @BodyParam("achievementId", { required: true })
    achievementId: number,
    @BodyParam("userUuid", { required: true })
    userUuid: string,
  ) {
    const achievement = await this.achievementRepository.findOne(achievementId);

    if (!achievement) {
      throw new NotFoundError("Достижение с указанным id не найден");
    }

    const user = await this.userRepository.findOne(userUuid);

    if (!user) {
      throw new NotFoundError("Пользователь с указанным uuid не найден");
    }

    user.achievements.push(achievement);
    try {
      await this.userRepository.save(user);
    } catch (err) {
      throw new InternalServerError("Ошибка создания достижения");
    }
  }
}
