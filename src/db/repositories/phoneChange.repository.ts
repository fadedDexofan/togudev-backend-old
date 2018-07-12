import { EntityRepository, Repository } from "typeorm";
import { PhoneChange } from "../entities/phoneChange.entity";

@EntityRepository(PhoneChange)
export class PhoneChangeRepository extends Repository<PhoneChange> {}
