import {
  Authorized,
  BadRequestError,
  Body,
  BodyParam,
  CurrentUser,
  Get,
  HttpCode,
  InternalServerError,
  JsonController,
  NotFoundError,
  OnUndefined,
  Param,
  Post,
} from "routing-controllers";
import { Service } from "typedi";
import { InjectRepository } from "typeorm-typedi-extensions";

import { Application, Direction, User } from "../../../db/entities";

import {
  ApplicationRepository,
  DirectionRepository,
  RatingRepository,
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
  ) {}

  @Get()
  public async getDirections() {
    const directions = await this.directionRepository.find();

    return directions;
  }

  @HttpCode(201)
  @Authorized(["user"])
  @Post("/apply")
  public async applyToDirection(
    @CurrentUser() user: User,
    @BodyParam("directionId") directionId: number,
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

      return { message: "Заявка успешно создана", application };
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new InternalServerError("Ошибка создания заявки");
    }
  }

  @Get("/:id")
  @OnUndefined(NotFoundError)
  public async getDirection(@Param("id") id: number) {
    const direction = await this.directionRepository.findOne(id, {
      relations: ["participants", "mentors"],
    });

    return direction;
  }

  @Authorized(["user"])
  @Get("/:id/ratings")
  public async getAllDirectionRatings(
    @Param("id") id: number,
    @Param("limit") limit?: number,
    @Param("offset") offset?: number,
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

    return this.ratingRepository.find({
      relations: ["user", "direction"],
      where: { direction },
      take: limit,
      skip: offset,
    });
  }

  @HttpCode(201)
  @Authorized(["admin"])
  @Post()
  public async createDirection(@Body() directionData: Direction) {
    const { name, mentors, description } = directionData;

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

    try {
      const createdDirection: Direction = await this.directionRepository.save(
        newDirection,
      );

      return createdDirection;
    } catch (err) {
      logger.error(err);
      Raven.captureException(err);
      throw new InternalServerError("Ошибка создания направления");
    }
  }
}
