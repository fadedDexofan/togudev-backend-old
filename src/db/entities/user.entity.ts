import { IsEmail, IsMobilePhone, MaxLength, MinLength } from "class-validator";
import { Container } from "typedi";
import {
  BeforeInsert,
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
  @IsEmail()
  @Column({ unique: true })
  public email: string;
  @OneToMany((type) => RefreshToken, (refreshToken) => refreshToken.user, {
    cascade: true,
  })
  public refreshTokens?: RefreshToken[];
  @MinLength(8)
  @MaxLength(24)
  @Column({ type: "text", select: false })
  public password: string;

  @ManyToMany((type) => Role, { eager: true })
  @JoinTable({ name: "user_roles" })
  public roles: Role[];

  @OneToMany((type) => RatingTransaction, (transaction) => transaction.author)
  public mentorTransactions?: RatingTransaction[];
  @OneToMany((type) => Rating, (rating) => rating.ratingOwner)
  public userRatings?: Rating[];
  @ManyToMany((type) => Direction, (direction) => direction.mentors)
  public mentions?: Direction[];
  @ManyToMany((type) => Direction, (direction) => direction.participants)
  public directions?: Direction[];
  @OneToOne((type) => Profile, { cascade: true, eager: true })
  @JoinColumn()
  public profile: Profile;
  @CreateDateColumn() public createdAt?: Date;
  @UpdateDateColumn() public updatedAt?: Date;

  public async checkPassword(plainPassword: string): Promise<boolean> {
    const bcryptService = Container.get(BcryptService);
    const passwordIsCorrect = bcryptService.compareHash(
      plainPassword,
      this.password,
    );
    return passwordIsCorrect;
  }

  @BeforeInsert()
  private async _hashPassword?() {
    const bcryptService = Container.get(BcryptService);
    this.password = await bcryptService.hashString(this.password);
  }
}
