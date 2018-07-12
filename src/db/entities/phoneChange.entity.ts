import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity()
export class PhoneChange {
  @PrimaryGeneratedColumn() public id?: number;
  @Column({ unique: true })
  public oldPhone: string;
  @Column({ unique: true })
  public newPhone: string;

  @Column() public verificationCode: number;
  @Column() public attempts: number;
  @CreateDateColumn() public createdAt?: Date;
  @UpdateDateColumn() public updatedAt?: Date;
}
