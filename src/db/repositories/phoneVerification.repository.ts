import { EntityRepository, Repository } from "typeorm";
import { PhoneVerification } from "../entities/phoneVerification.entity";

@EntityRepository(PhoneVerification)
export class PhoneVerificationRepository extends Repository<
  PhoneVerification
> {}
