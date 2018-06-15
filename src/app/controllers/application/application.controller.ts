import {
  Authorized,
  Get,
  InternalServerError,
  JsonController,
  NotFoundError,
  Param,
} from "routing-controllers";
import { Service } from "typedi";
import { InjectRepository } from "typeorm-typedi-extensions";

// import { DirectionRepository } from "../../../db/repositories";
import { UserRepository } from "../../../db/repositories";
import { ApplicationRepository } from "../../../db/repositories/application.repository";

@Service()
@JsonController("/applications")
export class ApplicationController {
  constructor(
    @InjectRepository() private userRepository: UserRepository,
    @InjectRepository() private applicationRepository: ApplicationRepository, // @InjectRepository() private directionRepository: DirectionRepository,
  ) {}

  @Get()
  @Authorized(["mentor"])
  public async getApplications() {
    const applications = await this.applicationRepository.find();
    return applications;
  }

  @Authorized(["mentor"])
  @Get("/:uuid/approve")
  public async approveApplication(@Param("uuid") uuid: string) {
    const application = await this.applicationRepository.findOne(uuid, {
      relations: ["user", "direction"],
    });
    if (!application) {
      throw new NotFoundError("Заявка не найдена");
    }
    const user = application.user;
    const direction = application.direction;
    user.directions.push(direction);

    try {
      await this.applicationRepository.remove(application);
      await this.userRepository.save(user);
      return { message: "Заявка успешно подтверждена" };
    } catch (err) {
      throw new InternalServerError("Ошибка принятия заявки");
    }
  }

  @Authorized(["mentor"])
  @Get("/:uuid/decline")
  public async declineApplication(@Param("uuid") uuid: string) {
    const application = await this.applicationRepository.findOne(uuid, {
      relations: ["user", "direction"],
    });
    if (!application) {
      throw new NotFoundError("Заявка не найдена");
    }
    try {
      await this.applicationRepository.remove(application);
      return { message: "Заявка успешно отклонена" };
    } catch (err) {
      throw new InternalServerError("Ошибка отклонения заявки");
    }
  }
}
