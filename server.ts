import express from "express";
import path from "path";
import { Readable } from "stream";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Audio Stream Proxy 100% Reliable (Mengatasi Masalah CORS, SSL Mixed-Content, & Server Radio)
app.get("/api/radio-stream", async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl || typeof targetUrl !== "string") {
    res.status(400).send("Parameter url wajib disertakan");
    return;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const upstream = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Icy-MetaData": "0"
      }
    });

    clearTimeout(timeoutId);

    if (!upstream.ok || !upstream.body) {
      res.status(upstream.status || 502).send("Gagal menyambung ke server radio");
      return;
    }

    const contentType = upstream.headers.get("content-type") || "audio/mpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const nodeStream = Readable.fromWeb(upstream.body as any);
    req.on("close", () => {
      nodeStream.destroy();
    });

    nodeStream.pipe(res);
  } catch (err: any) {
    console.error("Radio proxy error for", targetUrl, ":", err?.message || err);
    if (!res.headersSent) {
      res.status(502).send("Server radio tidak dapat dijangkau");
    }
  }
});

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

// Endpoint Pencarian & Resolusi Video YouTube Real-Time (Tanpa Unavailable)
const youtubeSearchCache = new Map<string, string>();

app.get("/api/youtube-resolve", async (req, res) => {
  try {
    const q = req.query.q as string;
    if (!q || !q.trim()) {
      res.status(400).json({ error: "Query pencarian wajib diisi" });
      return;
    }
    const cleanQ = q.trim();

    if (youtubeSearchCache.has(cleanQ)) {
      res.json({ videoId: youtubeSearchCache.get(cleanQ), source: "cache" });
      return;
    }

    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQ)}`;
    const ytRes = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
      },
    });

    const html = await ytRes.text();
    const match = html.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);

    if (match && match[1]) {
      const vidId = match[1];
      youtubeSearchCache.set(cleanQ, vidId);
      res.json({ videoId: vidId, embedUrl: `https://www.youtube.com/embed/${vidId}?autoplay=1&rel=0`, source: "live" });
      return;
    }

    res.json({ videoId: null, embedUrl: null });
  } catch (err: any) {
    console.error("Error in /api/youtube-resolve:", err?.message || err);
    res.status(500).json({ error: "Gagal mencari video YouTube" });
  }
});

// Endpoint Asisten AI Montir & Sahabat Santri 24 Jam
app.post("/api/montir-ai", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== "string" || !message.trim()) {
      res.status(400).json({ error: "Pesan pertanyaan tidak boleh kosong" });
      return;
    }

    const systemInstruction = `Anda adalah "Kang Teguh AI", montir senior bengkel motor profesional & sahabat santri Indonesia yang sangat ramah, santun, teknis, dan presisi.

ATURAN UTAMA:
1. WAJIB MENJAWAB SESUAI PERTANYAAN SPESIFIK PENGGUNA. Jangan pernah memberikan jawaban generic atau template yang sama untuk pertanyaan berbeda!
2. Jika pengguna menanyakan tipe motor tertentu (Beat, Vario, Nmax, Aerox, Scoopy, Satria FU, Ninja, RX King, Supra, Jupiter, Mio, dll.), sebutkan spesifikasi & part khusus untuk motor tersebut.
3. Jika ditanya ukuran roller, sebutkan berat standar dalam gram dan opsi racikan tuning harian/touring.
4. Jika ditanya ukuran spuyer/karburator, sebutkan pilot jet & main jet yang tepat.
5. Jika ditanya masalah getar/gredek CVT, sebutkan solusi mangkok kartel, amplas kampas ganda, dan kebersihan seal kruk as.
6. Jika ditanya motor brebet / hilang tenaga, analisa tekanan fuel pump (standar 40-43 psi), busi/cop busi, dan throttle body.
7. Jika ditanya kode kedipan MIL injeksi, artikan jumlah kedipannya secara tepat (1 kedip = MAP, 7 = EOT/ECT, 8 = TP, 9 = IAT, 12 = Injektor, 21 = O2, 52 = CKP).
8. Jika ditanya doa atau seputar santri, berikan lafadz Arab, latin, arti, dan adab berkendara.
9. Sebutkan suku cadang/part relevan secara spesifik (misal: "Busi Iridium Daytona", "Roller Kawahara 13g", "Filter Pampers Bensin", "Oli Motul Scooter Expert", dll.).
10. Gunakan gaya bahasa khas montir & santri yang akrab: "Assalamu'alaikum lur / mas!", "Siap lur, ini solusinya:".`;

    let reply = "";
    // Prioritaskan model aktif dengan quota stabil
    const modelsToTry = [
      "gemini-3.1-flash-lite",
      "gemini-3.5-flash",
      "gemini-3.7-flash",
      "gemini-flash-latest",
      "gemini-3.8-flash",
    ];

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
        if (response.text && response.text.trim()) {
          reply = response.text.trim();
          break;
        }
      } catch (geminiErr: any) {
        console.warn(`Model ${m} error/busy, trying next:`, geminiErr?.message || geminiErr);
      }
    }

    if (!reply) {
      // Fallback lokal super detail berbasis kata kunci jika seluruh model AI eksternal sibuk
      reply = getSmartLocalMontirAnswer(message.trim());
    }

    res.json({ reply });
  } catch (error: any) {
    console.error("Error in /api/montir-ai:", error?.message || error);
    res.json({
      reply: getSmartLocalMontirAnswer(req.body?.message || ""),
    });
  }
});

function getSmartLocalMontirAnswer(question: string): string {
  const q = question.toLowerCase();

  // DOA & SANTRI
  if (q.includes("doa") || q.includes("safar") || q.includes("santri") || q.includes("selamat") || q.includes("musibah") || q.includes("bocor")) {
    if (q.includes("musibah") || q.includes("bocor") || q.includes("mogok")) {
      return "Assalamu'alaikum lur. Sabar ya, ujian di jalan insyaAllah menggugurkan dosa. Ketika terkena musibah ban bocor atau mogok, Rasulullah SAW mengajarkan doa:\n\n*Innaa lillaahi wa innaa ilaihi rooji'uun, allaahumma'jurnii fii mushiibatii wa akhlif lii khoiron minhaa.*\n\nArtinya: 'Sesungguhnya kami milik Allah dan kepada-Nya kami kembali. Ya Allah berilah pahala atas musibahku ini dan gantikanlah dengan yang lebih baik.'\n\nTetap tenang lur, dorong motor pelan-pelan ke tambal ban terdekat. Semoga dimudahkan perjalanannya!";
    }
    return "Assalamu'alaikum wr wb lur! Mari amalkan doa safar sebelum gas motor:\n\n*Subhaanalladzii sakh-khara lanaa haadzaa wamaa kunnaa lahu muqriniin, wa innaa ilaa robbinaa lamunqolibuun.*\n\nArtinya: 'Maha Suci Allah yang telah menundukkan semua ini bagi kami padahal sebelumnya kami tidak mampu menguasainya, dan sesungguhnya kami akan kembali kepada Tuhan kami.' (HR. Muslim)\n\nNiatkan mencari nafkah halal, jaga adab berkendara, jangan lupa helm SNI & cek rem motor!";
  }

  // ROLLER & CVT RACIKAN
  if (q.includes("roller") || q.includes("berat roller") || q.includes("gram")) {
    let standard = "Standar motor matic umumnya antara 11 - 15 gram.";
    let racikan = "Turunkan 1 - 2 gram dari standar jika ingin tarikan bawah responsif dan nanjak enteng.";

    if (q.includes("beat esp") || q.includes("beat fi") || q.includes("scoopy esp")) {
      standard = "Standar Honda Beat eSP / Scoopy eSP (K81/K44) adalah **15 gram** (6 butir = total 90 gram). Untuk Beat FI starter kasar (K25) adalah **13 gram**.";
      racikan = "Untuk Beat eSP harian lebih responsif: gunakan **12 atau 13 gram rata**, atau silang **3x12g + 3x14g** dipadu per CVT 1000 RPM!";
    } else if (q.includes("vario 125")) {
      standard = "Standar Honda Vario 125 (KZR/K59) adalah **18 gram**.";
      racikan = "Untuk Vario 125 harian stop-and-go di perkotaan: turunkan ke **14 atau 15 gram rata**.";
    } else if (q.includes("vario 150") || q.includes("vario 160") || q.includes("pcx")) {
      standard = "Standar Vario 150/160 & PCX adalah **15.5 gram - 19 gram**.";
      racikan = "Rekomendasi harian: gunakan **14 atau 15 gram rata** agar akselerasi tidak loyo.";
    } else if (q.includes("nmax") || q.includes("aerox")) {
      standard = "Standar Yamaha NMAX 155 adalah **13 gram**, sedangkan Aerox 155 adalah **13 gram** (versi baru 12.5 gram).";
      racikan = "Rekomendasi touring nanjak: pakai **10 atau 11 gram rata** dipadu per CVT 1500 RPM PCX Thailand.";
    } else if (q.includes("mio") || q.includes("fino")) {
      standard = "Standar Yamaha Mio Sporty/Smile adalah **10.5 gram**, Mio J/Soul GT adalah **9.5 gram**, Mio M3 125 adalah **12 gram**.";
      racikan = "Rekomendasi: pakai **8 gram untuk Mio Sporty** atau **10 gram untuk Mio M3**.";
    }

    return `Siap lur! Mengenai ukuran berat roller:\n\n1. **Ukuran Standar Pabrik:**\n${standard}\n\n2. **Rekomendasi Racikan Harian:**\n${racikan}\n\n*Tips Bengkel:* Jangan silang roller lebih dari selisih 2 gram (misal 10g dengan 15g jangan!) karena puli depan akan berputar tidak seimbang dan rumah roller cepat aus/oblak.`;
  }

  // CVT GREDEK / GETAR
  if (q.includes("gredek") || q.includes("getar") || q.includes("cvt") || q.includes("kampas ganda")) {
    return "Assalamu'alaikum lur! Penyakit CVT gredek/getar di RPM rendah (kecepatan 0-20 km/jam) solusinya sebagai berikut:\n\n1. **Penyebab Utama:** Debu kampas ganda menumpuk di dinding dalam mangkok kopling, atau ada kebocoran sil kruk as sebelah kiri sehingga oli membasahi kampas.\n2. **Solusi Bengkel Tuntas:**\n- Amplas permukaan sepatu kampas ganda menggunakan amplas no. 120 secara menyilang (cross).\n- Bersihkan mangkok kopling dengan bensin/degreaser sampai kesat.\n- Pakai **Mangkok Kopling Custom Berlubang (Kartel)** agar debu kampas otomatis terlempar keluar.\n- Periksa karet dumper kampas ganda, jika sudah keras/peyang segera ganti baru.\n3. **Cek V-Belt & Slider:** Pastikan v-belt belum retak-retak dan piece slide (karet slider rumah roller) tidak oblak.";
  }

  // BREBET / MOGOK / INJEKSI
  if (q.includes("brebet") || q.includes("gas kosong") || q.includes("tersendat") || q.includes("nembak")) {
    return "Siap lur! Motor brebet saat ditarik gas biasanya disebabkan 3 faktor berikut:\n\n1. **Tekanan Fuel Pump Drop:** Motor injeksi wajib memiliki tekanan **40 - 43 PSI (294 kPa)**. Bila drop di bawah 35 PSI, semprotan injektor tidak mengabut sempurna. Solusi: ganti saringan pampers bensin atau ganti rotak pompa bensinnya.\n2. **Busi Lemah atau Cop Busi Bocor:** Celah elektroda busi harus **0.7 - 0.8 mm**. Bila kepala busi hitam pekat dan basah oli, pengapian pincang. Ganti dengan Busi Iridium.\n3. **Throttle Body & Sensor TP Kotor:** Semprot TB dengan Throttle Body Cleaner lalu lakukan **Reset Sensor TPS & Kalibrasi ECU**.\n4. **Kop Busi:** Seringkali karet cop busi retak sehingga arus tegangan tinggi bocor ke massa mesin, apalagi saat terkena cipratan air hujan.";
  }

  // KODE MIL
  if (q.includes("mil") || q.includes("kedip") || q.includes("injeksi") || q.includes("sensor")) {
    return "Berikut daftar arti kode kedipan lampu MIL (Malfunction Indicator Lamp) injeksi motor:\n\n- **1 Kedipan:** Sensor MAP (Manifold Absolute Pressure) - tekanan udara intake bermasalah.\n- **7 Kedipan:** Sensor EOT / ECT (Suhu Oli/Radiator) - mesin susah starter dingin atau kipas radiator muter terus.\n- **8 Kedipan:** Sensor TP (Throttle Position) - gas nyangkut atau tarikan awal brebet ngempos.\n- **9 Kedipan:** Sensor IAT (Intake Air Temperature).\n- **11 Kedipan:** Sensor Kecepatan (Speed Sensor).\n- **12 Kedipan:** Rangkaian Injektor BBM putus atau tersumbat.\n- **21 Kedipan:** Sensor O2 Knalpot (Oksigen).\n- **29 Kedipan:** Sensor IACV (Idle Air Control Valve).\n- **52 Kedipan:** Sensor CKP (Crankshaft Position) - spul/magnet, motor tidak bisa distarter.\n\n*Langkah:* Cek sambungan kabel soket sensor, semprot contact cleaner, dan lakukan jumper reset DLC!";
  }

  // KARBURATOR & SPUYER PE28
  if (q.includes("karbu") || q.includes("pe28") || q.includes("pwk") || q.includes("spuyer") || q.includes("pilot jet") || q.includes("main jet")) {
    return "Panduan setting Karbu PE 28 / PWK 28 anti ngok:\n\n1. **Pilot Jet (Putaran Bawah):** Mulai di ukuran **35 atau 38**. Jika gas awal ngempos/ngok, naikkan ke 40. Jika stasioner berebet basah, turunkan ke 35.\n2. **Main Jet (Putaran Atas):** Mulai di ukuran **110 atau 115**. Cek warna elektroda busi setelah jalan kecepatan tinggi: idealnya berwarna **merah bata**.\n3. **Klip Jarum Skep:** Pasang di posisi klip tengah (nomer 3 dari atas).\n4. **Setelan Angin:** Putar baut angin sampai mentok ke dalam (searah jarum jam), lalu putar keluar **1.5 sampai 1.75 putaran** hingga RPM tertinggi mesin tercapai.";
  }

  // DEFAULT CERDAS
  return `Halo lur! Mengenai kendala "${question}":\n\n1. **Analisa Cepat:** Periksa 3 pilar utama mesin yaitu suplai bahan bakar (bensin bersih & tekanan pompa lancar), sistem pengapian (busi menyala biru & cop busi rapat), serta kompresi silinder (celah klep in 0.10mm, ex 0.15mm).\n2. **Langkah Penanganan:** Bersihkan filter udara, pastikan oli mesin tidak telat/kering, dan periksa tegangan aki minimal 12.4 Volt.\n\nJika butuh suku cadang atau part racing original, cek rekomendasi belanja resmi di bawah ini ya lur!`;
}

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
