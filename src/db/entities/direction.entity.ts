import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "./user.entity";

@Entity()
export class Direction {
  @PrimaryGeneratedColumn() public id?: number;
  @ManyToOne((type) => User, (user) => user.mentions, { cascade: true })
  @JoinColumn()
  public mentor: User;
  @Column({ unique: true })
  public name: string;
  @Column("text") public description: string;
  @ManyToMany((type) => User, (user) => user.directions)
  @JoinTable({ name: "direction_users" })
  public participants: User[];
}
