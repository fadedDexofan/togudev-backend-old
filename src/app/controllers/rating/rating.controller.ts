import {
  Authorized,
  BodyParam,
  CurrentUser,
  Get,
  InternalServerError,
  JsonController,
  NotFoundError,
  Param,
  Post,
  UnauthorizedError,
} from "routing-controllers";
import { Service } from "typedi";
import { InjectRepository } from "typeorm-typedi-extensions";

import { RatingTransaction, User } from "../../../db/entities";
import {
  RatingRepository,
  RatingTransactionRepository,
  RoleRepository,
} from "../../../db/repositories";
import { logger, Raven } from "../../../utils";

@Service()
@JsonController("/ratings")
export class RatingController {
  constructor(
    @InjectRepository() private roleRepository: RoleRepository,
    @InjectRepository() private ratingRepository: RatingRepository,
    @InjectRepository()
    private transactionRepository: RatingTransactionRepository,
  ) {}

  @Authorized(["user"])
  @Get("/:uuid")
  public async getRatingInfo(
    @CurrentUser() user: User,
    @Param("uuid") uuid: string,
  ) {
    const rating = await this.ratingRepository.findOne(uuid, {
      relations: ["ratingOwner", "direction", "ratingTransactions"],
    });

    if (!rating) {
      throw new NotFoundError("Рейтинг с данным id не найден");
    }

    const mentorRole = await this.roleRepository.getRoleByName("mentor");

    if (!mentorRole) {
      throw new InternalServerError("Ошибка проверки доступа");
    }

    const isMentor = user.roles.includes(mentorRole);
    const isRatingOwner = rating.ratingOwner.uuid === user.uuid;

    if (isMentor || isRatingOwner) {
      return rating;
    } else {
      delete rating.ratingOwner.phoneNumber;
      delete rating.ratingTransactions;

      return rating;
    }
  }

  @Authorized(["mentor"])
  @Post("/:uuid/add")
  public async addRating(
    @CurrentUser() mentor: User,
    @Param("uuid") uuid: string,
    @BodyParam("valueChange", { required: true })
    valueChange: number,
    @BodyParam("reason", { required: true })
    reason: string,
  ) {
    const rating = await this.ratingRepository.findOne(uuid, {
      relations: ["ratingTransactions", "direction", "ratingOwner"],
    });

    if (!rating) {
      throw new NotFoundError("Рейтинг не найден");
    }

    const adminRole = await this.roleRepository.getRoleByName("admin");

    if (!adminRole) {
      throw new InternalServerError("Ошибка проверки роли");
    }

    const isDirectionMentor = mentor.mentions.includes(rating.direction);
    const isAdmin = mentor.roles.includes(adminRole);

    if (!isDirectionMentor || !isAdmin) {
      throw new UnauthorizedError(
        "Для совершения этого действия необходимо быть ментором данного направления",
      );
    }

    const transaction = new RatingTransaction();
    transaction.author = mentor;
    transaction.rating = rating;
    transaction.reason = reason;
    transaction.valueChange = valueChange;

    rating.value += valueChange;

    try {
      await this.ratingRepository.save(rating);
      await this.transactionRepository.save(transaction);
      logger.info(
        `Ментор [${mentor.phoneNumber}] изменил рейтинг пользователю [${
          rating.ratingOwner.phoneNumber
        }]`,
      );
      return { message: "Рейтинг успешно изменен" };
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new InternalServerError("Не удалось увеличить рейтинг");
    }
  }
}
