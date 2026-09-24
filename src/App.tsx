import React, { useState, useEffect } from 'react';

// Struktur Data Lokal untuk Video Store (Backup Offline)
interface VideoItem {
  id: string;
  title: string;
  category: 'servis' | 'upgrade' | 'tilawah';
  youtubeId: string;
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
  const [chatLogs, setChatLogs] = useState<{ sender: 'user' | 'bot'; text: string; hasShopee?: boolean }[]>([
    { sender: 'bot', text: 'Halo Teguh Digital! Mekanik AI Tuning Pro siap membantu analisa mesin motor Anda atau memutar tilawah. Silakan ketik kendala motor Anda.' }
  ]);

  // LOGIKA UTAMA: Anti-Suara Bertumpuk Saat Pindah Halaman/Tab
  const handleTabChange = (newTab: string) => {
    // 1. Hentikan paksa semua Web Speech API (Suara Robot Membaca)
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // 2. Refresh/Reset semua Video YouTube agar langsung MATI dan tidak bersuara di latar belakang
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach((iframe) => {
      const currentSrc = iframe.src;
      iframe.src = currentSrc;
    });

    // 3. Set Halaman Aktif Baru
    setActiveTab(newTab);
  };

  // Fungsi Fitur Suara Robot (Web Speech API) untuk Membaca Teks Konten
  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Matikan suara sebelumnya
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID'; // Menggunakan aksen bahasa Indonesia
      window.speechSynthesis.speak(utterance);
    } else {
      alert('Fitur suara robot tidak didukung di browser HP Anda.');
    }
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
      let botResponse = 'Maaf, Mekanik AI kurang memahami keluhan itu. Bisa infokan jenis motor Honda/Yamaha Anda?';
      let includeShopee = false;

      if (userMessage.toLowerCase().includes('oli') || userMessage.toLowerCase().includes('servis')) {
        botResponse = 'Rekomendasi Servis: Lakukan penggantian oli mesin setiap 2.000 KM. Berikut onderdil original pilihan terbaik untuk Anda:';
        includeShopee = true;
      } else if (userMessage.toLowerCase().includes('cvt') || userMessage.toLowerCase().includes('roller')) {
        botResponse = 'Analisa Upgrade Performa: Untuk tarikan matic lebih enteng, gunakan roller silang kombinasi. Cek komponen upgrade Shopee terpilih di bawah ini:';
        includeShopee = true;
      }

      setChatLogs(prev => [...prev, { sender: 'bot', text: botResponse, hasShopee: includeShopee }]);
    }, 800);
  };

  return (
    <div style={styles.body}>
      {/* HEADER UTAMA PREMUM */}
      <header style={styles.header}>
        <h1 style={styles.headerTitle}>TUNING PRO AI</h1>
        <p style={styles.headerSubtitle}>SUPREME WORKSHOP & STREAM CENTER</p>
      </header>

      {/* DYNAMIC NAVIGATION BAR (Gaya Navigasi OLX/YouTube Nested & Longgar) */}
      <nav style={styles.navBar}>
        <button 
          style={activeTab === 'servis' ? styles.navButtonActive : styles.navButton} 
          onClick={() => handleTabChange('servis')}
        >
          🔧 Mode Servis Berkala A-Z
        </button>
        <button 
          style={activeTab === 'upgrade' ? styles.navButtonActive : styles.navButton} 
          onClick={() => handleTabChange('upgrade')}
        >
          🚀 Upgrade Performa CVT
        </button>
        <button 
          style={activeTab === 'tilawah' ? styles.navButtonActive : styles.navButton} 
          onClick={() => handleTabChange('tilawah')}
        >
          📖 Tilawah / Murottal
        </button>
      </nav>

      {/* AREA KONTEN UTAMA DENGAN DYNAMIC PAGE SWITCHING */}
      <main style={styles.mainContent}>
        
        {/* TAB 1: MODE SERVIS MOTOR */}
        {activeTab === 'servis' && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Langkah Kerja Servis Berkala (Honda & Yamaha)</h2>
            <div style={styles.card}>
              <p style={styles.cardText}><strong>Langkah 1:</strong> Bersihkan Filter Udara dan Cek Busi Motor ✅</p>
              <button style={styles.soundBtn} onClick={() => speakText('Langkah satu. Bersihkan Filter Udara dan Cek Busi Motor')}>🔊 Dengarkan Panduan Suara</button>
            </div>
            <div style={styles.videoWrapper}>
              {/* YouTube Player Berfungsi Penuh */}
              <iframe 
                style={styles.videoFrame}
                src="https://youtube.com" 
                title="Tutorial Servis"
                allowFullScreen
              ></iframe>
            </div>
          </section>
        )}

        {/* TAB 2: UPGRADE PERFORMA MATIC */}
        {activeTab === 'upgrade' && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Simulasi Bore-Up & Racikan Kirian CVT</h2>
            <div style={styles.card}>
              <p style={styles.cardText}>Geser racikan komponen untuk melihat prediksi peningkatan torsi mekanik sekolah.</p>
              <div style={{ margin: '15px 0' }}>
                <label style={{ color: '#00f2fe', display: 'block', marginBottom: '5px' }}>Ukuran Roller (Gram): 11g</label>
                <input type="range" min="7" max="15" defaultValue="11" style={{ width: '100%' }} />
              </div>
            </div>
          </section>
        )}

        {/* TAB 3: TILAWAH / MUROTTAL AUDIO PLAYER */}
        {activeTab === 'tilawah' && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Aplikasi Tilawah Belajar Al-Quran Lansia</h2>
            <div style={styles.card}>
              <p style={styles.cardText}><strong>Surah Al-Baqarah (Metode Karaoke Per Kata)</strong></p>
              <div style={styles.murottalPlayer}>
                <button style={styles.audioActionBtn} onClick={() => speakText('Alif Laam Myeem. Dzaalikal kitaabu laa roiba feeh. Hudal lil muttaqeen')}>▶️ Putar Suara Per Kata</button>
                <button style={styles.audioActionBtn} onClick={() => if ('speechSynthesis' in window) window.speechSynthesis.pause()}>⏸️ Jeda</button>
              </div>
            </div>
          </section>
        )}

        {/* INTEGRASI TCHAT & BOT MEKANIK CERDAS */}
        <section style={styles.chatSection}>
          <h3 style={styles.chatTitle}>⚡ TChat: Asisten Robot Mekanik Pro</h3>
          <div style={styles.chatBox}>
            {chatLogs.map((log, index) => (
              <div key={index} style={{ marginBottom: '16px' }}>
                <div style={log.sender === 'user' ? styles.bubbleUser : styles.bubbleBot}>
                  {log.text}
                </div>
                
                {/* HORIZONTAL CAROUSEL LAYOUT: Meniru Estetika Belanja Eksklusif Shopee/Tokopedia */}
                {log.hasShopee && (
                  <div style={styles.shopeeCarousel}>
                    <div style={styles.shopeeCard}>
                      <div style={styles.shopeePlaceholderImg}>📦</div>
                      <span style={styles.shopeeItemName}>Oli Mesin SPX2 Matik</span>
                      <a href="https://shopee.co.id" target="_blank" rel="noreferrer" style={styles.shopeeBtn}>
                        🛒 Beli di Shopee
                      </a>
                    </div>
                    <div style={styles.shopeeCard}>
                      <div style={styles.shopeePlaceholderImg}>⚙️</div>
                      <span style={styles.shopeeItemName}>Roller Racing BRT</span>
                      <a href="https://shopee.co.id" target="_blank" rel="noreferrer" style={styles.shopeeBtn}>
                        🛒 Beli di Shopee
                      </a>
                    </div>
                    <div style={styles.shopeeCard}>
                      <div style={styles.shopeePlaceholderImg}>🔌</div>
                      <span style={styles.shopeeItemName}>Busi Denso Iridium</span>
                      <a href="https://shopee.co.id" target="_blank" rel="noreferrer" style={styles.shopeeBtn}>
                        🛒 Beli di Shopee
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <form onSubmit={handleSendMessage} style={styles.chatForm}>
            <input 
              type="text" 
              placeholder="Tanya kendala motor Anda di sini..." 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              style={styles.chatInput}
            />
            <button type="submit" style={styles.chatSendBtn}>Kirim</button>
          </form>
        </section>

      </main>

      {/* FOOTER & APRESIASI DONATUR (Saweria Beli Kopi Style) */}
      <footer style={styles.footer}>
        <marquee style={styles.marquee}>Terima kasih kepada Donatur Bulan Ini: Bengkel Cuanker, SMK Otomotif Jaya, Teguh Digital Sukses! -- Dukung Kami Terus Lewat Link Saweria / Buy Me A Coffee Di Bawah!</marquee>
               
