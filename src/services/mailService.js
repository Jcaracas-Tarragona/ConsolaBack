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
  cc,
  usarCc = true

}) {

  try {

    await transporter.sendMail({

      from:
        `"Alertas Tarragona" <${process.env.MAIL_FROM}>`,

      to:
        to,
      cc: usarCc
            ? (cc || process.env.MAIL_TO)
            : undefined,
      subject,

      html
    });

  } catch (error) {

    console.error("❌ Error enviando correo:", error);
  }
}