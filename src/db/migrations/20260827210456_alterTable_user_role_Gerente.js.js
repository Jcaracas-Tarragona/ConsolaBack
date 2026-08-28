export async function up(knex) {

  await knex.raw(`
    ALTER TABLE users
    DROP CONSTRAINT users_role_check;
  `);

  await knex.raw(`
    ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (
      role IN (
        'Admin',
        'N1',
        'N2',
        'Local',
        'Comercial',
        'Zonal',
        'RRHH',
        'Gerente'
      )
    );
  `);

}

export async function down(knex) {

  await knex.raw(`
    ALTER TABLE users
    DROP CONSTRAINT users_role_check;
  `);

  await knex.raw(`
    ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (
      role IN (
        'Admin',
        'N1',
        'N2',
        'Local',
        'Comercial',
        'Zonal',
        'RRHH'
      )
    );
  `);

}