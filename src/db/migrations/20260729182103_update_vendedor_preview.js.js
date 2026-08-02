export async function up(knex) {

    await knex.schema.alterTable(
        "vendedor_import_preview",
        table => {

            table.string("empresa",20)
                .notNullable()
                .defaultTo("QA");

        }
    );

}
 
export async function down(knex)  {

    await knex.schema.alterTable(
        "vendedor_import_preview",
        table => {

            table.dropColumn("empresa");

        }
    );

}