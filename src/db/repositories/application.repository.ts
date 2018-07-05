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

  public async getMentorApplications(
    mentorUuid: string,
  ): Promise<Application[]> {
    return this.createQueryBuilder("application")
      .innerJoinAndSelect(
        "application.direction",
        "direction",
        "direction.mentor = :mentor",
        { mentor: mentorUuid },
      )
      .innerJoinAndSelect("application.user", "user")
      .select(["application", "direction.id", "user.uuid"])
      .getMany();
  }
}
