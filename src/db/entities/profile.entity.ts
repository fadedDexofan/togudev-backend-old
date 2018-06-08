import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Profile {
  @PrimaryGeneratedColumn() public id?: number;
  @Column({ nullable: true })
  public firstName?: string;
  @Column({ nullable: true })
  public lastName?: string;
  @Column({ nullable: true })
  public contact?: string;
  @Column("text", { nullable: true })
  public photoUrl?: string;
}
