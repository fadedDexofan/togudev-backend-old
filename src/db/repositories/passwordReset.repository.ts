import { EntityRepository, Repository } from "typeorm";
import { PasswordReset } from "../entities/passwordReset.entity";

@EntityRepository(PasswordReset)
export class PasswordResetRepository extends Repository<PasswordReset> {}
