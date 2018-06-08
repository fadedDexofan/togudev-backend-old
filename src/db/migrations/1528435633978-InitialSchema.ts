import {MigrationInterface, QueryRunner} from "typeorm";

export class InitialSchema1528435633978 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "profile" ("id" SERIAL NOT NULL, "firstName" character varying, "lastName" character varying NOT NULL DEFAULT '', "contact" character varying NOT NULL DEFAULT '', "photoUrl" text NOT NULL DEFAULT '', CONSTRAINT "PK_3dd8bfc97e4a77c70971591bdcb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "rating_transaction" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "valueChange" integer NOT NULL DEFAULT 0, "reason" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "ratingUuid" uuid, "authorUuid" uuid, CONSTRAINT "PK_615e082129053b36219ab5cc124" PRIMARY KEY ("uuid"))`);
        await queryRunner.query(`CREATE TABLE "rating" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "value" integer NOT NULL DEFAULT 0, "ratingOwnerUuid" uuid, "directionId" integer, CONSTRAINT "PK_548145228667df2bf825e620210" PRIMARY KEY ("uuid"))`);
        await queryRunner.query(`CREATE TABLE "refresh_token" ("id" SERIAL NOT NULL, "refreshToken" text NOT NULL, "userUuid" uuid, CONSTRAINT "PK_b575dd3c21fb0831013c909e7fe" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "role" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, CONSTRAINT "UQ_ae4578dcaed5adff96595e61660" UNIQUE ("name"), CONSTRAINT "PK_b36bcfe02fc8de3c57a8b2391c2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "phoneNumber" character varying NOT NULL, "email" character varying NOT NULL, "password" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "profileId" integer, CONSTRAINT "UQ_f2578043e491921209f5dadd080" UNIQUE ("phoneNumber"), CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "REL_9466682df91534dd95e4dbaa61" UNIQUE ("profileId"), CONSTRAINT "PK_a95e949168be7b7ece1a2382fed" PRIMARY KEY ("uuid"))`);
        await queryRunner.query(`CREATE TABLE "direction" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "description" text NOT NULL, CONSTRAINT "UQ_edf14d6421b3ae4eaf7517cd8a7" UNIQUE ("name"), CONSTRAINT "PK_cd7122416e3f733711b5cfa2924" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user_roles" ("userUuid" uuid NOT NULL, "roleId" integer NOT NULL, CONSTRAINT "PK_704bbd0a86ed59214d539ad96ef" PRIMARY KEY ("userUuid", "roleId"))`);
        await queryRunner.query(`CREATE TABLE "direction_mentors_user" ("directionId" integer NOT NULL, "userUuid" uuid NOT NULL, CONSTRAINT "PK_dbfdb7ea5bb3e77ca5fac2dbf5e" PRIMARY KEY ("directionId", "userUuid"))`);
        await queryRunner.query(`CREATE TABLE "direction_participants_user" ("directionId" integer NOT NULL, "userUuid" uuid NOT NULL, CONSTRAINT "PK_f1ca3ee698799208130380b25c4" PRIMARY KEY ("directionId", "userUuid"))`);
        await queryRunner.query(`ALTER TABLE "rating_transaction" ADD CONSTRAINT "FK_9bf74bcf8c4e46972b492084c5b" FOREIGN KEY ("ratingUuid") REFERENCES "rating"("uuid")`);
        await queryRunner.query(`ALTER TABLE "rating_transaction" ADD CONSTRAINT "FK_4c93bd4f3b504ec787d6581558b" FOREIGN KEY ("authorUuid") REFERENCES "user"("uuid")`);
        await queryRunner.query(`ALTER TABLE "rating" ADD CONSTRAINT "FK_404cd937d0dee0ac6bc2c91ddf0" FOREIGN KEY ("ratingOwnerUuid") REFERENCES "user"("uuid")`);
        await queryRunner.query(`ALTER TABLE "rating" ADD CONSTRAINT "FK_28110e8ddbb4408a881893bce04" FOREIGN KEY ("directionId") REFERENCES "direction"("id")`);
        await queryRunner.query(`ALTER TABLE "refresh_token" ADD CONSTRAINT "FK_7bcffdf3e178d0b35c0c50541ee" FOREIGN KEY ("userUuid") REFERENCES "user"("uuid")`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_9466682df91534dd95e4dbaa616" FOREIGN KEY ("profileId") REFERENCES "profile"("id")`);
        await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "FK_dc7659b2e3cd0061a3c47278507" FOREIGN KEY ("userUuid") REFERENCES "user"("uuid") ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "FK_86033897c009fcca8b6505d6be2" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE "direction_mentors_user" ADD CONSTRAINT "FK_0d6e53e795dd5caaf0a36cc5a71" FOREIGN KEY ("directionId") REFERENCES "direction"("id") ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE "direction_mentors_user" ADD CONSTRAINT "FK_7774c25c6aba83a69638f870fc5" FOREIGN KEY ("userUuid") REFERENCES "user"("uuid") ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE "direction_participants_user" ADD CONSTRAINT "FK_51753658c3e855427ed6745a56a" FOREIGN KEY ("directionId") REFERENCES "direction"("id") ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE "direction_participants_user" ADD CONSTRAINT "FK_2c9801112a6a2a5e96983ca4554" FOREIGN KEY ("userUuid") REFERENCES "user"("uuid") ON DELETE CASCADE`);
        await queryRunner.query(`CREATE TABLE "query-result-cache" ("id" SERIAL NOT NULL, "identifier" character varying, "time" bigint NOT NULL, "duration" integer NOT NULL, "query" text NOT NULL, "result" text NOT NULL, CONSTRAINT "PK_6a98f758d8bfd010e7e10ffd3d3" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP TABLE "query-result-cache"`);
        await queryRunner.query(`ALTER TABLE "direction_participants_user" DROP CONSTRAINT "FK_2c9801112a6a2a5e96983ca4554"`);
        await queryRunner.query(`ALTER TABLE "direction_participants_user" DROP CONSTRAINT "FK_51753658c3e855427ed6745a56a"`);
        await queryRunner.query(`ALTER TABLE "direction_mentors_user" DROP CONSTRAINT "FK_7774c25c6aba83a69638f870fc5"`);
        await queryRunner.query(`ALTER TABLE "direction_mentors_user" DROP CONSTRAINT "FK_0d6e53e795dd5caaf0a36cc5a71"`);
        await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_86033897c009fcca8b6505d6be2"`);
        await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_dc7659b2e3cd0061a3c47278507"`);
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_9466682df91534dd95e4dbaa616"`);
        await queryRunner.query(`ALTER TABLE "refresh_token" DROP CONSTRAINT "FK_7bcffdf3e178d0b35c0c50541ee"`);
        await queryRunner.query(`ALTER TABLE "rating" DROP CONSTRAINT "FK_28110e8ddbb4408a881893bce04"`);
        await queryRunner.query(`ALTER TABLE "rating" DROP CONSTRAINT "FK_404cd937d0dee0ac6bc2c91ddf0"`);
        await queryRunner.query(`ALTER TABLE "rating_transaction" DROP CONSTRAINT "FK_4c93bd4f3b504ec787d6581558b"`);
        await queryRunner.query(`ALTER TABLE "rating_transaction" DROP CONSTRAINT "FK_9bf74bcf8c4e46972b492084c5b"`);
        await queryRunner.query(`DROP TABLE "direction_participants_user"`);
        await queryRunner.query(`DROP TABLE "direction_mentors_user"`);
        await queryRunner.query(`DROP TABLE "user_roles"`);
        await queryRunner.query(`DROP TABLE "direction"`);
        await queryRunner.query(`DROP TABLE "user"`);
        await queryRunner.query(`DROP TABLE "role"`);
        await queryRunner.query(`DROP TABLE "refresh_token"`);
        await queryRunner.query(`DROP TABLE "rating"`);
        await queryRunner.query(`DROP TABLE "rating_transaction"`);
        await queryRunner.query(`DROP TABLE "profile"`);
    }

}
