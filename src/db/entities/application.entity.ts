import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Direction } from "./direction.entity";
import { User } from "./user.entity";

@Entity()
export class Application {
  @PrimaryGeneratedColumn("uuid") public uuid?: string;
  @OneToOne((type) => User)
  @JoinColumn()
  public user: User;
  @OneToOne((type) => Direction)
  @JoinColumn()
  public direction: Direction;

  @CreateDateColumn() public createdAt?: Date;
}
