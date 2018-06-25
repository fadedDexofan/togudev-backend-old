import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Achievement {
  @PrimaryGeneratedColumn() public id?: number;
  @Column() public name: string;

  @Column("varchar") public description: string;
}
