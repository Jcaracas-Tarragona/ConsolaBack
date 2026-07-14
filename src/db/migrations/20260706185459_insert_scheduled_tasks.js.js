export async function up(knex) {

  const [id] = await knex("scheduled_tasks")
    .insert({
      codigo: "PROMO_LFD",
      nombre: "Promos DFD Lunes",
      descripcion: "Activa artículos promocionales los lunes y los desactiva los martes.",
      activo: true,
      requiere_confirmacion: true,
      dia_activar: 1,
      dia_desactivar: 2
    })
    .returning("id");

  const taskId = typeof id === "object" ? id.id : id;

  await knex("scheduled_task_articles").insert([
    {
      task_id: taskId,
      codigo_articulo: "1583"
    },
    {
      task_id: taskId,
      codigo_articulo: "1584"
    }
  ]);

}

export async function down(knex) {

  await knex("scheduled_task_articles").del();

  await knex("scheduled_tasks").del();

}