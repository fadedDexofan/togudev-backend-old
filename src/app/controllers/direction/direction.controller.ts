import {
  Authorized,
  BodyParam,
  CurrentUser,
  Get,
  HttpCode,
  JsonController,
  Param,
  Patch,
  Post,
} from "routing-controllers";
import { Service } from "typedi";
import { InjectRepository } from "typeorm-typedi-extensions";

import { Application, Direction, User } from "../../../db/entities";

import { isUUID } from "validator";
import {
  ApplicationRepository,
  DirectionRepository,
  RatingRepository,
  UserRepository,
} from "../../../db/repositories";
import { logger, Raven } from "../../../utils";
import { ApiErrorEnum } from "../../errors";
import { ApiError, ApiResponse, RoleHelper } from "../../helpers";

@Service()
@JsonController("/directions")
export class DirectionController {
  constructor(
    @InjectRepository() private userRepository: UserRepository,
    @InjectRepository() private directionRepository: DirectionRepository,
    @InjectRepository() private applicationRepository: ApplicationRepository,
    @InjectRepository() private ratingRepository: RatingRepository,
    private roleHelper: RoleHelper,
  ) {}

  @Get()
  public async getDirections() {
    const directions = await this.directionRepository.find({
      relations: ["participants"],
    });
    const response: any = [];
    if (directions) {
      directions.forEach((direction) => {
        response.push({
          id: direction.id,
          name: direction.name,
          description: direction.description,
          participantsCount: direction.participants.length,
        });
      });
    }

    return new ApiResponse(response);
  }

  @Authorized(["user"])
  @Post("/apply")
  public async applyToDirection(
    @CurrentUser() user: User,
    @BodyParam("directionId", { required: true })
    directionId: number,
  ) {
    if (!Number(directionId)) {
      throw new ApiError(
        ApiErrorEnum.NOT_A_NUMBER,
        "directionId должен быть числом",
      );
    }

    const direction = await this.directionRepository.findOne(directionId);

    if (!direction) {
      throw new ApiError(
        ApiErrorEnum.NOT_FOUND,
        "Указанное направление не найдено",
      );
    }

    const alreadyApplied = await this.applicationRepository.findOne({
      where: { direction, user },
    });

    if (alreadyApplied) {
      throw new ApiError(
        ApiErrorEnum.ALREADY_APPLIED,
        "Вы уже подали заявку на данное направление",
      );
    }

    const alreadyIn = this.roleHelper.hasObject(direction, user.directions);

    if (alreadyIn) {
      throw new ApiError(
        ApiErrorEnum.ALREADY_IN_DIRECTION,
        "Вы уже присоединились к данному направлению",
      );
    }

    const application = new Application();
    application.direction = direction;
    application.user = user;

    try {
      await this.applicationRepository.save(application);
      logger.info(
        `Пользователь [${
          application.user.phoneNumber
        }] подал заявку на направление "${application.direction.name}"`,
      );
      return new ApiResponse({
        message: "Заявка успешно подана",
      });
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new ApiError(
        ApiErrorEnum.APPLICATION_CREATE,
        "Ошибка подачи заявки",
      );
    }
  }

  @Authorized(["user"])
  @Get("/:id")
  public async getDirection(@Param("id") id: number) {
    if (!Number(id)) {
      throw new ApiError(ApiErrorEnum.NOT_A_NUMBER, "id должен быть числом");
    }

    const direction = await this.directionRepository.getDirectionById(id);

    if (!direction) {
      throw new ApiError(
        ApiErrorEnum.NOT_FOUND,
        "Указанное направление не найдено",
      );
    }

    return new ApiResponse(direction);
  }

  @Authorized(["user"])
  @Get("/:id/ratings")
  public async getAllDirectionRatings(
    @CurrentUser() user: User,
    @Param("id") id: number,
  ) {
    if (!Number(id)) {
      throw new ApiError(ApiErrorEnum.NOT_A_NUMBER, "id должен быть числом");
    }

    const direction = await this.directionRepository.findOne(id);

    if (!direction) {
      throw new ApiError(
        ApiErrorEnum.NOT_FOUND,
        "Указанное направление не найдено",
      );
    }

    const ratings = await this.ratingRepository.getRatingsByDirection(
      direction,
    );

    return new ApiResponse(ratings);
  }

  @HttpCode(201)
  @Authorized(["admin"])
  @Post()
  public async createDirection(
    @CurrentUser() admin: User,
    @BodyParam("name", { required: true })
    name: string,
    @BodyParam("description", { required: true })
    description: string,
    @BodyParam("mentorUuid", { required: true })
    mentorUuid: string,
  ) {
    if (!isUUID(mentorUuid)) {
      throw new ApiError(ApiErrorEnum.BAD_UUID, "Некорректный uuid");
    }

    const dupDirection = await this.directionRepository.findOne({ name });

    if (dupDirection) {
      throw new ApiError(
        ApiErrorEnum.DIRECTION_EXISTS,
        "Направление уже существует",
      );
    }

    const mentor = await this.userRepository.findOne(mentorUuid);

    if (!mentor) {
      throw new ApiError(
        ApiErrorEnum.NOT_FOUND,
        "Ментор с указанным uuid не найден",
      );
    }

    const newDirection = new Direction();
    newDirection.name = name;
    newDirection.description = description;
    newDirection.mentor = mentor;
    newDirection.participants = [];

    try {
      await this.directionRepository.save(newDirection);
      logger.info(
        `Администратор [${admin.phoneNumber}] создал направление "${
          newDirection.name
        }"`,
      );
      return new ApiResponse({ message: "Направление успешно создано" });
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new ApiError(
        ApiErrorEnum.DIRECTION_CREATE,
        "Ошибка создания направления",
      );
    }
  }

  @Authorized(["admin"])
  @Patch("/:id")
  public async modifyDirection(
    @CurrentUser() admin: User,
    @Param("id") id: number,
    @BodyParam("name") name: string,
    @BodyParam("description") description: string,
    @BodyParam("mentorUuid") mentorUuid: string,
  ) {
    if (!isUUID(mentorUuid)) {
      throw new ApiError(ApiErrorEnum.BAD_UUID, "Некорректный uuid");
    }

    const direction = await this.directionRepository.findOne(id);

    if (!direction) {
      throw new ApiError(
        ApiErrorEnum.NOT_FOUND,
        "Указанное направление не найдено",
      );
    }

    const updatedDirection = new Direction();

    if (name) {
      updatedDirection.name = name;
    }

    if (description) {
      updatedDirection.description = description;
    }

    if (mentorUuid) {
      const mentor = await this.userRepository.findOne(mentorUuid);

      if (!mentor) {
        throw new ApiError(
          ApiErrorEnum.NOT_FOUND,
          "Указанный ментор не найден",
        );
      }

      updatedDirection.mentor = mentor;
    }

    updatedDirection.id = direction.id;
    updatedDirection.participants = direction.participants;

    Object.assign(direction, updatedDirection);

    try {
      await this.directionRepository.save(direction);
      logger.info(
        `Администратор [${admin.phoneNumber}] отредактировал направление "${
          direction.name
        }"`,
      );
      return new ApiResponse({
        message: "Направление успешно отредактировано",
      });
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new ApiError(
        ApiErrorEnum.DIRECTION_EDIT,
        "Не удалось отредактировать направление",
      );
    }
  }
}
