import { EntityRepository, Repository } from "typeorm";
import { Direction } from "../entities";

@EntityRepository(Direction)
export class DirectionRepository extends Repository<Direction> {}
