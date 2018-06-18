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

import { RatingTransaction } from "../../../db/entities";
import {
  RatingRepository,
  RatingTransactionRepository,
} from "../../../db/repositories";
import { logger, Raven } from "../../../utils";

@Service()
@JsonController("/ratings")
export class RatingController {
  constructor(
    @InjectRepository() private ratingRepository: RatingRepository,
    @InjectRepository()
    private transactionRepository: RatingTransactionRepository,
  ) {}

  @Authorized(["user"])
  @Get("/:uuid")
  @OnUndefined(NotFoundError)
  public async getRatingInfo(@Param("uuid") uuid: string) {
    return this.ratingRepository.findOne(uuid, {
      relations: ["ratingOwner", "direction", "ratingTransactions"],
    });
  }

  @Authorized(["mentor"])
  @Post("/:uuid/add")
  public async addRating(
    @Param("uuid") uuid: string,
    @BodyParam("valueChange", { required: true })
    valueChange: number,
    @BodyParam("reason", { required: true })
    reason: string,
  ) {
    const rating = await this.ratingRepository.findOne(uuid, {
      relations: ["ratingTransactions", "ratingOwner"],
    });

    if (!rating) {
      throw new NotFoundError("Рейтинг не найден");
    }

    const transaction = new RatingTransaction();
    transaction.author = rating.ratingOwner;
    transaction.rating = rating;
    transaction.reason = reason;
    transaction.valueChange = valueChange;

    rating.value += valueChange;

    try {
      await this.ratingRepository.save(rating);
      await this.transactionRepository.save(transaction);

      return { message: "Рейтинг успешно изменен" };
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new InternalServerError("Не удалось увеличить рейтинг");
    }
  }
}
