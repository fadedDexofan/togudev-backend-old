import { IsMobilePhone, MaxLength, MinLength } from "class-validator";
import { Container } from "typedi";
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { BcryptService } from "../../services";
import { Achievement } from "./achievement.entity";
import { Direction } from "./direction.entity";
import { Profile } from "./profile.entity";
import { Rating } from "./rating.entity";
import { RatingTransaction } from "./ratingTransaction.entity";
import { RefreshToken } from "./refreshToken.entity";
import { Role } from "./role.entity";

@Entity()
export class User {
  @PrimaryGeneratedColumn("uuid") public uuid?: string;
  @IsMobilePhone("ru-RU")
  @Column({ unique: true })
  public phoneNumber: string;
  @OneToMany((type) => RefreshToken, (refreshToken) => refreshToken.user, {
    cascade: true,
  })
  public refreshTokens?: RefreshToken[];
  @MinLength(8)
  @MaxLength(24)
  @Column({ type: "text", select: false })
  public password: string;

  @ManyToMany((type) => Role)
  @JoinTable({ name: "user_roles" })
  public roles: Role[];

  @OneToMany((type) => RatingTransaction, (transaction) => transaction.author)
  public mentorTransactions: RatingTransaction[];
  @OneToMany((type) => Rating, (rating) => rating.ratingOwner, {
    cascade: true,
  })
  public userRatings: Rating[];
  @OneToMany((type) => Direction, (direction) => direction.mentor)
  public mentions: Direction[];
  @ManyToMany((type) => Direction, (direction) => direction.participants, {
    cascade: true,
  })
  public directions: Direction[];
  @OneToOne((type) => Profile, { cascade: true })
  @JoinColumn()
  public profile: Profile;

  @ManyToMany((type) => Achievement, { cascade: true })
  @JoinTable()
  public achievements: Achievement[];
  @CreateDateColumn() public createdAt?: Date;
  @UpdateDateColumn() public updatedAt?: Date;

  public async checkPassword(plainPassword: string): Promise<boolean> {
    const bcryptService = Container.get(BcryptService);
    return bcryptService.compareHash(plainPassword, this.password);
  }
}
