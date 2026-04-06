export async function up(knex) {
  await knex.schema.createTable("zendesks", (table) => {

    table.increments("id").primary();

    // 🔑 Identificador externo (Zendesk)
    table.string("ticket_id").notNullable().unique();

    // 📅 Fechas de Zendesk
    table.timestamp("zd_created_at").notNullable();
    table.timestamp("zd_updated_at");

    // 📊 Estado
    table.string("status").notNullable();

    // 🏪 Relación local
    table.integer("codigo_local").notNullable();

    // 🧩 Clasificación
    table.string("tipo_ticket");
    table.string("tipo_consulta");
    table.string("tipo_servicio");

    // ✅ Estado final
    table.boolean("requerimiento_completado").defaultTo(false);

    // 🕒 Sistema (auditoría interna)
    table.timestamps(true, true);

    // 🔐 FK
    table
      .foreign("codigo_local")
      .references("codLocal")
      .inTable("connections")
      .onDelete("CASCADE");

    // ⚡ Índices
    table.index("codigo_local", "idx_zd_local");
    table.index("status", "idx_zd_status");
    table.index("zd_created_at", "idx_zd_created");
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("zendesks");
}