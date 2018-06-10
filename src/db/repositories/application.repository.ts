import { Repository } from "typeorm";
import { Application } from "../entities/application.entity";

export class ApplicationRepository extends Repository<Application> {}
