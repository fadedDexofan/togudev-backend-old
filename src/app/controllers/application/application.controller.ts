import {
  Authorized,
  CurrentUser,
  Get,
  InternalServerError,
  JsonController,
  NotFoundError,
  Param,
  UnauthorizedError,
} from "routing-controllers";
import { Service } from "typedi";
import { InjectRepository } from "typeorm-typedi-extensions";

import {
  ApplicationRepository,
  RoleRepository,
  UserRepository,
} from "../../../db/repositories";

import { Rating, User } from "../../../db/entities";
import { logger, Raven } from "../../../utils";

@Service()
@JsonController("/applications")
export class ApplicationController {
  constructor(
    @InjectRepository() private userRepository: UserRepository,
    @InjectRepository() private applicationRepository: ApplicationRepository,
    @InjectRepository() private roleRepository: RoleRepository,
  ) {}

  @Get()
  @Authorized(["mentor"])
  public async getApplications() {
    return this.applicationRepository.find();
  }

  @Authorized(["mentor"])
  @Get("/:uuid/approve")
  public async approveApplication(
    @CurrentUser() mentor: User,
    @Param("uuid") uuid: string,
  ) {
    const application = await this.applicationRepository.findOne(uuid, {
      relations: ["user", "user.directions", "user.userRatings", "direction"],
    });

    if (!application) {
      throw new NotFoundError("Заявка не найдена");
    }

    const adminRole = await this.roleRepository.getRoleByName("admin");

    if (!adminRole) {
      throw new InternalServerError("Ошибка проверки роли");
    }

    const isDirectionMentor = mentor.mentions.includes(application.direction);
    const isAdmin = mentor.roles.includes(adminRole);

    if (!isDirectionMentor || !isAdmin) {
      throw new UnauthorizedError(
        "Необходимо быть ментором данного направления для отклонения заявки",
      );
    }

    const user = application.user;
    const direction = application.direction;
    user.directions.push(direction);

    const rating = new Rating();
    rating.ratingOwner = user;
    rating.direction = direction;
    rating.value = 0;
    rating.ratingTransactions = [];
    user.userRatings.push(rating);

    try {
      await this.applicationRepository.remove(application);
      await this.userRepository.save(user);
      logger.info(
        `Заявка от [${application.user.phoneNumber}] на направление "${
          application.direction.name
        }" принята ментором [${mentor.phoneNumber}]`,
      );
      return { message: "Заявка успешно подтверждена" };
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new InternalServerError("Ошибка принятия заявки");
    }
  }

  @Authorized(["mentor"])
  @Get("/:uuid/decline")
  public async declineApplication(
    @CurrentUser() mentor: User,
    @Param("uuid") uuid: string,
  ) {
    const application = await this.applicationRepository.findOne(uuid, {
      relations: ["user", "direction", "direction.mentors"],
    });

    if (!application) {
      throw new NotFoundError("Заявка не найдена");
    }

    const adminRole = await this.roleRepository.getRoleByName("admin");

    if (!adminRole) {
      throw new InternalServerError("Ошибка проверки роли");
    }

    if (
      !mentor.mentions.includes(application.direction) ||
      !mentor.roles.includes(adminRole)
    ) {
      throw new UnauthorizedError(
        "Необходимо быть ментором данного направления для отклонения заявки",
      );
    }

    try {
      await this.applicationRepository.remove(application);
      logger.info(
        `Заявка от [${application.user.phoneNumber}] на направление "${
          application.direction.name
        }" отклонена ментором [${mentor.phoneNumber}]`,
      );
      return { message: "Заявка успешно отклонена" };
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new InternalServerError("Ошибка отклонения заявки");
    }
  }
}
