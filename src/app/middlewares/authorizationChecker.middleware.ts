import { Context } from "koa";
import { Container } from "typedi";
import { getCustomRepository } from "typeorm";

import { UserRepository } from "../../db/repositories";
import { JWTService } from "../../services";
import { ApiErrorEnum } from "../errors";
import { ApiError } from "../helpers";

const jwtService = Container.get(JWTService);

export async function authorizationChecker(
  ctx: Context,
  roles: string[],
): Promise<boolean> {
  const token = jwtService.extractToken(ctx.request.headers);
  let payload: any;
  try {
    payload = await jwtService.verify(token);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw new ApiError(
        ApiErrorEnum.TOKEN_EXPIRED,
        "Время жизни access token истекло",
      );
    } else {
      throw new ApiError(
        ApiErrorEnum.TOKEN_REQUIRED,
        "Некорректный access token",
      );
    }
  }

  const userFromToken = await getCustomRepository(UserRepository).findOne(
    payload.sub,
    { relations: ["roles"] },
  );

  if (!userFromToken) {
    throw new ApiError(ApiErrorEnum.NOT_FOUND, "Пользователь не найден");
  }

  if (roles && roles.length) {
    const userRoles = userFromToken.roles.map((role) => role.name);
    const isAuthorized = roles.every((role: string) =>
      userRoles.includes(role),
    );
    if (!isAuthorized) {
      throw new ApiError(ApiErrorEnum.UNAUTHORIZED, "Доступ запрещен");
    }
  }

  return true;
}
