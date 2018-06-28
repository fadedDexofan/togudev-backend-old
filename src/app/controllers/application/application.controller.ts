import {
  Authorized,
  CurrentUser,
  Get,
  JsonController,
  Param,
} from "routing-controllers";
import { Service } from "typedi";
import { InjectRepository } from "typeorm-typedi-extensions";

import { isUUID } from "validator";
import { Rating, User } from "../../../db/entities";
import {
  ApplicationRepository,
  UserRepository,
} from "../../../db/repositories";
import { logger, Raven } from "../../../utils";
import { ApiErrorEnum } from "../../errors";
import { ApiError, ApiResponse, RoleHelper } from "../../helpers";

@Service()
@JsonController("/applications")
export class ApplicationController {
  constructor(
    @InjectRepository() private userRepository: UserRepository,
    @InjectRepository() private applicationRepository: ApplicationRepository,
    private roleHelper: RoleHelper,
  ) {}

  @Get()
  @Authorized(["mentor"])
  public async getApplications() {
    const applications = await this.applicationRepository.getApplications();

    return new ApiResponse(applications);
  }

  @Authorized(["mentor"])
  @Get("/:uuid/approve")
  public async approveApplication(
    @CurrentUser() mentor: User,
    @Param("uuid") uuid: string,
  ) {
    if (!isUUID(uuid)) {
      throw new ApiError(ApiErrorEnum.BAD_UUID, "Некорректный uuid");
    }

    const application = await this.applicationRepository.findOne(uuid, {
      relations: ["user", "user.directions", "user.userRatings", "direction"],
    });

    if (!application) {
      throw new ApiError(ApiErrorEnum.NOT_FOUND, "Заявка не найдена");
    }

    const isDirectionMentor = this.roleHelper.isDirectionMentor(
      application.direction,
      mentor,
    );

    const isAdmin = await this.roleHelper.hasRole("admin", mentor.roles);

    if (!isDirectionMentor || !isAdmin) {
      throw new ApiError(
        ApiErrorEnum.UNAUTHORIZED,
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

      return new ApiResponse({ message: "Заявка успешно подтверждена" });
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new ApiError(
        ApiErrorEnum.APPLICATION_APPROVE,
        "Ошибка принятия заявки",
      );
    }
  }

  @Authorized(["mentor"])
  @Get("/:uuid/decline")
  public async declineApplication(
    @CurrentUser() mentor: User,
    @Param("uuid") uuid: string,
  ) {
    if (!isUUID(uuid)) {
      throw new ApiError(ApiErrorEnum.BAD_UUID, "Некорректный uuid");
    }

    const application = await this.applicationRepository.findOne(uuid, {
      relations: ["user", "direction", "direction.mentors"],
    });

    if (!application) {
      throw new ApiError(ApiErrorEnum.NOT_FOUND, "Заявка не найдена");
    }

    const isDirectionMentor = this.roleHelper.isDirectionMentor(
      application.direction,
      mentor,
    );

    const isAdmin = await this.roleHelper.hasRole("admin", mentor.roles);

    if (!isDirectionMentor || !isAdmin) {
      throw new ApiError(
        ApiErrorEnum.UNAUTHORIZED,
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

      return new ApiResponse({ message: "Заявка успешно отклонена" });
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new ApiError(
        ApiErrorEnum.APPLICATION_DECLINE,
        "Ошибка отклонения заявки",
      );
    }
  }
}
