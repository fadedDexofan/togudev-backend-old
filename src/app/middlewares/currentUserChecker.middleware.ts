import { Context } from "koa";
import { Container } from "typedi";
import { getCustomRepository } from "typeorm";

import { User } from "../../db/entities";
import { UserRepository } from "../../db/repositories";
import { JWTService } from "../../services";

const jwtService = Container.get(JWTService);

export async function currentUserChecker(
  ctx: Context,
): Promise<User | undefined> {
  const token = jwtService.extractToken(ctx.request.headers);
  const payload: any = await jwtService.verify(token);

  return getCustomRepository(UserRepository).findOne(payload.sub, {
    relations: [
      "profile",
      "userRatings",
      "userRatings.direction",
      "mentions",
      "roles",
      "directions",
      "achievements",
    ],
  });
}
