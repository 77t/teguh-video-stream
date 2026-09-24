import express from "express";
import path from "path";
import fs from "fs";
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

// Database Video Persistent & Cache Pintar
const VIDEO_STORE_PATH = path.join(process.cwd(), "public", "video_store.json");

interface StoredVideoItem {
  id: string;
  videoId: string;
  title: string;
  channel?: string;
  duration?: string;
  views?: string;
  thumbnail: string;
  embedUrl: string;
  queryTag?: string;
  savedAt: string;
}

function loadStoredVideoDatabase(): Record<string, StoredVideoItem> {
  try {
    if (fs.existsSync(VIDEO_STORE_PATH)) {
      const data = fs.readFileSync(VIDEO_STORE_PATH, "utf-8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.warn("Gagal membaca video_store.json:", e);
  }
  return {};
}

function saveVideoToDatabase(items: StoredVideoItem[]) {
  try {
    const currentDb = loadStoredVideoDatabase();
    let hasChanges = false;
    items.forEach((item) => {
      if (item && item.id && !currentDb[item.id]) {
        currentDb[item.id] = item;
        hasChanges = true;
      }
    });
    if (hasChanges) {
      fs.writeFileSync(VIDEO_STORE_PATH, JSON.stringify(currentDb, null, 2), "utf-8");
    }
  } catch (e) {
    console.warn("Gagal menyimpan ke video_store.json:", e);
  }
}

// Helper Pencarian YouTube Real-Time & Ekstraksi Data Kaya
async function searchYouTubeLive(q: string): Promise<StoredVideoItem[]> {
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
    const ytRes = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
      },
    });
    const html = await ytRes.text();
    const idx = html.indexOf("ytInitialData = ");
    const results: StoredVideoItem[] = [];
    if (idx > -1) {
      const jsonStr = html.substring(idx + 16, html.indexOf(";</script>", idx));
      const data = JSON.parse(jsonStr);
      const sections = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
      for (const sec of sections) {
        const contents = sec.itemSectionRenderer?.contents || [];
        for (const c of contents) {
          if (c.videoRenderer) {
            const vr = c.videoRenderer;
            const vidId = vr.videoId;
            if (!vidId) continue;
            results.push({
              id: vidId,
              videoId: vidId,
              title: vr.title?.runs?.[0]?.text || "Video YouTube",
              channel: vr.ownerText?.runs?.[0]?.text || vr.shortBylineText?.runs?.[0]?.text || "YouTube",
              duration: vr.lengthText?.simpleText || "HD",
              views: vr.viewCountText?.simpleText || "100K+ tayangan",
              thumbnail: vr.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`,
              embedUrl: `https://www.youtube-nocookie.com/embed/${vidId}?autoplay=1&rel=0`,
              queryTag: q,
              savedAt: new Date().toISOString()
            });
          }
        }
      }
    }
    return results;
  } catch (err: any) {
    console.error("Gagal search YouTube live:", err?.message || err);
    return [];
  }
}

// Endpoint Pencarian Video Multi-Kueri (Bon Jovi, Bollywood, Tilawah, Balap, dll)
app.get("/api/youtube-search", async (req, res) => {
  try {
    const q = req.query.q as string;
    if (!q || !q.trim()) {
      res.status(400).json({ error: "Query pencarian wajib diisi" });
      return;
    }
    const cleanQ = q.trim();
    const cleanQLower = cleanQ.toLowerCase();

    // 1. Cek basis data lokal video_store.json terlebih dahulu
    const storedDb = loadStoredVideoDatabase();
    const localMatches: StoredVideoItem[] = Object.values(storedDb).filter((item) => {
      return (
        item.title.toLowerCase().includes(cleanQLower) ||
        (item.queryTag && item.queryTag.toLowerCase().includes(cleanQLower)) ||
        (item.channel && item.channel.toLowerCase().includes(cleanQLower))
      );
    });

    if (localMatches.length >= 6) {
      res.json({ results: localMatches.slice(0, 20), source: "database", total: localMatches.length });
      return;
    }

    // 2. Jika di database belum banyak atau baru, ambil langsung dari YouTube secara live
    const liveResults = await searchYouTubeLive(cleanQ);

    if (liveResults.length > 0) {
      // Otomatis rekam ke database persistent JSON (arsip permanen mirip Supabase)
      saveVideoToDatabase(liveResults);

      // Gabungkan hasil lokal dan live tanpa duplikat
      const combinedMap = new Map<string, StoredVideoItem>();
      liveResults.forEach((it) => combinedMap.set(it.id, it));
      localMatches.forEach((it) => {
        if (!combinedMap.has(it.id)) combinedMap.set(it.id, it);
      });

      res.json({ results: Array.from(combinedMap.values()).slice(0, 24), source: "live", total: combinedMap.size });
      return;
    }

    res.json({ results: localMatches, source: "database", total: localMatches.length });
  } catch (err: any) {
    console.error("Error in /api/youtube-search:", err?.message || err);
    res.status(500).json({ error: "Gagal memproses pencarian video" });
  }
});

// Endpoint Resolusi Video Tunggal
app.get("/api/youtube-resolve", async (req, res) => {
  try {
    const q = req.query.q as string;
    if (!q || !q.trim()) {
      res.status(400).json({ error: "Query pencarian wajib diisi" });
      return;
    }
    const cleanQ = q.trim();

    // Cek di database tersimpan
    const storedDb = loadStoredVideoDatabase();
    const found = Object.values(storedDb).find((it) => it.title.toLowerCase().includes(cleanQ.toLowerCase()));
    if (found) {
      res.json({ videoId: found.videoId, embedUrl: found.embedUrl, source: "database" });
      return;
    }

    const liveItems = await searchYouTubeLive(cleanQ);
    if (liveItems.length > 0) {
      const top = liveItems[0];
      saveVideoToDatabase(liveItems);
      res.json({ videoId: top.videoId, embedUrl: top.embedUrl, source: "live" });
      return;
    }

    res.json({ videoId: "m8GNURb41mI", embedUrl: "https://www.youtube-nocookie.com/embed/m8GNURb41mI?autoplay=1&rel=0", source: "fallback" });
  } catch (err: any) {
    console.error("Error in /api/youtube-resolve:", err?.message || err);
    res.status(500).json({ error: "Gagal mencari video YouTube" });
  }
});

// Endpoint Asisten AI Montir & Sahabat Santri 24 Jam
app.post("/api/montir-ai", async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message || typeof message !== "string" || !message.trim()) {
      res.status(400).json({ error: "Pesan pertanyaan tidak boleh kosong" });
      return;
    }

    const systemInstruction = `Anda adalah "Kang Teguh AI", montir senior bengkel motor profesional & sahabat santri Indonesia yang sangat ramah, santun, teknis, dan presisi.

ATURAN UTAMA:
1. WAJIB MENJAWAB SECARA LANGSUNG & RELEVAN SESUAI MATERI YANG DITANYAKAN PENGGUNA. Jika pengguna tanya oli, jawab spesifikasi oli & kapasitasnya. Jika tanya aki, jawab soal aki & voltase. Jika tanya bunyi kletek-kletek, analisa komponen mesin penyebab suara tersebut. JANGAN PERNAH memberikan jawaban di luar topik!
2. Jika pengguna menyebut tipe motor spesifik (misal: Beat, Vario, Nmax, Aerox, Scoopy, Satria FU, Ninja 150/250, RX King, Jupiter Z, Supra, Mio, dll.), berikan data teknis akurat motor tersebut (kapasitas oli, berat roller, ukuran spuyer, celah klep, atau kode part).
3. Jika ditanya ukuran roller matic, sebutkan berat gram standar dan racikan harian responsif.
4. Jika ditanya setting karbu / spuyer (PE28/PWK/Standar), sebutkan rekomendasi ukuran Pilot Jet (PJ) & Main Jet (MJ) serta putaran baut angin.
5. Jika ditanya CVT gredek / getar, paparkan solusi mangkok kartel bolong, amplas silang kampas ganda, dan kebersihan seal kruk as kiri.
6. Jika ditanya motor brebet / hilang tenaga, jelaskan analisa tekanan fuel pump (standar 40-43 psi), busi/cop busi bocor, dan pembersihan throttle body / filter bensin.
7. Jika ditanya kode kedipan MIL injeksi, terjemahkan jumlah kedipan sensor (1=MAP, 7=EOT/ECT, 8=TP, 9=IAT, 12=Injektor, 21=O2, 52=CKP).
8. Jika ditanya doa santri atau keselamatan berkendara, berikan lafadz Arab, latin, terjemahan, dan adab safar.
9. Sebutkan suku cadang/part relevan secara spesifik (misal: "Busi Iridium Daytona", "Roller Kawahara 13g", "Filter Pampers Bensin", "Oli Motul Scooter Expert", dll.).
10. Gunakan gaya bahasa khas montir & santri yang akrab, hangat, dan solutif: "Assalamu'alaikum lur / mas!", "Siap lur, ini solusinya:".`;

    let reply = "";
    // Urutan model Gemini resmi dengan cascade otomatis jika salah satu model mengalami antrean/spike
    const modelsToTry = [
      "gemini-3.8-flash",
      "gemini-3.1-flash-lite",
      "gemini-flash-latest",
    ];

    let contents: any = message.trim();
    if (Array.isArray(history) && history.length > 0) {
      const formattedHistory = history
        .filter((h: any) => h && typeof h.text === "string" && h.text.trim())
        .slice(-6)
        .map((h: any) => ({
          role: h.sender === "user" ? "user" : "model",
          parts: [{ text: h.text.trim() }]
        }));
      formattedHistory.push({
        role: "user",
        parts: [{ text: message.trim() }]
      });
      contents = formattedHistory;
    }

    for (const m of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: m,
          contents,
          config: {
            systemInstruction,
            temperature: 0.6,
          },
        });
        if (response.text && response.text.trim()) {
          reply = response.text.trim();
          break;
        }
      } catch (geminiErr: any) {
        // Jika model sedang sibuk (503 / 429), lanjutkan secara halus ke model berikutnya tanpa melempar fatal exception
        const isTemporaryBusy = geminiErr?.status === 503 || geminiErr?.status === 429 || 
          (typeof geminiErr?.message === "string" && (geminiErr.message.includes("503") || geminiErr.message.includes("demand") || geminiErr.message.includes("UNAVAILABLE")));
        if (!isTemporaryBusy) {
          // Hanya catat isu non-kapasitas untuk pemantauan internal
          console.info(`Model ${m} switched to next fallback candidate.`);
        }
      }
    }

    if (!reply) {
      // Fallback lokal cerdas presisi jika semua koneksi AI sedang antre
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

  // 1. OLI & PELUMAS MESIN
  if (q.includes("oli") || q.includes("pelumas") || q.includes("sae") || q.includes("oli samping") || q.includes("oli gardan")) {
    if (q.includes("gardan") || q.includes("gear")) {
      return "Assalamu'alaikum lur! Mengenai oli gardan/transmisi motor matic:\n\n1. **Kapasitas Standar:**\n- Honda Beat, Scoopy, Genio, Vario 125/150: **120 ml**.\n- Yamaha Nmax, Aerox, Lexi: **140 ml** (saat kuras berkala).\n- Yamaha Mio Sporty/M3: **100 ml**.\n2. **Kekentalan:** Gunakan SAE 80W-90 atau 10W-30 khusus gear matic.\n3. **Jadwal Ganti:** Setiap **2 kali ganti oli mesin**, ganti oli gardan 1 kali (sekitar 6.000 - 8.000 km). Jika oli gardan berubah warna seperti susu kental manis, itu tanda air banjir/cuci steam masuk dari selang hawa gardan!";
    }
    if (q.includes("samping") || q.includes("2t") || q.includes("rx king") || q.includes("ninja r") || q.includes("satria 2 tak") || q.includes("f1zr")) {
      return "Siap lur! Untuk motor 2-Tak (RX King, Ninja 150 R/RR, Satria Hiu, F1ZR):\n\n1. **Rekomendasi Oli Samping (2T):**\n- Standar Harian: **Castrol Power 1 2T Low Smoke** atau **Idemitsu 2T Semi-Synthetic**.\n- Spek Kencang / Balap: **Motul 800 2T Factory Line** atau **Motul 710 2T Ester** (aroma wangi, minim kerak di kubah head).\n2. **Setelan Pompa Oli Samping:** Pastikan garis tanda pada pulley pompa oli sejajar saat gas dibuka penuh. Jangan terlalu irit agar piston dan dinding buring silinder tidak macet/baret!\n3. **Oli Mesin / Transmisi 2T:** Gunakan kapasitas 0.8L - 0.9L SAE 10W-40 atau 20W-50 khusus kopling basah (JASO MA).";
    }
    // Oli Mesin 4-Tak
    let motorSpec = "Gunakan oli viskositas SAE 10W-30 (Honda) atau 10W-40 (Yamaha/Suzuki) dengan sertifikasi JASO MB untuk matic dan JASO MA untuk bebek/sport.";
    if (q.includes("beat") || q.includes("scoopy") || q.includes("genio")) {
      motorSpec = "Untuk Honda Beat/Scoopy/Genio: Kapasitas **0.65 Liter** (mesin eSP Genio/Beat 2020 ke atas) atau **0.8 Liter** (Beat Fi/eSP lama). Viskositas ideal **SAE 10W-30 JASO MB** (Contoh: AHM Oil MPX2 / SPX2, Motul Scooter Expert LE, atau Shell Advance AX7 Matic).";
    } else if (q.includes("nmax") || q.includes("aerox") || q.includes("lexi")) {
      motorSpec = "Untuk Yamaha Nmax / Aerox 155: Kapasitas **0.9 Liter** (ganti berkala) atau **1.0 Liter** (ganti filter oli). Viskositas ideal **SAE 10W-40 JASO MB** (Contoh: Yamalube Super Matic, Motul Scooter Power LE Full Synthetic, atau Shell Advance Ultra Matic).";
    } else if (q.includes("vario")) {
      motorSpec = "Untuk Honda Vario 125 / 150 / 160: Kapasitas **0.8 Liter** (Vario 125/150) atau **0.85 Liter** (Vario 160). Gunakan **SAE 10W-30 JASO MB** sintetis agar mesin tetap adem di kemacetan.";
    } else if (q.includes("satria") || q.includes("fu")) {
      motorSpec = "Untuk Suzuki Satria FU 150: Kapasitas **1.0 Liter** (ganti biasa) atau **1.2 Liter** (saat ganti filter oli). Wajib gunakan **JASO MA/MA2 SAE 10W-40** (jangan pakai oli matic JASO MB karena kopling akan selip).";
    }
    return `Assalamu'alaikum lur! Panduan spesifikasi oli mesin terbaik:\n\n1. **Spesifikasi & Kapasitas:**\n${motorSpec}\n\n2. **Tips Bengkel:** Ganti oli rutin setiap **2.000 - 2.500 km**. Jangan biarkan oli berkurang melewati batas bawah dipstick colokan oli untuk mencegah noken as dan stang seher aus tergores.`;
  }

  // 2. AKI / BATERAI / TEKOR / KELISTRIKAN
  if (q.includes("aki") || q.includes("accu") || q.includes("tekor") || q.includes("starter tak mau") || q.includes("stater") || q.includes("voltase") || q.includes("kiprok") || q.includes("spul")) {
    return "Assalamu'alaikum lur! Masalah aki tekor atau starter motor cetek-cetek analisa bengkelnya:\n\n1. **Cek Voltase Aki (Multitester):**\n- Kondisi Mesin Mati: Minimal **12.4 - 12.8 Volt** (di bawah 12.0 Volt berarti aki drop/soak).\n- Saat Mesin Nyala (RPM 3000): Harus berada di kisaran **13.8 - 14.5 Volt** (menandakan pengisian kiprok/spul normal).\n2. **Penyebab Sering Tekor:**\n- **Kebocoran Arus (Dark Current):** Ada aksesoris lampu tembak, klakson keong tanpa relay, atau alarm yang memakan arus saat kontak OFF.\n- **Kiprok / Regulator Lemah:** Arus pengisian dari spul tidak masuk mengisi aki, atau overcharge (tegangan tembus di atas 15 Volt bikin aki kembung).\n- **Spul Pengisian Terbakar/Gosong:** Spul stator leleh karena panas dan usia.\n3. **Solusi:** Bersihkan kutub terminal aki dari jamur putih menggunakan air panas, kencangkan baut massa bodi, dan cas aki lambat (slow charging) selama 4-6 jam.";
  }

  // 3. SUARA KASAR / KLETEK-KLETEK / TIK-TIK DI HEAD MESIN
  if (q.includes("kletek") || q.includes("tik tik") || q.includes("kasar") || q.includes("noken as") || q.includes("keteng") || q.includes("kamrat") || q.includes("klep kendor")) {
    return "Siap lur! Suara kasar kletek-kletek atau tik-tik di bagian kepala silinder umumnya bersumber dari 3 hal:\n\n1. **Rantai Keteng (Kamrat) Kendur:** Tensioner lidah keteng sudah aus atau tonjokan stelan otomatisnya (lifter tensioner) sudah loyo. Bila gas diurut suara kemricik keras, ganti rantai keteng beserta tensionernya.\n2. **Celah Klep Renggang:** Celah antara pelatuk (rocker arm) dan batang klep melebihi standar pabrik. Solusi: setel ulang celah klep menggunakan fuller gauge (In: 0.10 - 0.12 mm, Ex: 0.14 - 0.16 mm).\n3. **Noken As (Camshaft) atau Pelatuk Tergerus:** Jika telat ganti oli, bearing noken as oblak atau bantalan bumbungan noken as aus memicu bunyi ketukan keras di RPM tengah.\n\n*Langkah Montir:* Buka tutup klep, cek kerenggangan pelatuk dan periksa tekanan semprotan oli ke silinder head apakah lancar.";
  }

  // 4. SUSPENSI / SHOCKBREAKER JEDUG / BOCOR
  if (q.includes("shock") || q.includes("jedug") || q.includes("bocor") || q.includes("suspensi") || q.includes("amblas")) {
    return "Assalamu'alaikum lur! Solusi shockbreaker depan jedug keras atau bocor oli:\n\n1. **Penyebab Bunyi Jedug:** Oli shock di dalam tabung sudah berkurang drastis, kualitas oli shock sudah encer seperti air kotor, atau per shock depan sudah lemas/patah.\n2. **Kapasitas Oli Shock Depan Standar:**\n- Honda Beat, Scoopy: **62 ml** per tabung.\n- Honda Vario 125/150: **65 - 70 ml** per tabung.\n- Yamaha Mio: **55 - 58 ml** per tabung.\n- Yamaha Nmax: **85 - 90 ml** per tabung.\n3. **Perbaikan Tuntas:**\n- Kuras tabung shock dengan bensin sampai bersih dari gram pasir.\n- Ganti **Sil Shock Depan Original** (pastikan as shock tidak baret, jika as shock baret wajib diganti agar sil baru tidak langsung sobek).\n- Isi oli shock hidrolik khusus (misal: Jumbo Fork Oil atau Pertamina Fork Oil) dan pasang sil debu pelindung bagian luar.";
  }

  // 5. REM BLONG / KAMPAS REM / MINYAK REM
  if (q.includes("rem") || q.includes("cakram") || q.includes("tromol") || q.includes("blong") || q.includes("bagel") || q.includes("minyak rem")) {
    return "Siap lur! Sistem pengereman menyangkut keselamatan nyawa santri & pengendara:\n\n1. **Rem Handle Bagel / Dalam (Blong):** Tanda ada gelembung udara (masuk angin) pada selang hidrolik atau piston master rem atas sudah aus (seal master rem sobek).\n2. **Cara Bleeding Minyak Rem:**\n- Buka nepel buang angin di kaliper bawah menggunakan kunci ring 8mm.\n- Pasang selang bening, pompa handle rem 5 kali lalu tahan handle sambil buka-tutup nepel secara berulang sampai minyak rem keluar padat tanpa gelembung udara.\n3. **Minyak Rem Standar:** Gunakan **DOT 3 atau DOT 4** asli. Kuras minyak rem setiap 20.000 km karena minyak rem bersifat higroskopis (menyerap air kelembaban).\n4. **Cek Ketebalan Kampas:** Jika sisa kampas di bawah 1.5mm atau piringan cakram mulai berdecit tajam, segera ganti dengan Kampas Rem Daytona / Bendix agar cakram tidak kemakan.";
  }

  // 6. RADIATOR / OVERHEAT / AIR COOLANT
  if (q.includes("radiator") || q.includes("coolant") || q.includes("overheat") || q.includes("panas") || q.includes("suhu tinggi") || q.includes("water pump")) {
    return "Assalamu'alaikum lur! Masalah mesin cepat panas (overheat) atau lampu indikator temperatur merah menyala:\n\n1. **Penyebab Utama:**\n- Air radiator (coolant) di tabung reservoir habis atau tersumbat kerak.\n- **Kipas Radiator Mati:** Motor matic pendingin cairan (Vario/Nmax/Aerox) punya thermostat dan kipas elektrik, jika sensor ECT rusak kipas tidak mau berputar.\n- **Sil Water Pump Jebol:** Tanda khasnya air radiator berkurang cepat dan saat buang oli mesin warnanya keruh seperti kopi susu!\n2. **Solusi Bengkel:**\n- Jangan pernah mengisi radiator dengan air keran karena memicu karat dan penyumbatan kisi-kisi honeycomb.\n- Gunakan **Radiator Coolant Pre-mix** yang mengandung anti-rust & ethylene glycol.\n- Bleeding udara sistem radiator dengan membuka baut bleed udara di blok silinder saat mesin stasioner.";
  }

  // 7. HILANG KOMPRESI / LOSS COMPRESSION
  if (q.includes("kompresi") || q.includes("engkol ngelos") || q.includes("loss") || q.includes("slah enteng") || q.includes("tidak ada tahanan")) {
    return "Siap lur! Gejala hilang kompresi (kick starter diengkol terasa ngelos enteng tanpa tahanan) sangat sering terjadi di motor matic:\n\n1. **Penyebab:** Kerak sisa pembakaran karbon mengganjal di payung klep (klep tidak bisa menutup rapat ke sitting klep), atau ring piston macet di parit seher.\n2. **Trik Bengkel Darurat 5 Menit:**\n- Buka busi motor.\n- Masukkan oli mesin baru sebanyak **2 sampai 3 sendok makan (sekitar 10-15 ml)** ke dalam lubang busi menggunakan suntikan atau selang kecil.\n- Tutup lubang busi dengan jempol tangan, lalu engkol kick starter berkali-kali sampai oli membasahi dinding silinder dan jempol terasa terdorong tekanan kompresi kuat.\n- Pasang busi kembali, lalu starter sambil gas dibuka penuh. Mesin akan langsung hidup dengan sedikit asap putih (oli terbakar), setelah itu mesin normal kembali!";
  }

  // 8. RANTAI & GIR MOTOR BEBEK / SPORT
  if (q.includes("rantai") || q.includes("gear") || q.includes("gir") || q.includes("kemrosak") || q.includes("kendur")) {
    return "Assalamu'alaikum lur! Perawatan rantai roda motor:\n\n1. **Batas Kekenduran:** Jarak ayunan rantai yang ideal adalah **2.0 - 3.0 cm**.\n2. **Rantai Bunyi Kemrosak / Loncat:** Tanda gir depan dan gir belakang sudah lancip/runcing seperti mata gergaji. Wajib ganti satu set rantai + gir depan-belakang bersamaan!\n3. **Perawatan Rantai:** Bersihkan rantai dengan sikat dan minyak tanah/degreaser, lalu lumasi dengan **Chain Lube Khusus**. Jangan pakai oli bekas karena oli bekas mengandung gram besi yang mempercepat keausan rantai O-Ring!";
  }

  // 9. ROLLER & RACIKAN CVT
  if (q.includes("roller") || q.includes("berat roller") || q.includes("gram") || q.includes("per cvt")) {
    let standard = "Standar motor matic umumnya antara 11 - 15 gram.";
    let racikan = "Turunkan 1 - 2 gram dari standar jika ingin tarikan bawah responsif dan nanjak enteng.";

    if (q.includes("beat esp") || q.includes("beat fi") || q.includes("scoopy") || q.includes("genio")) {
      standard = "Standar Honda Beat eSP / Scoopy eSP (K81/K44) adalah **15 gram** (total 90g). Beat FI starter kasar (K25) adalah **13 gram**. Beat New Deluxe eSP K1A adalah **15 gram**.";
      racikan = "Untuk harian gesit: pakai **12 atau 13 gram rata**, atau silang **3x12g + 3x14g** dipadu per CVT 1000 RPM!";
    } else if (q.includes("vario 125")) {
      standard = "Standar Honda Vario 125 adalah **18 gram**.";
      racikan = "Untuk perkotaan lincah & tanjakan: turunkan ke **14 atau 15 gram rata**.";
    } else if (q.includes("vario 150") || q.includes("vario 160") || q.includes("pcx")) {
      standard = "Standar Vario 150 (15.5g), Vario 160 (19g), PCX 160 (19g).";
      racikan = "Rekomendasi harian: gunakan **14 atau 15 gram rata** agar akselerasi stop-and-go responsif.";
    } else if (q.includes("nmax") || q.includes("aerox")) {
      standard = "Standar Yamaha NMAX 155 adalah **13 gram**, Aerox 155 Connected **12.5 - 13 gram**.";
      racikan = "Rekomendasi touring nanjak: pakai **10 atau 11 gram rata** dipadu per CVT 1500 RPM PCX Thailand.";
    } else if (q.includes("mio")) {
      standard = "Standar Yamaha Mio Sporty/Smile **10.5 gram**, Mio J/Soul GT **9.5 gram**, Mio M3 125 **12 gram**.";
      racikan = "Rekomendasi: pakai **8 gram untuk Mio Karbu** atau **10 gram untuk Mio M3**.";
    }

    return `Siap lur! Mengenai ukuran berat roller:\n\n1. **Ukuran Standar Pabrik:**\n${standard}\n\n2. **Rekomendasi Racikan Harian:**\n${racikan}\n\n*Tips Bengkel:* Jangan silang roller lebih dari selisih 2 gram (misal 10g dengan 15g jangan!) karena puli depan akan berputar tidak seimbang dan rumah roller cepat aus/oblak.`;
  }

  // 10. CVT GREDEK / GETAR
  if (q.includes("gredek") || q.includes("getar") || q.includes("cvt") || q.includes("kampas ganda") || q.includes("mangkok")) {
    return "Assalamu'alaikum lur! Penyakit CVT gredek/getar di RPM rendah (kecepatan 0-20 km/jam) solusinya sebagai berikut:\n\n1. **Penyebab Utama:** Debu kampas ganda menumpuk di dinding dalam mangkok kopling, atau ada kebocoran sil kruk as sebelah kiri sehingga oli membasahi kampas.\n2. **Solusi Bengkel Tuntas:**\n- Amplas permukaan sepatu kampas ganda menggunakan amplas no. 120 secara menyilang (cross).\n- Bersihkan mangkok kopling dengan bensin/degreaser sampai kesat.\n- Pakai **Mangkok Kopling Custom Berlubang (Kartel)** agar debu kampas otomatis terlempar keluar.\n- Periksa karet dumper kampas ganda, jika sudah keras/peyang segera ganti baru.\n3. **Cek V-Belt & Slider:** Pastikan v-belt belum retak-retak dan piece slide (karet slider rumah roller) tidak oblak.";
  }

  // 11. BREBET / GAS KOSONG / INJEKSI
  if (q.includes("brebet") || q.includes("gas kosong") || q.includes("tersendat") || q.includes("nembak") || q.includes("ngempos")) {
    return "Siap lur! Motor brebet saat ditarik gas biasanya disebabkan 4 faktor berikut:\n\n1. **Tekanan Fuel Pump Drop:** Motor injeksi wajib memiliki tekanan **40 - 43 PSI (294 kPa)**. Bila drop di bawah 35 PSI, semprotan injektor tidak mengabut sempurna. Solusi: ganti saringan pampers bensin atau ganti rotak pompa bensinnya.\n2. **Busi Lemah atau Cop Busi Bocor:** Celah elektroda busi harus **0.7 - 0.8 mm**. Bila kepala busi hitam pekat dan basah oli, pengapian pincang. Ganti dengan Busi Iridium.\n3. **Throttle Body & Sensor TP Kotor:** Semprot TB dengan Throttle Body Cleaner lalu lakukan **Reset Sensor TPS & Kalibrasi ECU**.\n4. **Kop Busi Bocor:** Karet cop busi getas memicu kebocoran arus tegangan tinggi ke rangka mesin saat kena air hujan.";
  }

  // 12. KODE MIL INJEKSI
  if (q.includes("mil") || q.includes("kedip") || q.includes("sensor ckp") || q.includes("sensor tps")) {
    return "Berikut daftar arti kode kedipan lampu MIL (Check Engine) injeksi Honda/Yamaha:\n\n- **1 Kedipan:** Sensor MAP (Manifold Absolute Pressure).\n- **7 Kedipan:** Sensor EOT / ECT (Suhu Mesin/Radiator) - mesin susah start dingin.\n- **8 Kedipan:** Sensor TP (Throttle Position) - gas nyangkut atau brebet ngempos.\n- **9 Kedipan:** Sensor IAT (Intake Air Temperature).\n- **11 Kedipan:** Sensor Kecepatan (Speed Sensor).\n- **12 Kedipan:** Rangkaian Injektor BBM putus atau tersumbat.\n- **21 Kedipan:** Sensor O2 Knalpot (Oksigen).\n- **29 Kedipan:** Sensor IACV (Idle Air Control Valve).\n- **52 Kedipan:** Sensor CKP (Crankshaft Position) - spul magnet kruk as, motor mati total.\n\n*Langkah:* Bersihkan soket dengan contact cleaner dan lakukan jumper reset DLC!";
  }

  // 13. KARBURATOR PE 28 / PWK / SPUYER
  if (q.includes("karbu") || q.includes("pe28") || q.includes("pwk") || q.includes("spuyer") || q.includes("pilot jet") || q.includes("main jet") || q.includes("jetting")) {
    return "Panduan setting Karbu PE 28 / PWK 28 anti ngok:\n\n1. **Pilot Jet (Putaran Bawah):** Mulai di ukuran **35 atau 38**. Jika gas awal ngempos/ngok, naikkan ke 40. Jika stasioner berebet basah, turunkan ke 35.\n2. **Main Jet (Putaran Atas):** Mulai di ukuran **110 atau 115**. Cek warna elektroda busi setelah jalan kecepatan tinggi: idealnya berwarna **merah bata**.\n3. **Klip Jarum Skep:** Pasang di posisi klip tengah (nomer 3 dari atas).\n4. **Setelan Angin:** Putar baut angin sampai mentok ke dalam (searah jarum jam), lalu putar keluar **1.5 sampai 1.75 putaran** hingga RPM tertinggi mesin tercapai.";
  }

  // 14. MOTOR 2-TAK / NINJA / RX KING
  if (q.includes("rx king") || q.includes("ninja 150") || q.includes("ninja r") || q.includes("ninja ss") || q.includes("2 tak") || q.includes("knalpot udang")) {
    return "Siap lur! Untuk legenda 2-Tak (RX King / Ninja 150 R-SS-RR):\n\n1. **Knalpot Udang & Kolong:** Settingan karbu wajib disesuaikan (naikkan Main Jet 1-2 step) agar mesin tidak kekeringan (dry seizure).\n2. **Cek Membran / Reed Valve:** Pastikan lidah membran menutup rapat tidak mangap. Jika lidah karbon sompal, bensin akan balik menyembur ke karbu dan motor susah hidup.\n3. **KIPS (Kawasaki Integrated Powervalve System):** Pada Ninja 150, bersihkan mekanisme katup Super KIPS dari kerak oli setiap 5.000 km agar tidak macet di putaran 7.000 RPM ke atas.";
  }

  // 15. DOA, SAFAR & SANTRI
  if (q.includes("doa") || q.includes("safar") || q.includes("santri") || q.includes("selamat") || q.includes("musibah") || q.includes("bocor")) {
    if (q.includes("musibah") || q.includes("bocor") || q.includes("mogok")) {
      return "Assalamu'alaikum lur. Sabar ya, ujian di jalan insyaAllah menggugurkan dosa. Ketika tertimpa musibah ban bocor atau mogok, Rasulullah SAW mengajarkan doa:\n\n*Innaa lillaahi wa innaa ilaihi rooji'uun, allaahumma'jurnii fii mushiibatii wa akhlif lii khoiron minhaa.*\n\nArtinya: 'Sesungguhnya kami milik Allah dan kepada-Nya kami kembali. Ya Allah berilah pahala atas musibahku ini dan gantikanlah dengan yang lebih baik.'\n\nTetap tenang lur, dorong motor pelan-pelan ke tambal ban terdekat. Semoga dimudahkan urusannya!";
    }
    return "Assalamu'alaikum wr wb lur! Mari amalkan doa safar sebelum memutar gas motor:\n\n*Subhaanalladzii sakh-khara lanaa haadzaa wamaa kunnaa lahu muqriniin, wa innaa ilaa robbinaa lamunqolibuun.*\n\nArtinya: 'Maha Suci Allah yang telah menundukkan semua ini bagi kami padahal sebelumnya kami tidak mampu menguasainya, dan sesungguhnya kami akan kembali kepada Tuhan kami.' (HR. Muslim)\n\nNiatkan mencari nafkah halal, jaga adab berkendara, kenakan helm SNI & cek lampu serta rem motor!";
  }

  // 16. KONSULTASI UMUM SESUAI MATERI PERTANYAAN
  return `Assalamu'alaikum lur! Mengenai kendala seputar "${question}":\n\n1. **Analisa Teknis Montir:** Pastikan melakukan pemeriksaan pada 3 sistem vital kendaraan: sistem bahan bakar (kebersihan bensin & filter), sistem pengapian (kondisi busi & cop), serta sistem kelistrikan (aki minimal 12.4V).\n2. **Langkah Penanganan Pertama:** Periksa kondisi fisik part yang bersangkutan, bersihkan dari kerak/debu endapan, dan pastikan pelumasan oli mesin berada di takaran normal.\n\nJika butuh rekomendasi suku cadang original yang cocok untuk motor mas, tanyakan tipe motornya secara spesifik ya lur!`;
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
