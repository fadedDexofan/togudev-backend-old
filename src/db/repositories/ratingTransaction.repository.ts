import { EntityRepository, Repository } from "typeorm";
import { RatingTransaction } from "../entities";

@EntityRepository(RatingTransaction)
export class RatingTransactionRepository extends Repository<
  RatingTransaction
> {}
