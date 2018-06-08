import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

import { User } from "./user.entity";

@Entity()
export class RefreshToken {
  @PrimaryGeneratedColumn() public id?: number;
  @Column({ type: "text" })
  public refreshToken: string;
  @ManyToOne((type) => User, (user) => user.refreshTokens, { eager: true })
  public user: User;
}
