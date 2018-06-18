import { EntityRepository, Repository } from "typeorm";
import { User } from "../entities";

@EntityRepository(User)
export class UserRepository extends Repository<User> {
  public async getUserByPhone(phoneNumber: string): Promise<User | undefined> {
    return this.findOne({ phoneNumber });
  }

  public async getAllUsers(): Promise<User[] | undefined> {
    return this.find();
  }
}
