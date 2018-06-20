import { EntityRepository, Repository } from "typeorm";
import { Application } from "../entities/application.entity";

@EntityRepository(Application)
export class ApplicationRepository extends Repository<Application> {
  public async getApplications(): Promise<Application[]> {
    return this.createQueryBuilder("application")
      .innerJoinAndSelect("application.direction", "direction")
      .innerJoinAndSelect("application.user", "user")
      .select(["application", "direction.id", "user.uuid"])
      .getMany();
  }
}
