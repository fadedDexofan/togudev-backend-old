import {
  Authorized,
  BodyParam,
  CurrentUser,
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

import { RatingTransaction, User } from "../../../db/entities";
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
      relations: ["user", "direction", "transaction"],
    });
  }

  @Authorized(["mentor"])
  @Post("/:uuid/add")
  public async addRating(
    @CurrentUser() user: User,
    @Param("uuid") uuid: string,
    @BodyParam("valueChange") valueChange: number,
    @BodyParam("reason") reason: string,
  ) {
    const rating = await this.ratingRepository.findOne(uuid, {
      relations: ["transaction"],
    });

    if (!rating) {
      throw new NotFoundError("Рейтинг не найден");
    }

    const transaction = new RatingTransaction();
    transaction.author = user;
    transaction.rating = rating;
    transaction.reason = reason;
    transaction.valueChange = valueChange;

    try {
      await this.transactionRepository.save(transaction);
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new InternalServerError("Не удалось увеличить рейтинг");
    }
  }
}
