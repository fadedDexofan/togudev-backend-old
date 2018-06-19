import {
  Authorized,
  BadRequestError,
  BodyParam,
  CurrentUser,
  Get,
  HttpCode,
  InternalServerError,
  JsonController,
  NotFoundError,
  Param,
  Patch,
  Post,
  QueryParam,
} from "routing-controllers";
import { Service } from "typedi";
import { InjectRepository } from "typeorm-typedi-extensions";

import { Application, Direction, User } from "../../../db/entities";

import {
  ApplicationRepository,
  DirectionRepository,
  RatingRepository,
  RoleRepository,
  UserRepository,
} from "../../../db/repositories";
import { logger, Raven } from "../../../utils";

@Service()
@JsonController("/directions")
export class DirectionController {
  constructor(
    @InjectRepository() private userRepository: UserRepository,
    @InjectRepository() private directionRepository: DirectionRepository,
    @InjectRepository() private applicationRepository: ApplicationRepository,
    @InjectRepository() private ratingRepository: RatingRepository,
    @InjectRepository() private roleRepository: RoleRepository,
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

    return response;
  }

  @HttpCode(201)
  @Authorized(["user"])
  @Post("/apply")
  public async applyToDirection(
    @CurrentUser() user: User,
    @BodyParam("directionId", { required: true })
    directionId: number,
  ) {
    const direction = await this.directionRepository.findOne(directionId);

    if (!direction) {
      throw new NotFoundError(`Направление с id ${directionId} не найдено`);
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
      return { status: 201, message: "Заявка успешно создана" };
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new InternalServerError("Ошибка создания заявки");
    }
  }

  @Authorized(["user"])
  @Get("/:id")
  public async getDirection(
    @CurrentUser() user: User,
    @Param("id") id: number,
  ) {
    const direction = await this.directionRepository.findOne(id, {
      relations: ["mentors", "participants"],
    });

    if (!direction) {
      throw new NotFoundError("Указанное направление не найден");
    }

    const mentorRole = await this.roleRepository.getRoleByName("mentor");

    if (!mentorRole) {
      throw new InternalServerError("Ошибка проверки роли");
    }

    const isMentor = user.roles.includes(mentorRole);

    if (isMentor) {
      return direction;
    } else {
      direction.mentors = direction.mentors.map((mentor) => {
        delete mentor.phoneNumber;
        return mentor;
      });
      direction.participants = direction.participants.map((participant) => {
        delete participant.phoneNumber;
        return participant;
      });
      return direction;
    }
  }

  @Authorized(["user"])
  @Get("/:id/ratings")
  public async getAllDirectionRatings(
    @CurrentUser() user: User,
    @Param("id") id: number,
    @QueryParam("limit") limit?: number,
    @QueryParam("offset") offset?: number,
  ) {
    if (limit) {
      limit = limit <= 0 ? 1 : limit;
    }
    if (offset) {
      offset = offset < 0 ? 0 : offset;
    }

    const direction = await this.directionRepository.findOne(id);

    if (!direction) {
      throw new NotFoundError("Направление не найдено");
    }

    const mentorRole = await this.roleRepository.getRoleByName("mentor");
    if (!mentorRole) {
      throw new InternalServerError("Ошибка проверки доступа");
    }

    const isMentor = user.roles.includes(mentorRole);

    const ratings = await this.ratingRepository.find({
      relations: ["ratingOwner"],
      where: { direction },
      take: limit,
      skip: offset,
    });

    if (isMentor) {
      return ratings;
    } else {
      if (!ratings.length) {
        return [];
      }

      return ratings.map((rating) => {
        delete rating.ratingOwner.phoneNumber;
        return rating;
      });
    }
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
    @BodyParam("mentors", { required: true })
    mentors: string[],
  ) {
    const dupDirection = await this.directionRepository.findOne(
      { name },
      { relations: ["mentors"] },
    );

    if (dupDirection) {
      throw new BadRequestError("Направление уже существует");
    }

    const mentorsData = await this.userRepository.findByIds(mentors);

    const newDirection = new Direction();
    newDirection.name = name;
    newDirection.description = description;
    newDirection.mentors = mentorsData;
    newDirection.participants = [];

    try {
      await this.directionRepository.save(newDirection);
      logger.info(
        `Администратор [${admin.phoneNumber}] создал направление "${
          newDirection.name
        }"`,
      );
      return { message: "Направление успешно создано" };
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new InternalServerError("Ошибка создания направления");
    }
  }

  @Authorized(["admin"])
  @Patch("/:id")
  public async modifyDirection(
    @CurrentUser() admin: User,
    @Param("id") id: number,
    @BodyParam("name") name: string,
    @BodyParam("description") description: string,
    @BodyParam("mentors") mentors: string[],
  ) {
    const direction = await this.directionRepository.findOne(id);

    if (!direction) {
      throw new NotFoundError("Направление не найдено");
    }

    const updatedDirection = new Direction();
    if (name) {
      updatedDirection.name = name;
    }
    if (description) {
      updatedDirection.description = description;
    }
    let findedMentors: User[];
    if (mentors) {
      findedMentors = await this.userRepository.findByIds(mentors);

      if (!findedMentors) {
        throw new BadRequestError("Невозможно найти указанных менторов");
      }

      updatedDirection.mentors = findedMentors;
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
      return { message: "Направление успешно отредактировано" };
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new InternalServerError("Не удалось отредактировать направление");
    }
  }
}
