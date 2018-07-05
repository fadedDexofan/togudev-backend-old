import {
  Authorized,
  BodyParam,
  CurrentUser,
  Get,
  JsonController,
  Param,
  Post,
} from "routing-controllers";
import { Service } from "typedi";
import { InjectRepository } from "typeorm-typedi-extensions";

import { isUUID } from "validator";
import { RatingTransaction, User } from "../../../db/entities";
import {
  RatingRepository,
  RatingTransactionRepository,
} from "../../../db/repositories";
import { logger, Raven } from "../../../utils";
import { ApiErrorEnum } from "../../errors";
import { ApiError, ApiResponse, RoleHelper } from "../../helpers";

@Service()
@JsonController("/ratings")
export class RatingController {
  constructor(
    @InjectRepository() private ratingRepository: RatingRepository,
    @InjectRepository()
    private transactionRepository: RatingTransactionRepository,
    private roleHelper: RoleHelper,
  ) {}

  @Authorized(["user"])
  @Get("/:uuid")
  public async getRatingInfo(
    @CurrentUser() user: User,
    @Param("uuid") uuid: string,
  ) {
    if (!isUUID(uuid)) {
      throw new ApiError(ApiErrorEnum.BAD_UUID, "Некорректный uuid");
    }

    const rating = await this.ratingRepository.getRatingByUuid(uuid);

    if (!rating) {
      throw new ApiError(
        ApiErrorEnum.NOT_FOUND,
        "Рейтинг с данным uuid не найден",
      );
    }

    const isMentor = await this.roleHelper.hasRole("mentor", user.roles);
    const isAdmin = await this.roleHelper.hasRole("admin", user.roles);
    const isRatingOwner = rating.ratingOwner.uuid === user.uuid;

    if (isAdmin || isMentor || isRatingOwner) {
      return new ApiResponse(rating);
    } else {
      delete rating.ratingTransactions;

      return new ApiResponse(rating);
    }
  }

  @Authorized(["mentor"])
  @Post("/:uuid")
  public async addRating(
    @CurrentUser() mentor: User,
    @Param("uuid") uuid: string,
    @BodyParam("valueChange", { required: true })
    valueChange: number,
    @BodyParam("reason", { required: true })
    reason: string,
  ) {
    if (!isUUID(uuid)) {
      throw new ApiError(ApiErrorEnum.BAD_UUID, "Некорректный uuid");
    }

    if (!Number(valueChange)) {
      throw new ApiError(
        ApiErrorEnum.NOT_A_NUMBER,
        "valueChange должен быть числом",
      );
    }

    const rating = await this.ratingRepository.findOne(uuid, {
      relations: ["ratingTransactions", "direction", "ratingOwner"],
    });

    if (!rating) {
      throw new ApiError(ApiErrorEnum.NOT_FOUND, "Рейтинг не найден");
    }

    const isDirectionMentor = this.roleHelper.isDirectionMentor(
      rating.direction,
      mentor,
    );
    const isAdmin = await this.roleHelper.hasRole("admin", mentor.roles);

    if (isAdmin || isDirectionMentor) {
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
        return new ApiResponse({ message: "Рейтинг успешно изменен" });
      } catch (err) {
        logger.error(err);
        Raven.captureException(err);
        throw new ApiError(
          ApiErrorEnum.RATING_ADD,
          "Не удалось увеличить рейтинг",
        );
      }
    } else {
      throw new ApiError(
        ApiErrorEnum.UNAUTHORIZED,
        "Для изменения рейтинга необходимо быть ментором данного направления",
      );
    }
  }
}
