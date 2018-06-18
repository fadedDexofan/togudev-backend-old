import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Direction } from "./direction.entity";
import { RatingTransaction } from "./ratingTransaction.entity";
import { User } from "./user.entity";

@Entity()
export class Rating {
  @PrimaryGeneratedColumn("uuid") public uuid?: string;
  @OneToMany((type) => RatingTransaction, (transaction) => transaction.rating)
  public ratingTransactions?: RatingTransaction[];
  @ManyToOne((type) => User, (user) => user.userRatings)
  public ratingOwner: User;

  @Column({ default: 0 })
  public value: number;
  @ManyToOne((type) => Direction)
  @JoinColumn()
  public direction: Direction;
}
