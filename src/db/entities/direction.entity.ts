import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "./user.entity";

@Entity()
export class Direction {
  @PrimaryGeneratedColumn() public id?: number;
  @ManyToMany((type) => User, (user) => user.mentions, { cascade: true })
  @JoinTable()
  public mentors: User[];
  @Column({ unique: true })
  public name: string;
  @Column("text") public description: string;
  @ManyToMany((type) => User, (user) => user.directions)
  @JoinTable({ name: "direction_users" })
  public participants?: User[];
}
