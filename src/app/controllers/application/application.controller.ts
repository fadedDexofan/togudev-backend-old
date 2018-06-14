import {
  Authorized,
  BodyParam,
  Get,
  JsonController,
  NotFoundError,
  Post,
} from "routing-controllers";
import { Service } from "typedi";
import { InjectRepository } from "typeorm-typedi-extensions";

// import { DirectionRepository } from "../../../db/repositories";
import { ApplicationRepository } from "../../../db/repositories/application.repository";

@Service()
@JsonController("/applications")
export class ApplicationController {
  constructor(
    @InjectRepository() private applicationRepository: ApplicationRepository, // @InjectRepository() private directionRepository: DirectionRepository,
  ) {}

  @Get()
  @Authorized(["mentor"])
  public async getApplications() {
    const applications = await this.applicationRepository.find();
    return applications;
  }

  @Post("/:uuid")
  public async approveApplication(@BodyParam("uuid") uuid: string) {
    const application = await this.applicationRepository.findOne(uuid);
    if (!application) {
      throw new NotFoundError("Application Not Found");
    }
  }
}
