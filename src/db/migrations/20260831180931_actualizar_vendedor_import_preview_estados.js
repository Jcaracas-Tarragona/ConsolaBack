export async function up(knex) {
  await knex.transaction(async trx => {
    const estados = [
      {
        codigo: "PREVIEW",
        nombre: "Preview",
        grupo: "VENDEDOR_IMPORT",
        orden: 1,
        activo: true
      },
      {
        codigo: "EN_COLA",
        nombre: "En cola",
        grupo: "VENDEDOR_IMPORT",
        orden: 2,
        activo: true
      },
      {
        codigo: "PROCESANDO_CENTRAL",
        nombre: "Procesando Central",
        grupo: "VENDEDOR_IMPORT",
        orden: 3,
        activo: true
      },
      {
        codigo: "ERROR_CENTRAL",
        nombre: "Error Central",
        grupo: "VENDEDOR_IMPORT",
        orden: 4,
        activo: true
      },
      {
        codigo: "PENDIENTE_DISTRIBUCION",
        nombre: "Pendiente de distribución",
        grupo: "VENDEDOR_IMPORT",
        orden: 5,
        activo: true
      },
      {
        codigo: "DISTRIBUCION_PARCIAL",
        nombre: "Distribución parcial",
        grupo: "VENDEDOR_IMPORT",
        orden: 6,
        activo: true
      },
      {
        codigo: "DISTRIBUIDO",
        nombre: "Distribuido",
        grupo: "VENDEDOR_IMPORT",
        orden: 7,
        activo: true
      }
    ];

    for (const estado of estados) {
      const existente = await trx("estados")
        .where({
          grupo: estado.grupo,
          codigo: estado.codigo
        })
        .first();

      if (!existente) {
        await trx("estados").insert({
          ...estado,
          created_at: trx.fn.now(),
          updated_at: trx.fn.now()
        });
      }
    }

    const tieneEstadoId = await trx.schema.hasColumn(
      "vendedor_import_preview",
      "estado_id"
    );

    if (!tieneEstadoId) {
      await trx.schema.alterTable(
        "vendedor_import_preview",
        table => {
          table
            .integer("estado_id")
            .nullable()
            .references("id")
            .inTable("estados")
            .onDelete("RESTRICT");

          table
            .timestamp("central_actualizado_at", {
              useTz: true
            })
            .nullable();

          table
            .timestamp("distribuido_at", {
              useTz: true
            })
            .nullable();

          table.index(
            ["estado_id"],
            "idx_vendedor_import_preview_estado"
          );

          table.index(
            ["empresa", "created_at"],
            "idx_vendedor_import_preview_empresa_fecha"
          );
        }
      );
    }

    const estadoPreview = await trx("estados")
      .where({
        grupo: "VENDEDOR_IMPORT",
        codigo: "PREVIEW"
      })
      .first();

    if (!estadoPreview) {
      throw new Error(
        "No se pudo obtener el estado PREVIEW."
      );
    }

    await trx("vendedor_import_preview")
      .whereNull("estado_id")
      .update({
        estado_id: estadoPreview.id
      });

    await trx.raw(`
      ALTER TABLE vendedor_import_preview
      ALTER COLUMN estado_id SET NOT NULL
    `);
  });
}

export async function down(knex) {
  await knex.transaction(async trx => {
    const tieneEstadoId = await trx.schema.hasColumn(
      "vendedor_import_preview",
      "estado_id"
    );

    if (tieneEstadoId) {
      await trx.schema.alterTable(
        "vendedor_import_preview",
        table => {
          table.dropIndex(
            ["empresa", "created_at"],
            "idx_vendedor_import_preview_empresa_fecha"
          );

          table.dropIndex(
            ["estado_id"],
            "idx_vendedor_import_preview_estado"
          );

          table.dropColumn("distribuido_at");
          table.dropColumn("central_actualizado_at");
          table.dropColumn("estado_id");
        }
      );
    }

    await trx("estados")
      .where({
        grupo: "VENDEDOR_IMPORT"
      })
      .whereIn("codigo", [
        "PREVIEW",
        "EN_COLA",
        "PROCESANDO_CENTRAL",
        "ERROR_CENTRAL",
        "PENDIENTE_DISTRIBUCION",
        "DISTRIBUCION_PARCIAL",
        "DISTRIBUIDO"
      ])
      .del();
  });
}