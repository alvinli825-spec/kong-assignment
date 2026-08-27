import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1787961600000 implements MigrationInterface {
  name = 'InitialSchema1787961600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "service" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" character varying(255) NOT NULL,
        "description" text NOT NULL DEFAULT '',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_service_name" ON "service" ("name")`);
    await queryRunner.query(`CREATE INDEX "idx_service_created_at" ON "service" ("created_at")`);
    await queryRunner.query(`
      CREATE TABLE "service_version" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "service_id" uuid NOT NULL REFERENCES "service" ("id") ON DELETE CASCADE,
        "name" character varying(100) NOT NULL,
        "description" text NOT NULL DEFAULT '',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_service_version_service_id" ON "service_version" ("service_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "service_version"`);
    await queryRunner.query(`DROP TABLE "service"`);
  }
}
