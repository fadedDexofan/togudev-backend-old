import { EntityRepository, Repository } from "typeorm";
import { Rating } from "../entities";

@EntityRepository(Rating)
export class RatingRepository extends Repository<Rating> {}
