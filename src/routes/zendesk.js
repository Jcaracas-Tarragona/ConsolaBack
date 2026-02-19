// routes/zendesk.js
import express from "express";
import fetch from "node-fetch";

const router = express.Router();

const ZENDESK_DOMAIN = "https://tarragonachilesupport.zendesk.com";
const EMAIL = "jleiva@tarragona.cl";
const API_TOKEN = "65uj4oKN4O94xclV4cHFdkOP2cdpcZk7s0mGuiYB"; // usa ENV en producción

function getHeaders() {
  const token = Buffer.from(`${EMAIL}/token:${API_TOKEN}`).toString("base64");

  return {
    Authorization: `Basic ${token}`,
    "Content-Type": "application/json",
  };
}

router.get("/tickets", async (req, res) => {
  const { desde, hasta } = req.query;

  if (!desde || !hasta) {
    return res.status(400).json({ message: "Fechas requeridas" });
  }

  try {
    let url =
      `${ZENDESK_DOMAIN}/api/v2/search.json?query=` +
      encodeURIComponent(
        `type:ticket status:closed created>=${desde} created<=${hasta}`
      );

    const tickets = [];

    while (url) {
      const response = await fetch(url, { headers: getHeaders() });

      if (!response.ok) {
        return res.status(response.status).json(await response.json());
      }

      const data = await response.json();
      tickets.push(...data.results);
      url = data.next_page;
    }

    res.json(tickets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error Zendesk" });
  }
});


export default router;
