import {
  Authorized,
  Get,
  InternalServerError,
  JsonController,
  NotFoundError,
  Param,
} from "routing-controllers";
import { Service } from "typedi";
import { InjectRepository } from "typeorm-typedi-extensions";
// import { DirectionRepository } from "../../../db/repositories";
import {
  ApplicationRepository,
  UserRepository,
} from "../../../db/repositories";

import { Rating } from "../../../db/entities";
import { logger, Raven } from "../../../utils";

@Service()
@JsonController("/applications")
export class ApplicationController {
  constructor(
    @InjectRepository() private userRepository: UserRepository,
    @InjectRepository() private applicationRepository: ApplicationRepository, // @InjectRepository() private directionRepository: DirectionRepository,
  ) {}

  @Get()
  @Authorized(["mentor"])
  public async getApplications() {
    return this.applicationRepository.find();
  }

  @Authorized(["mentor"])
  @Get("/:uuid/approve")
  public async approveApplication(@Param("uuid") uuid: string) {
    const application = await this.applicationRepository.findOne(uuid, {
      relations: ["user", "user.directions", "user.userRatings", "direction"],
    });

    if (!application) {
      throw new NotFoundError("Заявка не найдена");
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
      return { message: "Заявка успешно подтверждена" };
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new InternalServerError("Ошибка принятия заявки");
    }
  }

  @Authorized(["mentor"])
  @Get("/:uuid/decline")
  public async declineApplication(@Param("uuid") uuid: string) {
    const application = await this.applicationRepository.findOne(uuid, {
      relations: ["user", "direction"],
    });
    if (!application) {
      throw new NotFoundError("Заявка не найдена");
    }
    try {
      await this.applicationRepository.remove(application);
      return { message: "Заявка успешно отклонена" };
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new InternalServerError("Ошибка отклонения заявки");
    }
  }
}
