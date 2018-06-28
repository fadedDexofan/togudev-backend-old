import { EntityRepository, Repository } from "typeorm";
import { Direction } from "../entities";

@EntityRepository(Direction)
export class DirectionRepository extends Repository<Direction> {
  public async getDirectionById(id: number): Promise<Direction | undefined> {
    return this.createQueryBuilder("direction")
      .where("direction.id = :id", { id })
      .leftJoinAndSelect("direction.participants", "participants")
      .leftJoinAndSelect("direction.mentor", "mentor")
      .select([
        "direction.id",
        "direction.name",
        "direction.description",
        "participants.uuid",
        "mentor.uuid",
      ])
      .getOne();
  }
}
