import {
  Authorized,
  Body,
  Get,
  HttpCode,
  HttpError,
  InternalServerError,
  JsonController,
  NotFoundError,
  OnUndefined,
  Param,
  Post,
} from "routing-controllers";
import { InjectRepository } from "typeorm-typedi-extensions";

import { Service } from "typedi";
import { Direction } from "../../../db/entities";
import { DirectionRepository, UserRepository } from "../../../db/repositories";

@Service()
@JsonController("/directions")
export class DirectionController {
  constructor(
    @InjectRepository() private userRepository: UserRepository,
    @InjectRepository() private directionRepository: DirectionRepository,
  ) {}

  @Get()
  public async getDirections() {
    const directions = await this.directionRepository.find();
    return directions;
  }

  @Get("/:id")
  @OnUndefined(NotFoundError)
  public async getDirection(@Param("id") id: number) {
    const direction = await this.directionRepository.findOne(id);
    return direction;
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
      throw new HttpError(403, "Direction already exist");
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
      throw new InternalServerError(err);
    }
  }
}
