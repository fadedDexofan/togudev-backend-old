import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Rating } from "./rating.entity";
import { User } from "./user.entity";

@Entity()
export class RatingTransaction {
  @PrimaryGeneratedColumn("uuid") public uuid?: string;
  @Column({ default: 0 })
  public valueChange: number;

  @Column("text") public reason: string;
  @ManyToOne((type) => Rating, (rating) => rating.ratingTransactions, {
    cascade: true,
  })
  public rating: Rating;

  @ManyToOne((type) => User, (user) => user.mentorTransactions, {
    cascade: true,
  })
  public author: User;

  @CreateDateColumn() public createdAt?: Date;
}
