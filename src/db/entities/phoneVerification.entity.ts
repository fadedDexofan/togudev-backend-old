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
  @Column({ unique: true })
  public phoneNumber: string;
  @Column() public verificationCode: number;
  @Column() public attempts: number;
  @CreateDateColumn() public createdAt?: Date;
  @UpdateDateColumn() public updatedAt?: Date;
}
