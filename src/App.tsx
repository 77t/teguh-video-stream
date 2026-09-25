import React, { useState, useEffect, useRef } from 'react';

// Struktur Data Lokal untuk Video Store (Backup Offline)
interface VideoItem {
  id: string;
  title: string;
  category: 'servis' | 'upgrade' | 'tilawah';
  youtubeId: string;
}

interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
  hasShopee?: boolean;
}

// Data Video & Murottal Awal yang Aman & Bebas Error
const initialVideos: VideoItem[] = [
  { id: '1', title: 'Cara Servis Berkala Honda Beat FI', category: 'servis', youtubeId: 'dQw4w9WgXcQ' },
  { id: '2', title: 'Panduan Reset ECU Yamaha NMAX', category: 'servis', youtubeId: 'dQw4w9WgXcQ' },
  { id: '3', title: 'Simulasi Bore Up Harian 130cc Scoopy', category: 'upgrade', youtubeId: 'dQw4w9WgXcQ' },
  { id: '4', title: 'Murottal Per Kata - Juz 30 Mudah Diikuti', category: 'tilawah', youtubeId: 'dQw4w9WgXcQ' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('servis');
  const [chatInput, setChatInput] = useState<string>('');
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [autoSpeak, setAutoSpeak] = useState<boolean>(true); // Fitur Bicara Otomatis TTS
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [rollerWeight, setRollerWeight] = useState<number>(11);
  const [chatLogs, setChatLogs] = useState<ChatMessage[]>([
    {
      sender: 'bot',
      text: "Assalamu'alaikum lur! Saya Kang Teguh AI siap membantu analisa mesin motor Anda atau memutar tilawah. Ada fitur Suara Teks-to-Speech (TTS) otomatis agar Anda tak capek membaca. Silakan ketik kendala motor Anda!",
      hasShopee: true
    }
  ]);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLogs]);

  // Hentikan suara saat unmount atau window close
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // LOGIKA UTAMA: Anti-Suara Bertumpuk Saat Pindah Halaman/Tab
  const handleTabChange = (newTab: string) => {
    // 1. Hentikan paksa semua Web Speech API (Suara Robot Membaca)
    stopSpeaking();

    // 2. Refresh/Reset semua Video YouTube agar langsung MATI dan tidak bersuara di latar belakang
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach((iframe) => {
      const currentSrc = iframe.src;
      iframe.src = currentSrc;
    });

    // 3. Set Halaman Aktif Baru
    setActiveTab(newTab);
  };

  // Fungsi Berhenti Berbicara
  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  // Fungsi Fitur Suara Robot (Web Speech API Text-to-Speech) untuk Membaca Teks
  const speakText = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert('Fitur suara robot TTS tidak didukung di browser ini.');
      return;
    }

    // Bersihkan karakter markdown & format khusus
    const cleanText = text
      .replace(/[*#_~`]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[\n\r]+/g, '. ');

    window.speechSynthesis.cancel(); // Matikan suara sebelumnya

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'id-ID'; // Menggunakan aksen bahasa Indonesia
    utterance.rate = speechRate;
    utterance.pitch = 1.0;

    // Cari suara bahasa Indonesia jika tersedia
    const voices = window.speechSynthesis.getVoices();
    const idVoice = voices.find(v => v.lang.includes('id') || v.lang.includes('ID'));
    if (idVoice) {
      utterance.voice = idVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  // Simulasi Chat Bot Responsif Otomotif & Shopee Trigger
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = chatInput;
    setChatLogs(prev => [...prev, { sender: 'user', text: userMessage }]);
    setChatInput('');

    // AI menganalisis kata kunci otomotif
    setTimeout(() => {
      let botResponse = 'Siap lur! Mengenai keluhan tersebut, mohon periksa tekanan kompresi, busi, dan suplai bahan bakar. Bisa infokan tipe motor Honda atau Yamaha Anda?';
      let includeShopee = false;

      const lower = userMessage.toLowerCase();
      if (lower.includes('oli') || lower.includes('servis')) {
        botResponse = 'Rekomendasi Servis Rutin: Lakukan penggantian oli mesin setiap 2.000 KM dan bersihkan filter oli. Berikut oli original pilihan terbaik untuk motor Anda:';
        includeShopee = true;
      } else if (lower.includes('cvt') || lower.includes('roller') || lower.includes('gredek')) {
        botResponse = 'Analisa Upgrade Performa CVT: Untuk tarikan matic lebih enteng dan bebas gredek, bersihkan mangkok kopling dan gunakan roller kombinasi. Cek komponen upgrade Shopee terpilih di bawah ini:';
        includeShopee = true;
      } else if (lower.includes('brebet') || lower.includes('busi')) {
        botResponse = 'Analisa Motor Brebet: Periksa celah elektroda busi dan tekanan pompa bahan bakar fuel pump. Standar injeksi adalah 40 sampai 43 PSI. Gunakan busi iridium berkualitas berikut:';
        includeShopee = true;
      } else if (lower.includes('doa') || lower.includes('santri') || lower.includes('safar')) {
        botResponse = 'Doa Bepergian Naik Motor (Safar): Subhaanalladzii sakh-khara lanaa haadzaa wamaa kunnaa lahu muqriniin, wa innaa ilaa robbinaa lamunqolibuun. Semoga perjalanan selalu berkah dan selamat di jalan!';
      }

      setChatLogs(prev => [...prev, { sender: 'bot', text: botResponse, hasShopee: includeShopee }]);

      // FITUR BICARA OTOMATIS: Jika aktif, robot langsung membacakan teks balasan!
      if (autoSpeak) {
        speakText(botResponse);
      }
    }, 600);
  };

  return (
    <div style={styles.body}>
      {/* HEADER UTAMA PREMIUM CARBON RACING */}
      <header style={styles.header}>
        <div style={styles.headerBadge}>⚡ VERSI PRO MOTOR & SANTRI</div>
        <h1 style={styles.headerTitle}>TEGUH STREAM & TUNING PRO AI</h1>
        <p style={styles.headerSubtitle}>ASISTEN MONTIR CERDAS DENGAN SUARA TEKS-TO-SPEECH (TTS) 24 JAM</p>
      </header>

      {/* DYNAMIC NAVIGATION BAR (Gaya Navigasi OLX/YouTube/Shopee Luwes & Longgar) */}
      <nav style={styles.navBar}>
        <button 
          style={activeTab === 'servis' ? styles.navButtonActive : styles.navButton} 
          onClick={() => handleTabChange('servis')}
        >
          🔧 Panduan Servis Motor
        </button>
        <button 
          style={activeTab === 'upgrade' ? styles.navButtonActive : styles.navButton} 
          onClick={() => handleTabChange('upgrade')}
        >
          🚀 Kalkulator CVT Racing
        </button>
        <button 
          style={activeTab === 'tilawah' ? styles.navButtonActive : styles.navButton} 
          onClick={() => handleTabChange('tilawah')}
        >
          📖 Tilawah / Murottal Suara
        </button>
      </nav>

      {/* AREA KONTEN UTAMA DENGAN DYNAMIC PAGE SWITCHING */}
      <main style={styles.mainContent}>
        
        {/* TAB 1: MODE SERVIS MOTOR */}
        {activeTab === 'servis' && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Langkah Kerja Servis Berkala (Honda & Yamaha)</h2>
            <div style={styles.card}>
              <p style={styles.cardText}>
                <strong>Langkah 1:</strong> Bersihkan Filter Udara, Cek Kerenggangan Celah Busi (0.7-0.8 mm), dan Tekanan Fuel Pump minimal 40 PSI.
              </p>
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                <button 
                  style={styles.soundBtn} 
                  onClick={() => speakText('Langkah satu: Bersihkan Filter Udara, Cek Kerenggangan Celah Busi nol koma tujuh milimeter, dan Tekanan Fuel Pump minimal empat puluh PSI.')}
                >
                  🔊 Dengarkan Panduan Suara
                </button>
                {isSpeaking && (
                  <button style={styles.stopBtn} onClick={stopSpeaking}>
                    ⏹️ Hentikan Suara
                  </button>
                )}
              </div>
            </div>
            
            <div style={styles.card}>
              <p style={styles.cardText}>
                <strong>Langkah 2:</strong> Penggantian Oli Mesin dan Oli Gardan secara berkala untuk menjaga keausan gear box dan noken as.
              </p>
              <button 
                style={styles.soundBtn} 
                onClick={() => speakText('Langkah dua: Penggantian Oli Mesin dan Oli Gardan secara berkala untuk menjaga keausan gear box dan noken as.')}
              >
                🔊 Dengarkan Panduan Suara
              </button>
            </div>
          </section>
        )}

        {/* TAB 2: UPGRADE PERFORMA MATIC */}
        {activeTab === 'upgrade' && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Simulasi Racikan Kirian CVT & Bobot Roller</h2>
            <div style={styles.card}>
              <p style={styles.cardText}>Geser racikan komponen untuk melihat prediksi peningkatan torsi mekanik:</p>
              <div style={{ margin: '15px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ color: '#00f0ff', fontWeight: 800 }}>Ukuran Roller: {rollerWeight} Gram</label>
                  <span style={{ color: '#f59e0b', fontSize: '12px' }}>
                    {rollerWeight < 11 ? '⚡ Fokus Akselerasi / Stop & Go' : rollerWeight > 12 ? '🏎️ Fokus Top Speed / Trek Panjang' : '⚖️ Seimbang Harian'}
                  </span>
                </div>
                <input 
                  type="range" 
                  min="7" 
                  max="15" 
                  value={rollerWeight} 
                  onChange={(e) => setRollerWeight(Number(e.target.value))} 
                  style={{ width: '100%', accentColor: '#00f0ff', cursor: 'pointer' }} 
                />
              </div>
              <button 
                style={styles.soundBtn} 
                onClick={() => speakText(`Analisa roller ${rollerWeight} gram. ${rollerWeight < 11 ? 'Cocok untuk tarikan awal responsif dan tanjakan curam.' : 'Cocok untuk napas panjang di jalan datar dan irit BBM.'}`)}
              >
                🔊 Dengar Analisa Suara
              </button>
            </div>
          </section>
        )}

        {/* TAB 3: TILAWAH / MUROTTAL AUDIO PLAYER */}
        {activeTab === 'tilawah' && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Aplikasi Tilawah Belajar Al-Quran Santri & Lansia</h2>
            <div style={styles.card}>
              <p style={styles.cardText}><strong>Surah Al-Baqarah (Metode Pembacaan Bersuara Jernih)</strong></p>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: '8px 0' }}>
                "Alif Laam Myeem. Dzaalikal kitaabu laa roiba feeh. Hudal lil muttaqeen."
              </p>
              <div style={styles.murottalPlayer}>
                <button 
                  style={styles.audioActionBtn} 
                  onClick={() => speakText('Alif Laam Myeem. Dzaalikal kitaabu laa roiba feeh. Hudal lil muttaqeen. Kitab Al Quran ini tidak ada keraguan padanya; petunjuk bagi mereka yang bertakwa.')}
                >
                  ▶️ Putar Suara & Arti
                </button>
                <button 
                  style={styles.audioActionBtn} 
                  onClick={stopSpeaking}
                >
                  ⏹️ Stop Suara
                </button>
              </div>
            </div>
          </section>
        )}

        {/* INTEGRASI TCHAT & BOT MEKANIK CERDAS: KANG TEGUH AI */}
        <section style={styles.chatSection}>
          <div style={styles.chatHeaderBox}>
            <div>
              <h3 style={styles.chatTitle}>🤖 Kang Teguh AI: Asisten Montir & Santri</h3>
              <p style={styles.chatDesc}>Dilengkapi fitur Bicara Teks-to-Speech (TTS) agar Anda tidak lelah membaca!</p>
            </div>
            
            {/* KONTROL FITUR SUARA (TTS) */}
            <div style={styles.ttsControlGroup}>
              <button 
                type="button" 
                onClick={() => setAutoSpeak(!autoSpeak)}
                style={autoSpeak ? styles.autoSpeakBtnActive : styles.autoSpeakBtn}
                title="Bicara otomatis setiap ada jawaban"
              >
                {autoSpeak ? '🔊 Bicara Otomatis: AKTIF' : '🔈 Bicara Otomatis: MATI'}
              </button>
              {isSpeaking && (
                <button 
                  type="button" 
                  onClick={stopSpeaking}
                  style={styles.stopGlobalBtn}
                  title="Hentikan suara yang sedang membaca"
                >
                  ⏹️ Diam / Stop Suara
                </button>
              )}
            </div>
          </div>

          {/* KOTAK OBROLAN */}
          <div style={styles.chatBox}>
            {chatLogs.map((log, index) => (
              <div key={index} style={{ marginBottom: '16px' }}>
                <div style={styles.chatHeaderMeta}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: log.sender === 'user' ? '#00f0ff' : '#38bdf8' }}>
                    {log.sender === 'user' ? '👤 Anda' : '🤖 Kang Teguh AI'}
                  </span>
                  {log.sender === 'bot' && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button 
                        type="button" 
                        onClick={() => speakText(log.text)}
                        style={styles.ttsMessageBtn}
                        title="Dengarkan suara pesan ini"
                      >
                        🔊 Dengar Suara
                      </button>
                      {isSpeaking && (
                        <button 
                          type="button" 
                          onClick={stopSpeaking}
                          style={styles.ttsStopMessageBtn}
                        >
                          ⏹️ Stop
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div style={log.sender === 'user' ? styles.bubbleUser : styles.bubbleBot}>
                  {log.text}
                </div>
                
                {/* HORIZONTAL CAROUSEL LAYOUT: Meniru Estetika Belanja Eksklusif Shopee/Tokopedia */}
                {log.hasShopee && (
                  <div style={styles.shopeeCarouselWrapper}>
                    <div style={styles.shopeeCarouselHeader}>
                      <span>🛒 REKOMENDASI PART SHOPEE AFILIASI (GESER KE KANAN ➔)</span>
                    </div>
                    <div style={styles.shopeeCarousel}>
                      <div style={styles.shopeeCard}>
                        <div style={styles.shopeePlaceholderImg}>📦</div>
                        <span style={styles.shopeeItemName}>Oli Mesin SPX2 Matik Full Sintetis</span>
                        <span style={styles.shopeePrice}>Rp 58.000</span>
                        <a href="https://s.shopee.co.id/2BF5CwWmtP" target="_blank" rel="noreferrer" style={styles.shopeeBtn}>
                          🛒 Beli di Shopee
                        </a>
                      </div>
                      <div style={styles.shopeeCard}>
                        <div style={styles.shopeePlaceholderImg}>⚙️</div>
                        <span style={styles.shopeeItemName}>Roller Racing BRT Silang Beat/Vario</span>
                        <span style={styles.shopeePrice}>Rp 85.000</span>
                        <a href="https://s.shopee.co.id/2BF5CwWmtP" target="_blank" rel="noreferrer" style={styles.shopeeBtn}>
                          🛒 Beli di Shopee
                        </a>
                      </div>
                      <div style={styles.shopeeCard}>
                        <div style={styles.shopeePlaceholderImg}>🔌</div>
                        <span style={styles.shopeeItemName}>Busi Denso / NGK Iridium Japan</span>
                        <span style={styles.shopeePrice}>Rp 95.000</span>
                        <a href="https://s.shopee.co.id/2BF5CwWmtP" target="_blank" rel="noreferrer" style={styles.shopeeBtn}>
                          🛒 Beli di Shopee
                        </a>
                      </div>
                      <div style={styles.shopeeCard}>
                        <div style={styles.shopeePlaceholderImg}>🧰</div>
                        <span style={styles.shopeeItemName}>Manometer Fuel Pump Injeksi Presisi</span>
                        <span style={styles.shopeePrice}>Rp 145.000</span>
                        <a href="https://s.shopee.co.id/2BF5CwWmtP" target="_blank" rel="noreferrer" style={styles.shopeeBtn}>
                          🛒 Beli di Shopee
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={chatBottomRef} />
          </div>

          {/* FORM KIRIM OBROLAN */}
          <form onSubmit={handleSendMessage} style={styles.chatForm}>
            <input 
              type="text" 
              placeholder="Tanya keluhan mesin atau doa berkendara... (contoh: Vario brebet pas tarikan gas)" 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              style={styles.chatInput}
            />
            <button type="submit" style={styles.chatSendBtn}>
              Kirim ⚡
            </button>
          </form>
        </section>

      </main>

      {/* FOOTER & APRESIASI DONATUR (Saweria Beli Kopi Style) */}
      <footer style={styles.footer}>
        <div style={styles.marquee}>
          Terima kasih kepada Donatur Bulan Ini: Bengkel Cuanker, SMK Otomotif Jaya, Teguh Digital Sukses! -- Dukung Kami Terus Lewat Link Saweria & Shopee Afiliasi!
        </div>
        <div style={styles.footerCopyright}>
          © 2026 Teguh Video Stream Center & Tuning Pro AI • Dukungan Penuh Bebas Biaya Rp 0
        </div>
      </footer>
    </div>
  );
}

// STYLING PRESET "CARBON RACING" (#121214, #1e1e24, #00f0ff, #ee4d2d)
const styles: { [key: string]: React.CSSProperties } = {
  body: {
    backgroundColor: '#121214',
    color: '#f1f5f9',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    margin: 0,
    padding: 0,
  },
  header: {
    backgroundColor: '#1e1e24',
    borderBottom: '2px solid #00f0ff',
    padding: '24px 20px',
    textAlign: 'center',
    boxShadow: '0 4px 20px rgba(0, 240, 255, 0.15)',
  },
  headerBadge: {
    display: 'inline-block',
    backgroundColor: 'rgba(0, 240, 255, 0.15)',
    color: '#00f0ff',
    border: '1px solid #00f0ff',
    borderRadius: '20px',
    padding: '3px 12px',
    fontSize: '10px',
    fontWeight: 900,
    letterSpacing: '1px',
    marginBottom: '8px',
  },
  headerTitle: {
    margin: '0 0 6px 0',
    fontSize: '26px',
    fontWeight: 900,
    letterSpacing: '1px',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  headerSubtitle: {
    margin: 0,
    fontSize: '12px',
    color: '#94a3b8',
    fontWeight: 600,
    letterSpacing: '0.5px',
  },
  navBar: {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
    padding: '16px',
    backgroundColor: '#16161a',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    flexWrap: 'wrap',
  },
  navButton: {
    backgroundColor: '#1e1e24',
    color: '#94a3b8',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '8px',
    padding: '10px 18px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  navButtonActive: {
    backgroundColor: 'rgba(0, 240, 255, 0.15)',
    color: '#00f0ff',
    border: '1.5px solid #00f0ff',
    borderRadius: '8px',
    padding: '10px 18px',
    fontSize: '13px',
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 0 14px rgba(0, 240, 255, 0.3)',
  },
  mainContent: {
    flex: 1,
    maxWidth: '1000px',
    width: '100%',
    margin: '0 auto',
    padding: '20px 16px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  section: {
    backgroundColor: '#1e1e24',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
  },
  sectionTitle: {
    margin: '0 0 16px 0',
    fontSize: '18px',
    fontWeight: 800,
    color: '#00f0ff',
    borderBottom: '1px solid rgba(0, 240, 255, 0.2)',
    paddingBottom: '8px',
  },
  card: {
    backgroundColor: '#16161c',
    borderRadius: '10px',
    padding: '16px',
    border: '1px solid rgba(255,255,255,0.06)',
    marginBottom: '14px',
  },
  cardText: {
    margin: 0,
    fontSize: '14px',
    lineHeight: '1.6',
    color: '#e2e8f0',
  },
  soundBtn: {
    backgroundColor: 'rgba(0, 240, 255, 0.15)',
    color: '#00f0ff',
    border: '1px solid #00f0ff',
    borderRadius: '6px',
    padding: '8px 14px',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: '10px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
  stopBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: '#ef4444',
    border: '1px solid #ef4444',
    borderRadius: '6px',
    padding: '8px 14px',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: '10px',
  },
  murottalPlayer: {
    display: 'flex',
    gap: '10px',
    marginTop: '12px',
    flexWrap: 'wrap',
  },
  audioActionBtn: {
    backgroundColor: '#1e1e24',
    color: '#f59e0b',
    border: '1px solid #f59e0b',
    borderRadius: '6px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  chatSection: {
    backgroundColor: '#1e1e24',
    borderRadius: '14px',
    padding: '20px',
    border: '1.5px solid rgba(0, 240, 255, 0.3)',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
  },
  chatHeaderBox: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '16px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    paddingBottom: '12px',
  },
  chatTitle: {
    margin: '0 0 4px 0',
    fontSize: '18px',
    fontWeight: 900,
    color: '#00f0ff',
  },
  chatDesc: {
    margin: 0,
    fontSize: '12px',
    color: '#94a3b8',
  },
  ttsControlGroup: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  autoSpeakBtn: {
    backgroundColor: '#26262e',
    color: '#94a3b8',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '20px',
    padding: '6px 14px',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  autoSpeakBtnActive: {
    backgroundColor: 'rgba(0, 240, 255, 0.18)',
    color: '#00f0ff',
    border: '1px solid #00f0ff',
    borderRadius: '20px',
    padding: '6px 14px',
    fontSize: '11px',
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 0 10px rgba(0, 240, 255, 0.25)',
  },
  stopGlobalBtn: {
    backgroundColor: '#ef4444',
    color: '#ffffff',
    border: 'none',
    borderRadius: '20px',
    padding: '6px 14px',
    fontSize: '11px',
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 0 10px rgba(239, 68, 68, 0.4)',
  },
  chatBox: {
    backgroundColor: '#121214',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px',
    padding: '16px',
    height: '380px',
    overflowY: 'auto',
    marginBottom: '16px',
  },
  chatHeaderMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
    padding: '0 4px',
  },
  ttsMessageBtn: {
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
    color: '#00f0ff',
    border: '1px solid rgba(0, 240, 255, 0.3)',
    borderRadius: '4px',
    padding: '2px 8px',
    fontSize: '10px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  ttsStopMessageBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: '#ef4444',
    border: '1px solid #ef4444',
    borderRadius: '4px',
    padding: '2px 8px',
    fontSize: '10px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  bubbleUser: {
    backgroundColor: '#0284c7',
    color: '#ffffff',
    padding: '12px 16px',
    borderRadius: '14px 14px 2px 14px',
    maxWidth: '85%',
    marginLeft: 'auto',
    fontSize: '13px',
    lineHeight: '1.5',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  },
  bubbleBot: {
    backgroundColor: '#1e1e24',
    color: '#f1f5f9',
    padding: '12px 16px',
    borderRadius: '14px 14px 14px 2px',
    maxWidth: '85%',
    marginRight: 'auto',
    fontSize: '13px',
    lineHeight: '1.6',
    border: '1px solid rgba(0, 240, 255, 0.2)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
  },
  shopeeCarouselWrapper: {
    marginTop: '10px',
    marginBottom: '6px',
  },
  shopeeCarouselHeader: {
    fontSize: '10px',
    fontWeight: 800,
    color: '#f59e0b',
    marginBottom: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  shopeeCarousel: {
    display: 'flex',
    gap: '12px',
    overflowX: 'auto',
    paddingBottom: '8px',
  },
  shopeeCard: {
    flex: '0 0 190px',
    backgroundColor: '#16161c',
    border: '1px solid rgba(238, 77, 45, 0.4)',
    borderRadius: '10px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
  },
  shopeePlaceholderImg: {
    fontSize: '28px',
    textAlign: 'center',
    padding: '6px',
    backgroundColor: 'rgba(238, 77, 45, 0.1)',
    borderRadius: '8px',
  },
  shopeeItemName: {
    fontSize: '12px',
    fontWeight: 800,
    color: '#ffffff',
    lineHeight: '1.3',
  },
  shopeePrice: {
    fontSize: '12px',
    fontWeight: 900,
    color: '#ee4d2d',
  },
  shopeeBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ee4d2d',
    color: '#ffffff',
    fontSize: '11px',
    fontWeight: 800,
    padding: '8px',
    borderRadius: '6px',
    textDecoration: 'none',
    boxShadow: '0 2px 8px rgba(238, 77, 45, 0.4)',
  },
  chatForm: {
    display: 'flex',
    gap: '8px',
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#16161c',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '8px',
    padding: '12px 16px',
    color: '#ffffff',
    fontSize: '13px',
    outline: 'none',
  },
  chatSendBtn: {
    backgroundColor: '#00f0ff',
    color: '#0b1215',
    border: 'none',
    borderRadius: '8px',
    padding: '0 20px',
    fontSize: '13px',
    fontWeight: 900,
    cursor: 'pointer',
    boxShadow: '0 2px 10px rgba(0, 240, 255, 0.3)',
  },
  footer: {
    backgroundColor: '#16161a',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    padding: '16px',
    textAlign: 'center',
    marginTop: 'auto',
  },
  marquee: {
    color: '#f59e0b',
    fontSize: '12px',
    fontWeight: 700,
    marginBottom: '8px',
  },
  footerCopyright: {
    color: '#64748b',
    fontSize: '11px',
  },
};
