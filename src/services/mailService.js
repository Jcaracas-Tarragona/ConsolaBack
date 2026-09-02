import nodemailer from "nodemailer";

/* =====================================================
   TRANSPORTER
===================================================== */

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});


/* =====================================================
   ENVIAR CORREO GENERICO
===================================================== */

export async function enviarCorreoAlerta({
  subject,
  html,
  to,
  cc = null,
  bcc = null,
  usarCc = true,
  usarBcc = false
}) {

  try {

    if (!to || String(to).trim() === "") {
      throw new Error("No se definió destinatario para el correo");
    }

    const destinatario = String(to).trim();

    const mailOptions = {
      from: `"Alertas Tarragona" <${process.env.MAIL_FROM}>`,
      to: destinatario,
      subject,
      html
    };

    /* COPIA */
    if (usarCc) {
      const copia = cc || process.env.MAIL_TO;

      if (copia && String(copia).trim() !== "") {
        mailOptions.cc = String(copia).trim();
      }
    }

    /* COPIA OCULTA */
    if (usarBcc && bcc) {
      mailOptions.bcc = String(bcc).trim();
    }

    console.log("Enviando correo a:", mailOptions.to);

    await transporter.sendMail(mailOptions);

    return {
      ok: true
    };

  } catch (error) {

    console.error("❌ Error enviando correo:", error);

    return {
      ok: false,
      error: error.message
    };

  }
}