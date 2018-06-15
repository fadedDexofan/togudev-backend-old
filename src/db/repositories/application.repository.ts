import { EntityRepository, Repository } from "typeorm";
import { Application } from "../entities/application.entity";

@EntityRepository(Application)
export class ApplicationRepository extends Repository<Application> {}
