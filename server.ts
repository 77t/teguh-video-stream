import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Inisialisasi Google GenAI dengan header User-Agent resmi
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "Teguh AI Engine & Workshop Core",
    version: "2.0.0",
    time: new Date().toISOString(),
  });
});

// PWA Manifest & Service Worker Endpoints (MIME-Type Presisi)
app.get(["/manifest.json", "/manifest.webmanifest"], (_req, res) => {
  res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
  res.sendFile(path.join(process.cwd(), "public", "manifest.json"));
});

app.get("/sw.js", (_req, res) => {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Service-Worker-Allowed", "/");
  res.sendFile(path.join(process.cwd(), "public", "sw.js"));
});

// Endpoint Asisten AI Montir & Sahabat Santri 24 Jam
app.post("/api/montir-ai", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== "string" || !message.trim()) {
      res.status(400).json({ error: "Pesan pertanyaan tidak boleh kosong" });
      return;
    }

    const systemInstruction = `Anda adalah "Kang Teguh AI", asisten montir senior bengkel motor profesional sekaligus sahabat santri Indonesia yang ramah, santun, dan sangat ahli dalam dunia otomotif roda dua:
- Motor Injeksi (PGM-FI, YMJET-FI, BlueCore, eSP, kedipan MIL, TPS, Fuel Pump, injektor, reset ECU).
- Motor Matik & CVT (roller, per CVT, kampas ganda, mangkok kopling, v-belt, gredeg/getar).
- Motor Karburator & Balap (spuyer pilot jet / main jet, skep, intake, klep, noken as, bore up, stroke up, kompresi mesin, 2-tak membran & oli samping).
- Masalah harian (motor mogok, brebet, nembak-nembak, susah hidup pagi hari, boros bensin, rem blong, kelistrikan aki & kiprok).
- Doa berkendara (doa safar), adab perjalanan, dan motivasi rezeki berkah untuk para montir & santri.

Panduan Jawaban Anda:
1. Sapa dengan akrab dan santun ala bengkel & santri (contoh: "Halo lur!", "Wa'alaikumsalam wr wb mas!", "Siap lur, ini diagnosanya:").
2. Berikan analisa sistematis yang mudah dipahami: sebutkan kemungkinan penyebab utama (1, 2, 3), cara pengecekannya, dan langkah perbaikannya.
3. Sebutkan nama suku cadang/part yang relevan secara spesifik (misal: "Busi Iridium", "Roller 10 gram", "Filter Pampers Fuel Pump", "Sensor TPS", "Karet Seal Sil Kruk As", dll.) agar mekanik tahu apa yang harus disiapkan.
4. Gunakan gaya bahasa santai, teknis, padat, dan solutif (hindari jawaban yang bertele-tele).`;

    let reply = "";
    const modelsToTry = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-3.8-flash"];

    for (const m of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: m,
          contents: message.trim(),
          config: {
            systemInstruction,
            temperature: 0.7,
          },
        });
        if (response.text) {
          reply = response.text;
          break;
        }
      } catch (geminiErr: any) {
        console.warn(`Model ${m} busy or error, trying next:`, geminiErr?.message || geminiErr);
      }
    }

    if (!reply) {
      // Fallback jawaban cerdas otomotif lokal
      const lower = message.toLowerCase();
      if (lower.includes("doa") || lower.includes("safar")) {
        reply = "Alhamdulillah lur, sebelum jalan jangan lupa baca doa safar:\n\n*Subhaanalladzii sakh-khara lanaa haadzaa wamaa kunnaa lahu muqriniin, wa innaa ilaa robbinaa lamunqolibuun.*\n\nSemoga perjalanan dilindungi Allah SWT, motor lancar tanpa kendala di jalan, dan rezeki berkah barokah. Aamiin!";
      } else if (lower.includes("brebet")) {
        reply = "Siap lur! Motor brebet saat tarikan gas biasanya karena:\n1. Tekanan fuel pump drop (standar 40-43 PSI), coba cek saringan pampers bensin.\n2. Busi lemah atau celah elektroda terlalu renggang.\n3. Throttle body kotor dan sensor TPS perlu kalibrasi reset ECU.";
      } else {
        reply = "Siap lur! Untuk kendala motor tersebut, langkah awal yang tepat adalah cek sistem pengapian (busi & cop), suplai bahan bakar (tekanan pompa & filter), serta celah klep mesin.";
      }
    }

    res.json({ reply });
  } catch (error: any) {
    console.error("Error in /api/montir-ai:", error?.message || error);
    res.json({
      reply: "Siap lur! Sistem AI sedang memproses data bengkel. Silakan cek bagian busi, filter bensin, dan kondisi aki terlebih dahulu ya!",
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server TEGUH VIDEO STREAM aktif di http://0.0.0.0:${PORT}`);
  });
}

startServer();
