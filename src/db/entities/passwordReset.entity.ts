import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity()
export class PasswordReset {
  @PrimaryGeneratedColumn() public id?: number;
  @Column({ unique: true })
  public phoneNumber: string;
  @Column() public verificationCode: number;
  @Column() public attempts: number;
  @Column("text", { nullable: true })
  public verificationToken: string;
  @CreateDateColumn() public createdAt?: Date;
  @UpdateDateColumn() public updatedAt?: Date;
}
