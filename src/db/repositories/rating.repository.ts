import { EntityRepository, Repository } from "typeorm";
import { Direction, Rating } from "../entities";

@EntityRepository(Rating)
export class RatingRepository extends Repository<Rating> {
  public async getRatingsByDirection(direction: Direction): Promise<Rating[]> {
    return this.createQueryBuilder("rating")
      .where("rating.direction = :direction", { direction: direction.id })
      .leftJoinAndSelect("rating.ratingOwner", "ratingOwner")
      .leftJoinAndSelect("rating.direction", "direction")
      .select([
        "rating.uuid",
        "rating.value",
        "ratingOwner.uuid",
        "direction.id",
      ])
      .orderBy("rating.value", "DESC")
      .getMany();
  }

  public async getRatingByUuid(uuid: string): Promise<Rating | undefined> {
    return this.createQueryBuilder("rating")
      .where("rating.uuid = :uuid", { uuid })
      .leftJoinAndSelect("rating.ratingOwner", "ratingOwner")
      .leftJoinAndSelect("rating.direction", "direction")
      .leftJoinAndSelect("rating.ratingTransactions", "ratingTransactions")
      .leftJoinAndSelect("ratingTransactions.author", "author")
      .select([
        "rating.uuid",
        "rating.value",
        "rating.direction",
        "ratingOwner.uuid",
        "direction.id",
        "ratingTransactions",
        "author.uuid",
      ])
      .getOne();
  }
}
