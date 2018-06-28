import { Service } from "typedi";
import { InjectRepository } from "typeorm-typedi-extensions";

import { Direction, Role, User } from "../../db/entities";
import { RoleRepository } from "../../db/repositories";

@Service()
export class RoleHelper {
  constructor(@InjectRepository() public roleRepository: RoleRepository) {}

  public async hasRole(role: string, roles: Role[]): Promise<boolean> {
    const findedRole = await this.roleRepository.getRoleByName(role);

    if (!findedRole) {
      return false;
    }

    return this.hasObject(findedRole, roles);
  }

  public isDirectionMentor(direction: Direction, mentor: User): boolean {
    return this.hasObject(direction, mentor.mentions);
  }

  public hasObject(object: any, array: any[]) {
    if (object.uuid) {
      return Boolean(
        array.filter((obj) => {
          if (obj.uuid === object.uuid) {
            return true;
          } else {
            return false;
          }
        }).length,
      );
    } else if (object.id) {
      return Boolean(
        array.filter((obj) => {
          if (obj.id === object.id) {
            return true;
          } else {
            return false;
          }
        }).length,
      );
    } else {
      return false;
    }
  }
}
