import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity()
export class PhoneVerification {
  @PrimaryGeneratedColumn() public id?: number;
  @Column({ unique: true, nullable: false })
  public phoneNumber: string;
  @Column({ nullable: false })
  public verificationCode: number;
  @Column({ default: false })
  public status: boolean;
  @Column({ default: 0 })
  public attempts: number;
  @CreateDateColumn() public createdAt?: Date;
  @UpdateDateColumn() public updatedAt?: Date;
}
