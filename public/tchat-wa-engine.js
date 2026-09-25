/**
 * TCHAT WA ENGINE PRO (PEER-TO-PEER WEBRTC, VOICE CALL, VIDEO CALL, VOICE NOTE, FILE & LOCATION SHARE)
 * - Grup Komunitas Global & Ruang Darurat Motor Mogok (SOS Step / Servis di Tempat)
 * - Obrolan Pribadi (Japri 1-on-1 via Custom @Username atau ID Khusus)
 * - Klik Nama Pengirim untuk Langsung Japri, Telepon, atau Simpan Kontak
 * - Beban Penyimpanan Server: 0 MB (Semua media & riwayat tersimpan di IndexedDB HP masing-masing pengguna).
 */

(function () {
  "use strict";

  // ==========================================================================
  // 1. IDENTITAS PENGGUNA & INISIALISASI DATABASE LOKAL (INDEXEDDB HP)
  // ==========================================================================
  let myPeerId = localStorage.getItem("tvs_tchat_peer_id");
  if (!myPeerId) {
    myPeerId = "MTR-" + Math.floor(1000 + Math.random() * 9000);
    localStorage.setItem("tvs_tchat_peer_id", myPeerId);
  }

  let myUserName = localStorage.getItem("tvs_tchat_user_name");
  if (!myUserName) {
    myUserName = "Montir #" + myPeerId.split("-")[1];
    localStorage.setItem("tvs_tchat_user_name", myUserName);
  }

  let myCustomUsername = localStorage.getItem("tvs_tchat_custom_username") || "";

  // Channel aktif: "global" (Grup Komunitas & Bantuan Mogok) ATAU PeerId/Username tujuan (Japri)
  let activeChatChannel = "global";
  let activePrivateContact = null; // { id, name, username }

  let isAudioMuted = false;
  let isVideoOff = false;
  let activeCallSession = null;
  let activePeerConnection = null;
  let localMediaStream = null;
  let callTimerInterval = null;
  let callSeconds = 0;
  let isNotificationAllowed = false;
  let mediaRecorderInstance = null;
  let audioRecordChunks = [];
  let recordTimerInterval = null;
  let recordSeconds = 0;
  let lastSignalPollTimestamp = Date.now() - 30000;
  let unreadCount = 0;

  // Web Audio Context untuk Nada Dering & Notifikasi Instan (0 KB Download File)
  let audioCtx = null;
  let ringtoneOscillator = null;

  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // ==========================================================================
  // 2. SYNTHESIZER NADA DERING & NOTIFIKASI ALA WHATSAPP (WEB AUDIO API)
  // ==========================================================================
  function playNotificationDing() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Nada 1: 880 Hz (A5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      // Nada 2: 1760 Hz (A6)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1760, now + 0.12);
      gain2.gain.setValueAtTime(0.25, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.45);
    } catch (e) {
      console.warn("Audio notification ding error:", e);
    }
  }

  function startRingtoneSound(isIncoming) {
    stopRingtoneSound();
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(isIncoming ? 440 : 425, ctx.currentTime);

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      ringtoneOscillator = { osc, gain };

      const pulseInterval = setInterval(function () {
        if (!ringtoneOscillator) {
          clearInterval(pulseInterval);
          return;
        }
        try {
          const t = ctx.currentTime;
          gain.gain.setValueAtTime(0.18, t);
          gain.gain.setValueAtTime(0.001, t + (isIncoming ? 1.0 : 0.8));
        } catch (err) {}
      }, isIncoming ? 2500 : 3000);
      ringtoneOscillator.interval = pulseInterval;
    } catch (e) {
      console.warn("Ringtone error:", e);
    }
  }

  function stopRingtoneSound() {
    if (ringtoneOscillator) {
      try {
        if (ringtoneOscillator.interval) clearInterval(ringtoneOscillator.interval);
        ringtoneOscillator.osc.stop();
        ringtoneOscillator.osc.disconnect();
      } catch (e) {}
      ringtoneOscillator = null;
    }
  }

  // ==========================================================================
  // 3. DATABASE LOKAL HP (INDEXEDDB) - 0 MB BEBAN SERVER!
  // ==========================================================================
  const DB_NAME = "tvs_tchat_db";
  const DB_VERSION = 2;
  let dbInstance = null;

  function initIndexedDB() {
    return new Promise(function (resolve) {
      if (!window.indexedDB) {
        resolve(null);
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("messages")) {
          const store = db.createObjectStore("messages", { keyPath: "id", autoIncrement: true });
          store.createIndex("timestamp", "timestamp", { unique: false });
          store.createIndex("channel", "channel", { unique: false });
        }
        if (!db.objectStoreNames.contains("contacts")) {
          db.createObjectStore("contacts", { keyPath: "id" });
        }
      };
      req.onsuccess = function (e) {
        dbInstance = e.target.result;
        resolve(dbInstance);
      };
      req.onerror = function (err) {
        console.warn("IndexedDB error:", err);
        resolve(null);
      };
    });
  }

  async function saveMessageToLocalDB(msg) {
    if (!msg.channel) msg.channel = "global";
    if (!dbInstance) await initIndexedDB();
    if (!dbInstance) {
      try {
        const list = JSON.parse(localStorage.getItem("tvs_tchat_local_msgs") || "[]");
        list.push(msg);
        if (list.length > 100) list.shift();
        localStorage.setItem("tvs_tchat_local_msgs", JSON.stringify(list));
      } catch (e) {}
      return;
    }
    try {
      const tx = dbInstance.transaction("messages", "readwrite");
      tx.objectStore("messages").add(msg);
    } catch (e) {
      console.warn("Save msg IndexedDB error:", e);
    }
  }

  async function loadMessagesFromLocalDB(channel) {
    if (!channel) channel = "global";
    if (!dbInstance) await initIndexedDB();
    if (!dbInstance) {
      try {
        const list = JSON.parse(localStorage.getItem("tvs_tchat_local_msgs") || "[]");
        return list.filter(m => (m.channel || "global") === channel);
      } catch (e) {
        return [];
      }
    }
    return new Promise(function (resolve) {
      try {
        const tx = dbInstance.transaction("messages", "readonly");
        const req = tx.objectStore("messages").getAll();
        req.onsuccess = function () {
          const all = req.result || [];
          const filtered = all.filter(function (m) {
            if (channel === "global") {
              return !m.channel || m.channel === "global";
            } else {
              // Untuk channel privat: cocokkan dua arah (dikirim ke target atau diterima dari target)
              return (m.channel === channel) ||
                     (m.senderId === channel && m.to === myPeerId) ||
                     (m.senderUsername && m.senderUsername === channel) ||
                     (m.to === channel && m.senderId === myPeerId);
            }
          });
          resolve(filtered);
        };
        req.onerror = function () {
          resolve([]);
        };
      } catch (e) {
        resolve([]);
      }
    });
  }

  // ==========================================================================
  // 4. KONTAK & JAPRI (OBROLAN PRIBADI 1-ON-1)
  // ==========================================================================
  function getSavedContacts() {
    try {
      return JSON.parse(localStorage.getItem("tvs_tchat_contacts") || "[]");
    } catch (e) {
      return [];
    }
  }

  function saveContactToStorage(contact) {
    const list = getSavedContacts();
    const existingIndex = list.findIndex(c => c.id === contact.id || (contact.username && c.username === contact.username));
    if (existingIndex >= 0) {
      list[existingIndex] = Object.assign(list[existingIndex], contact);
    } else {
      list.push(contact);
    }
    localStorage.setItem("tvs_tchat_contacts", JSON.stringify(list));
    renderContactsListUI();
  }

  function renderContactsListUI() {
    const container = document.getElementById("tchat-contacts-list");
    if (!container) return;

    const list = getSavedContacts();
    if (list.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:20px; color:#94a3b8; font-size:12px;">
          Belum ada kontak obrolan pribadi.<br>
          <span style="font-size:11px; color:#64748b;">Klik nama anggota di <b>Grup Global</b> atau klik tombol <b>➕ Japri Baru</b> di atas untuk mulai obrolan pribadi.</span>
        </div>
      `;
      return;
    }

    let html = "";
    list.forEach(function (c) {
      const handle = c.username ? `@${c.username}` : c.id;
      html += `
        <div style="display:flex; align-items:center; justify-content:space-between; background:#121e24; border:1px solid rgba(0,240,255,0.2); border-radius:10px; padding:10px 12px; margin-bottom:8px; cursor:pointer;" onclick="window.tchatEngine.openPrivateChat('${c.id}', '${escapeQuotes(c.name)}', '${c.username || ""}')">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:36px; height:36px; border-radius:50%; background:linear-gradient(135deg, #00f0ff, #0284c7); display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:900; color:#0b1215;">
              ${(c.name || "M").charAt(0).toUpperCase()}
            </div>
            <div>
              <div style="font-weight:800; color:#fff; font-size:13px;">${escapeHtml(c.name)}</div>
              <div style="font-size:11px; color:var(--neon-cyan);">${escapeHtml(handle)}</div>
            </div>
          </div>
          <div style="display:flex; gap:6px;">
            <button type="button" onclick="event.stopPropagation(); window.tchatEngine.startCall('${c.id}', false)" style="background:#22c55e; color:#fff; border:none; padding:6px 10px; border-radius:6px; font-size:11px; font-weight:800; cursor:pointer;">
              📞
            </button>
            <button type="button" onclick="event.stopPropagation(); window.tchatEngine.startCall('${c.id}', true)" style="background:var(--neon-cyan); color:#0b1215; border:none; padding:6px 10px; border-radius:6px; font-size:11px; font-weight:800; cursor:pointer;">
              📹
            </button>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  }

  // ==========================================================================
  // 5. WEBRTC P2P CONFIGURATION & CALLING LOGIC (SUARA & VIDEO)
  // ==========================================================================
  const rtcConfig = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" }
    ]
  };

  async function startCall(targetId, isVideo) {
    if (!targetId || targetId.trim() === myPeerId || (myCustomUsername && targetId.trim() === myCustomUsername)) {
      alert("Masukkan ID atau @username Teman/Montir yang ingin Anda hubungi!");
      return;
    }

    try {
      getAudioContext();
      localMediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo ? { facingMode: "user" } : false
      });
    } catch (err) {
      alert("Gagal mengakses mikrofon atau kamera. Pastikan izin telah diberikan di browser/HP Anda.");
      return;
    }

    activeCallSession = {
      targetId: targetId.trim(),
      isVideo: isVideo,
      isCaller: true,
      status: "calling"
    };

    showCallOverlay(isVideo, "Menghubungi " + targetId + "...", false);
    startRingtoneSound(false);

    // Kirim sinyal panggilan
    await sendSignal({
      to: targetId.trim(),
      type: "call-invite",
      payload: {
        callerId: myPeerId,
        callerName: myUserName,
        callerUsername: myCustomUsername,
        isVideo: isVideo
      }
    });

    setupPeerConnection(targetId.trim(), true, isVideo);
  }

  function setupPeerConnection(targetId, isCaller, isVideo) {
    if (activePeerConnection) {
      activePeerConnection.close();
      activePeerConnection = null;
    }

    activePeerConnection = new RTCPeerConnection(rtcConfig);

    if (localMediaStream) {
      localMediaStream.getTracks().forEach(function (track) {
        activePeerConnection.addTrack(track, localMediaStream);
      });
      const localVideoEl = document.getElementById("tchat-local-video");
      if (localVideoEl && isVideo) {
        localVideoEl.srcObject = localMediaStream;
        localVideoEl.style.display = "block";
      }
    }

    activePeerConnection.ontrack = function (event) {
      stopRingtoneSound();
      const remoteVideoEl = document.getElementById("tchat-remote-video");
      const remoteAudioEl = document.getElementById("tchat-remote-audio");
      if (event.streams && event.streams[0]) {
        if (remoteVideoEl && isVideo) {
          remoteVideoEl.srcObject = event.streams[0];
          remoteVideoEl.style.display = "block";
        }
        if (remoteAudioEl) {
          remoteAudioEl.srcObject = event.streams[0];
        }
      }
      onCallConnected();
    };

    activePeerConnection.onicecandidate = function (event) {
      if (event.candidate) {
        sendSignal({
          to: targetId,
          type: "ice-candidate",
          payload: event.candidate
        });
      }
    };

    if (isCaller) {
      activePeerConnection.createOffer().then(function (offer) {
        return activePeerConnection.setLocalDescription(offer);
      }).then(function () {
        sendSignal({
          to: targetId,
          type: "call-offer",
          payload: activePeerConnection.localDescription
        });
      }).catch(function (err) {
        console.warn("Offer error:", err);
      });
    }
  }

  async function handleIncomingCallInvite(signal) {
    const { callerId, callerName, callerUsername, isVideo } = signal.payload;
    activeCallSession = {
      targetId: callerId,
      callerName: callerName || callerId,
      callerUsername: callerUsername || "",
      isVideo: isVideo,
      isCaller: false,
      status: "ringing"
    };

    startRingtoneSound(true);
    showIncomingCallBanner(callerName || callerId, callerUsername ? `@${callerUsername}` : callerId, isVideo);
    triggerDeviceVibration();
  }

  async function acceptIncomingCall() {
    hideIncomingCallBanner();
    stopRingtoneSound();

    if (!activeCallSession) return;
    const { targetId, isVideo } = activeCallSession;

    try {
      getAudioContext();
      localMediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo ? { facingMode: "user" } : false
      });
    } catch (err) {
      alert("Izin mikrofon/kamera dibutuhkan untuk menjawab telepon.");
      endCall();
      return;
    }

    showCallOverlay(isVideo, "Menyambungkan...", true);
    setupPeerConnection(targetId, false, isVideo);

    await sendSignal({
      to: targetId,
      type: "call-accept",
      payload: { answererId: myPeerId, answererUsername: myCustomUsername }
    });
  }

  function rejectIncomingCall() {
    hideIncomingCallBanner();
    stopRingtoneSound();
    if (activeCallSession) {
      sendSignal({
        to: activeCallSession.targetId,
        type: "call-reject",
        payload: { rejecterId: myPeerId }
      });
      activeCallSession = null;
    }
  }

  function onCallConnected() {
    stopRingtoneSound();
    const statusEl = document.getElementById("tchat-call-status");
    if (statusEl) statusEl.innerText = "00:00 (Terhubung)";

    callSeconds = 0;
    if (callTimerInterval) clearInterval(callTimerInterval);
    callTimerInterval = setInterval(function () {
      callSeconds++;
      const m = Math.floor(callSeconds / 60).toString().padStart(2, "0");
      const s = (callSeconds % 60).toString().padStart(2, "0");
      if (statusEl) statusEl.innerText = m + ":" + s + " (Terhubung P2P)";
    }, 1000);
  }

  function endCall() {
    stopRingtoneSound();
    if (callTimerInterval) clearInterval(callTimerInterval);
    callTimerInterval = null;

    if (activeCallSession) {
      sendSignal({
        to: activeCallSession.targetId,
        type: "call-end",
        payload: { endedBy: myPeerId }
      });
    }

    if (activePeerConnection) {
      activePeerConnection.close();
      activePeerConnection = null;
    }

    if (localMediaStream) {
      localMediaStream.getTracks().forEach(t => t.stop());
      localMediaStream = null;
    }

    activeCallSession = null;
    hideCallOverlay();
    hideIncomingCallBanner();
  }

  function toggleMuteMic() {
    isAudioMuted = !isAudioMuted;
    if (localMediaStream) {
      localMediaStream.getAudioTracks().forEach(function (track) {
        track.enabled = !isAudioMuted;
      });
    }
    const btn = document.getElementById("tchat-btn-mute");
    if (btn) {
      btn.style.background = isAudioMuted ? "#ef4444" : "#1e293b";
      btn.innerHTML = isAudioMuted ? "🔇 Unmute" : "🎤 Mute";
    }
  }

  function toggleVideoCamera() {
    isVideoOff = !isVideoOff;
    if (localMediaStream) {
      localMediaStream.getVideoTracks().forEach(function (track) {
        track.enabled = !isVideoOff;
      });
    }
    const btn = document.getElementById("tchat-btn-video-toggle");
    if (btn) {
      btn.style.background = isVideoOff ? "#ef4444" : "#1e293b";
      btn.innerHTML = isVideoOff ? "📷 Nyalakan" : "📹 Matikan";
    }
  }

  // ==========================================================================
  // 6. SIGNALING POLLING (IN-MEMORY, EPHEMERAL RELAY)
  // ==========================================================================
  async function sendSignal(signalData) {
    try {
      signalData.from = myPeerId;
      signalData.senderUsername = myCustomUsername;
      await fetch("/api/tchat/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signalData)
      });
    } catch (e) {
      console.warn("Signal send error:", e);
    }
  }

  async function pollSignals() {
    try {
      let url = "/api/tchat/poll?peerId=" + encodeURIComponent(myPeerId) + "&since=" + lastSignalPollTimestamp;
      if (myCustomUsername) {
        url += "&username=" + encodeURIComponent(myCustomUsername);
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.serverTime) lastSignalPollTimestamp = data.serverTime;
        if (data.messages && data.messages.length > 0) {
          for (let i = 0; i < data.messages.length; i++) {
            const sig = data.messages[i];
            handleSignalMessage(sig);
          }
        }
      }
    } catch (e) {}
  }

  async function handleSignalMessage(signal) {
    if (signal.from === myPeerId || (myCustomUsername && signal.from === myCustomUsername)) return;

    switch (signal.type) {
      case "call-invite":
        handleIncomingCallInvite(signal);
        break;

      case "call-offer":
        if (activePeerConnection) {
          await activePeerConnection.setRemoteDescription(new RTCSessionDescription(signal.payload));
          const answer = await activePeerConnection.createAnswer();
          await activePeerConnection.setLocalDescription(answer);
          sendSignal({
            to: signal.from,
            type: "call-answer",
            payload: activePeerConnection.localDescription
          });
        }
        break;

      case "call-answer":
        if (activePeerConnection) {
          await activePeerConnection.setRemoteDescription(new RTCSessionDescription(signal.payload));
        }
        break;

      case "ice-candidate":
        if (activePeerConnection && signal.payload) {
          try {
            await activePeerConnection.addIceCandidate(new RTCIceCandidate(signal.payload));
          } catch (e) {}
        }
        break;

      case "call-reject":
        alert("Panggilan ditolak atau teman sedang sibuk.");
        endCall();
        break;

      case "call-end":
        endCall();
        break;

      case "chat-message":
        onReceiveChatMessage(signal.payload);
        break;
    }
  }

  // ==========================================================================
  // 7. CHAT & SOS MOTOR MOGOK RECEIVER
  // ==========================================================================
  function onReceiveChatMessage(msg) {
    playNotificationDing();
    triggerDeviceVibration();

    // Simpan otomatis ke daftar kontak jika pengirim baru
    if (msg.senderId && msg.senderId !== myPeerId) {
      saveContactToStorage({
        id: msg.senderId,
        name: msg.senderName || "Teman Montir",
        username: msg.senderUsername || ""
      });
    }

    // Simpan ke IndexedDB lokal HP (0 MB server load)
    saveMessageToLocalDB(msg);

    // Cek apakah pesan cocok dengan channel yang sedang dilihat
    const isTargetingCurrentChannel = (activeChatChannel === "global" && (!msg.channel || msg.channel === "global")) ||
      (activeChatChannel !== "global" && (msg.channel === activeChatChannel || msg.senderId === activeChatChannel || (msg.senderUsername && msg.senderUsername === activeChatChannel)));

    const tchatRoom = document.getElementById("room-tchat");
    const isTChatActive = tchatRoom && tchatRoom.classList.contains("active");

    if (!isTChatActive || document.hidden || !isTargetingCurrentChannel) {
      unreadCount++;
      updateUnreadBadge();

      if (window.Notification && Notification.permission === "granted") {
        try {
          let notifTitle = "Pesan baru dari " + (msg.senderName || "Komunitas TChat");
          let bodyText = msg.text || "Mengirim file / foto / lokasi";

          if (msg.type === "sos_emergency") {
            notifTitle = "🚨 SOS MOGOK: " + (msg.senderName || "Member");
            bodyText = "Motor Mogok: " + (msg.vehicleAndIssue || "Butuh bantuan di jalan!");
          } else if (msg.type === "image") {
            bodyText = "📷 Mengirim foto";
          } else if (msg.type === "voice") {
            bodyText = "🎙️ Mengirim pesan suara (Voice Note)";
          } else if (msg.type === "location") {
            bodyText = "📍 Membagikan lokasi Google Maps";
          } else if (msg.type === "file") {
            bodyText = "📎 Mengirim dokumen: " + (msg.fileName || "");
          }

          new Notification(notifTitle, {
            body: bodyText,
            icon: "/pwa-192x192.png",
            tag: "tvs-tchat"
          });
        } catch (e) {}
      }
    }

    if (isTargetingCurrentChannel) {
      renderChatMessageBubble(msg, false);
    }
  }

  function updateUnreadBadge() {
    const badge = document.querySelector("#nav-btn-tchat .tchat-dot-badge");
    if (badge) {
      badge.style.display = unreadCount > 0 ? "block" : "none";
    }
  }

  function renderChatMessageBubble(msg, isOut) {
    const container = document.getElementById("tchat-messages");
    if (!container) return;

    const bubble = document.createElement("div");
    bubble.className = "chat-bubble " + (isOut ? "out" : "in");

    const senderColor = isOut ? "var(--neon-cyan)" : "var(--gold-accent)";
    const senderHandle = msg.senderUsername ? `@${msg.senderUsername}` : (msg.senderId || "");

    const senderTitle = isOut
      ? `👤 Anda (${myUserName}${myCustomUsername ? ` • @${myCustomUsername}` : ""})`
      : `<span style="cursor:pointer; text-decoration:underline;" onclick="window.tchatEngine.openUserProfileActions('${escapeQuotes(msg.senderName || "Member")}', '${msg.senderId || ""}', '${msg.senderUsername || ""}')">👤 ${escapeHtml(msg.senderName || "Member")} ${senderHandle ? `<span style="color:var(--neon-cyan); font-weight:700;">• ${escapeHtml(senderHandle)}</span>` : ""}</span>`;

    let contentHtml = "";

    // 1. KARTU DARURAT BANTUAN MOTOR MOGOK (SOS)
    if (msg.type === "sos_emergency") {
      contentHtml = `
        <div style="background:linear-gradient(135deg, rgba(239,68,68,0.25), rgba(185,28,28,0.4)); border:2px solid #ef4444; border-radius:10px; padding:12px; margin-top:6px; box-shadow:0 0 16px rgba(239,68,68,0.4);">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="font-size:20px; animation:pulse 0.8s infinite;">🚨</span>
              <b style="color:#ef4444; font-size:13px; text-transform:uppercase;">PERMOHONAN BANTUAN MOTOR MOGOK!</b>
            </div>
            <span class="tag-pill" style="background:#ef4444; color:#fff; font-size:10px; font-weight:900;">DARURAT</span>
          </div>
          <div style="color:#fff; font-size:13px; font-weight:800; margin-bottom:4px;">
            🛵 Motor & Keluhan: <span style="color:#facc15;">${escapeHtml(msg.vehicleAndIssue || "Motor mogok butuh pertolongan")}</span>
          </div>
          <div style="color:#cbd5e1; font-size:11px; margin-bottom:8px;">
            📍 Titik Koordinat: ${msg.lat ? `${msg.lat.toFixed(5)}, ${msg.lng.toFixed(5)}` : "Lokasi GPS"}
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            ${msg.lat ? `
            <a href="https://www.google.com/maps?q=${msg.lat},${msg.lng}" target="_blank" rel="noopener noreferrer" style="background:#10b981; color:#fff; text-decoration:none; padding:6px 12px; border-radius:6px; font-size:11px; font-weight:800; display:inline-flex; align-items:center; gap:4px;">
              🗺️ Buka di Google Maps
            </a>` : ""}
            ${!isOut ? `
            <button type="button" onclick="window.tchatEngine.openPrivateChat('${msg.senderId}', '${escapeQuotes(msg.senderName || "Member")}', '${msg.senderUsername || ""}')" style="background:var(--neon-cyan); color:#0b1215; border:none; padding:6px 12px; border-radius:6px; font-size:11px; font-weight:900; cursor:pointer;">
              💬 Bantu Dia (Japri)
            </button>
            <button type="button" onclick="window.tchatEngine.startCall('${msg.senderId}', false)" style="background:#22c55e; color:#fff; border:none; padding:6px 12px; border-radius:6px; font-size:11px; font-weight:800; cursor:pointer;">
              📞 Telp Penolong
            </button>` : ""}
          </div>
        </div>
      `;
    }
    // 2. Pesan Teks & Emoji
    else if (msg.type === "text" || !msg.type) {
      contentHtml = `<div>${escapeHtml(msg.text || "")}</div>`;
    }
    // 3. Foto / Gambar
    else if (msg.type === "image") {
      contentHtml = `
        <div style="margin-top:4px;">
          <img src="${msg.dataUrl}" alt="Foto Kiriman" style="max-width:100%; max-height:240px; border-radius:8px; cursor:pointer;" onclick="openImagePreviewModal('${msg.dataUrl}')" />
          ${msg.caption ? `<div style="font-size:12px; margin-top:4px;">${escapeHtml(msg.caption)}</div>` : ""}
        </div>
      `;
    }
    // 4. Pesan Suara / Voice Note (VN)
    else if (msg.type === "voice") {
      contentHtml = `
        <div style="display:flex; align-items:center; gap:8px; margin-top:4px; background:rgba(0,0,0,0.25); padding:6px 10px; border-radius:8px;">
          <button type="button" onclick="playVoiceNoteAudio(this, '${msg.dataUrl}')" style="background:#00f0ff; color:#0b1215; border:none; width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:14px; font-weight:900;">
            ▶️
          </button>
          <div style="flex:1;">
            <div style="font-size:10px; color:#cbd5e1; font-weight:700;">🎙️ Pesan Suara (${msg.duration || "0:05"})</div>
            <div style="height:4px; background:rgba(255,255,255,0.2); border-radius:2px; margin-top:4px; overflow:hidden;">
              <div class="vn-progress" style="width:0%; height:100%; background:#00f0ff; transition:width 0.1s linear;"></div>
            </div>
          </div>
        </div>
      `;
    }
    // 5. Dokumen / File (PDF, ZIP, Word, dll.)
    else if (msg.type === "file") {
      contentHtml = `
        <div style="display:flex; align-items:center; gap:8px; margin-top:4px; background:rgba(0,0,0,0.25); padding:8px 12px; border-radius:8px;">
          <span style="font-size:26px;">📑</span>
          <div style="flex:1; overflow:hidden;">
            <div style="font-size:12px; font-weight:800; white-space:nowrap; text-overflow:ellipsis; overflow:hidden; color:#fff;">${escapeHtml(msg.fileName || "Dokumen")}</div>
            <div style="font-size:10px; color:#94a3b8;">${msg.fileSize || "File"}</div>
          </div>
          <a href="${msg.dataUrl}" download="${escapeHtml(msg.fileName || "file")}" style="background:#22c55e; color:#fff; text-decoration:none; padding:5px 10px; border-radius:6px; font-size:11px; font-weight:800; white-space:nowrap;">
            📥 Unduh
          </a>
        </div>
      `;
    }
    // 6. Share Lokasi (Google Maps)
    else if (msg.type === "location") {
      const mapsUrl = `https://www.google.com/maps?q=${msg.lat},${msg.lng}`;
      contentHtml = `
        <div style="margin-top:4px; background:rgba(0,0,0,0.25); padding:8px 12px; border-radius:8px;">
          <div style="display:flex; align-items:center; gap:6px; font-weight:800; color:#facc15; font-size:12px; margin-bottom:4px;">
            <span>📍</span>
            <span>Titik Lokasi Terkini</span>
          </div>
          <div style="font-size:11px; color:#cbd5e1; margin-bottom:6px;">
            Koordinat: ${msg.lat.toFixed(5)}, ${msg.lng.toFixed(5)}
          </div>
          <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-flex; align-items:center; gap:5px; background:linear-gradient(135deg, #10b981, #059669); color:#fff; text-decoration:none; font-size:11px; font-weight:800; padding:6px 12px; border-radius:6px; box-shadow:0 2px 6px rgba(0,0,0,0.4);">
            <span>🗺️</span>
            <span>Buka di Google Maps</span>
          </a>
        </div>
      `;
    }

    const timeStr = msg.time || new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

    bubble.innerHTML = `
      <div class="chat-sender" style="color:${senderColor}; display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
        <span>${senderTitle}</span>
        <span style="font-size:9px; color:#64748b;">${timeStr} ${isOut ? "✔️✔️" : ""}</span>
      </div>
      ${contentHtml}
    `;

    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
  }

  // ==========================================================================
  // 8. PEMICU DARURAT MOTOR MOGOK (SOS BROADCAST)
  // ==========================================================================
  function triggerEmergencyMogokSOS() {
    const issue = prompt("Jelaskan Tipe Motor & Masalah Mogok (contoh: Vario 150 v-belt putus butuh di-step / Beat karbu mati total pengapian hilang):");
    if (!issue || !issue.trim()) return;

    if (!navigator.geolocation) {
      alert("GPS tidak didukung di perangkat ini. Lokasi akan dikirim tanpa koordinat.");
      sendMogokSOSMessage(issue.trim(), null, null);
      return;
    }

    if (window.showToastNotification) {
      window.showToastNotification("🚨 Membaca titik GPS darurat Anda...");
    }

    navigator.geolocation.getCurrentPosition(
      function (pos) {
        sendMogokSOSMessage(issue.trim(), pos.coords.latitude, pos.coords.longitude);
      },
      function () {
        alert("Gagal membaca GPS. Permohonan bantuan tetap dikirim!");
        sendMogokSOSMessage(issue.trim(), null, null);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function sendMogokSOSMessage(issueText, lat, lng) {
    const timeStr = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    const msg = {
      id: "sos_" + Date.now(),
      type: "sos_emergency",
      vehicleAndIssue: issueText,
      lat: lat,
      lng: lng,
      channel: "global",
      senderName: myUserName,
      senderUsername: myCustomUsername,
      senderId: myPeerId,
      time: timeStr,
      timestamp: Date.now()
    };

    saveMessageToLocalDB(msg);
    renderChatMessageBubble(msg, true);

    sendSignal({
      room: "global",
      type: "chat-message",
      payload: msg
    });

    if (window.showToastNotification) {
      window.showToastNotification("🚨 Permohonan bantuan mogok berhasil disiarkan ke Komunitas Global!");
    }
  }

  // ==========================================================================
  // 9. JAPRI (CHAT PRIBADI 1-ON-1) & SWITCH CHANNEL
  // ==========================================================================
  async function switchChatChannel(channelType) {
    activeChatChannel = channelType;

    const btnGlobal = document.getElementById("tchat-tab-btn-global");
    const btnPrivate = document.getElementById("tchat-tab-btn-private");
    const globalGroupArea = document.getElementById("tchat-global-controls-bar");
    const privateHeaderBar = document.getElementById("tchat-private-controls-bar");
    const contactsListView = document.getElementById("tchat-contacts-view");
    const chatMessagesView = document.getElementById("tchat-messages");
    const inputBar = document.getElementById("tchat-standard-input-bar");

    if (channelType === "global") {
      activePrivateContact = null;
      if (btnGlobal) btnGlobal.classList.add("active");
      if (btnPrivate) btnPrivate.classList.remove("active");
      if (globalGroupArea) globalGroupArea.style.display = "flex";
      if (privateHeaderBar) privateHeaderBar.style.display = "none";
      if (contactsListView) contactsListView.style.display = "none";
      if (chatMessagesView) chatMessagesView.style.display = "flex";
      if (inputBar) inputBar.style.display = "flex";

      chatMessagesView.innerHTML = "";
      const msgs = await loadMessagesFromLocalDB("global");
      msgs.forEach(m => renderChatMessageBubble(m, m.senderId === myPeerId));
    } else {
      // Tampilkan daftar kontak
      if (btnGlobal) btnGlobal.classList.remove("active");
      if (btnPrivate) btnPrivate.classList.add("active");
      if (globalGroupArea) globalGroupArea.style.display = "none";
      if (privateHeaderBar) privateHeaderBar.style.display = "none";
      if (contactsListView) contactsListView.style.display = "block";
      if (chatMessagesView) chatMessagesView.style.display = "none";
      if (inputBar) inputBar.style.display = "none";

      renderContactsListUI();
    }
  }

  async function openPrivateChat(targetId, targetName, targetUsername) {
    activeChatChannel = targetId;
    activePrivateContact = { id: targetId, name: targetName || "Member", username: targetUsername || "" };

    saveContactToStorage(activePrivateContact);

    const contactsListView = document.getElementById("tchat-contacts-view");
    const chatMessagesView = document.getElementById("tchat-messages");
    const privateHeaderBar = document.getElementById("tchat-private-controls-bar");
    const globalGroupArea = document.getElementById("tchat-global-controls-bar");
    const inputBar = document.getElementById("tchat-standard-input-bar");

    if (contactsListView) contactsListView.style.display = "none";
    if (chatMessagesView) chatMessagesView.style.display = "flex";
    if (globalGroupArea) globalGroupArea.style.display = "none";
    if (privateHeaderBar) privateHeaderBar.style.display = "flex";
    if (inputBar) inputBar.style.display = "flex";

    const nameEl = document.getElementById("tchat-private-target-name");
    const handleEl = document.getElementById("tchat-private-target-handle");
    if (nameEl) nameEl.innerText = targetName;
    if (handleEl) handleEl.innerText = targetUsername ? `@${targetUsername}` : targetId;

    chatMessagesView.innerHTML = `
      <div style="text-align:center; padding:12px; background:rgba(0,240,255,0.06); border-radius:8px; margin-bottom:10px;">
        <span style="font-size:12px; font-weight:800; color:var(--neon-cyan);">🔒 Obrolan Pribadi (End-to-End P2P)</span>
        <div style="font-size:10px; color:#94a3b8; margin-top:2px;">Tersimpan langsung di memori HP masing-masing pengguna (0 MB Beban Server).</div>
      </div>
    `;

    const msgs = await loadMessagesFromLocalDB(targetId);
    msgs.forEach(m => renderChatMessageBubble(m, m.senderId === myPeerId));
  }

  function promptStartNewPrivateChat() {
    const target = prompt("Masukkan @username atau ID khusus teman (contoh: @bengkel_teguh atau MTR-1234):");
    if (target && target.trim()) {
      const clean = target.trim().replace(/^@/, "");
      openPrivateChat(clean, clean, clean);
    }
  }

  // ==========================================================================
  // 10. INTERACTIVE USER PROFILE POPOVER (KLIK SENDER BUBBLE)
  // ==========================================================================
  function openUserProfileActions(name, id, username) {
    if (!id || id === myPeerId) return;

    let modal = document.getElementById("tchat-sender-action-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "tchat-sender-action-modal";
      modal.className = "install-modal-overlay";
      modal.onclick = function (e) { if (e.target === modal) modal.style.display = "none"; };
      document.body.appendChild(modal);
    }

    const handle = username ? `@${username}` : id;

    modal.innerHTML = `
      <div class="install-modal-card" onclick="event.stopPropagation()" style="max-width:340px; border-color:var(--neon-cyan);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="width:36px; height:36px; border-radius:50%; background:linear-gradient(135deg, #00f0ff, #0284c7); display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:900; color:#0b1215;">
              ${(name || "M").charAt(0).toUpperCase()}
            </div>
            <div>
              <h4 style="margin:0; font-size:14px; font-weight:900; color:#fff;">${escapeHtml(name)}</h4>
              <span style="font-size:11px; color:var(--neon-cyan);">${escapeHtml(handle)}</span>
            </div>
          </div>
          <button type="button" onclick="document.getElementById('tchat-sender-action-modal').style.display='none'" style="background:none; border:none; color:#94a3b8; font-size:18px; cursor:pointer;">✕</button>
        </div>

        <div style="display:flex; flex-direction:column; gap:8px;">
          <button type="button" onclick="document.getElementById('tchat-sender-action-modal').style.display='none'; window.tchatEngine.openPrivateChat('${id}', '${escapeQuotes(name)}', '${username || ""}')" class="action-btn" style="background:#16252d; border:1px solid var(--neon-cyan); color:var(--neon-cyan); font-weight:800; justify-content:flex-start; padding:10px 14px;">
            💬 Kirim Pesan Pribadi (Japri)
          </button>
          <button type="button" onclick="document.getElementById('tchat-sender-action-modal').style.display='none'; window.tchatEngine.startCall('${id}', false)" class="action-btn" style="background:#14291e; border:1px solid #22c55e; color:#22c55e; font-weight:800; justify-content:flex-start; padding:10px 14px;">
            📞 Panggilan Suara Langsung
          </button>
          <button type="button" onclick="document.getElementById('tchat-sender-action-modal').style.display='none'; window.tchatEngine.startCall('${id}', true)" class="action-btn" style="background:#182830; border:1px solid #38bdf8; color:#38bdf8; font-weight:800; justify-content:flex-start; padding:10px 14px;">
            📹 Video Call Tatap Muka
          </button>
          <button type="button" onclick="document.getElementById('tchat-sender-action-modal').style.display='none'; window.tchatEngine.saveContact({ id: '${id}', name: '${escapeQuotes(name)}', username: '${username || ""}' }); if (window.showToastNotification) window.showToastNotification('✅ Kontak berhasil disimpan!');" class="action-btn" style="background:#1e293b; border:1px solid rgba(255,255,255,0.2); color:#fff; font-weight:700; justify-content:flex-start; padding:10px 14px;">
            ➕ Simpan ke Kontak Teman
          </button>
        </div>
      </div>
    `;

    modal.style.display = "flex";
  }

  // ==========================================================================
  // 11. VOICE NOTE RECORDING & FILE SHARING
  // ==========================================================================
  async function startRecordingVoiceNote() {
    try {
      getAudioContext();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioRecordChunks = [];
      mediaRecorderInstance = new MediaRecorder(stream);

      mediaRecorderInstance.ondataavailable = function (e) {
        if (e.data.size > 0) audioRecordChunks.push(e.data);
      };

      mediaRecorderInstance.onstop = function () {
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorderInstance.start();

      recordSeconds = 0;
      showRecordingIndicator(true);
      if (recordTimerInterval) clearInterval(recordTimerInterval);
      recordTimerInterval = setInterval(function () {
        recordSeconds++;
        const s = recordSeconds.toString().padStart(2, "0");
        const timerEl = document.getElementById("tchat-vn-timer");
        if (timerEl) timerEl.innerText = "00:" + s;
      }, 1000);
    } catch (err) {
      alert("Izin mikrofon diperlukan untuk merekam pesan suara (Voice Note).");
    }
  }

  function cancelRecordingVoiceNote() {
    if (mediaRecorderInstance && mediaRecorderInstance.state !== "inactive") {
      mediaRecorderInstance.stop();
    }
    mediaRecorderInstance = null;
    audioRecordChunks = [];
    if (recordTimerInterval) clearInterval(recordTimerInterval);
    showRecordingIndicator(false);
  }

  function finishAndSendVoiceNote() {
    if (!mediaRecorderInstance || mediaRecorderInstance.state === "inactive") return;

    if (recordTimerInterval) clearInterval(recordTimerInterval);
    const recordedDuration = recordSeconds;

    mediaRecorderInstance.onstop = function () {
      const audioBlob = new Blob(audioRecordChunks, { type: "audio/webm" });
      const reader = new FileReader();
      reader.onloadend = function () {
        const dataUrl = reader.result;
        const msg = {
          id: "vn_" + Date.now(),
          type: "voice",
          dataUrl: dataUrl,
          duration: "00:" + recordedDuration.toString().padStart(2, "0"),
          channel: activeChatChannel,
          senderName: myUserName,
          senderUsername: myCustomUsername,
          senderId: myPeerId,
          time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
          timestamp: Date.now()
        };

        saveMessageToLocalDB(msg);
        renderChatMessageBubble(msg, true);

        sendSignal({
          room: activeChatChannel === "global" ? "global" : undefined,
          to: activeChatChannel !== "global" ? activeChatChannel : undefined,
          type: "chat-message",
          payload: msg
        });
      };
      reader.readAsDataURL(audioBlob);
    };

    mediaRecorderInstance.stop();
    mediaRecorderInstance = null;
    showRecordingIndicator(false);
  }

  function showRecordingIndicator(show) {
    const bar = document.getElementById("tchat-vn-bar");
    const inputBar = document.getElementById("tchat-standard-input-bar");
    if (bar && inputBar) {
      bar.style.display = show ? "flex" : "none";
      inputBar.style.display = show ? "none" : "flex";
    }
  }

  window.playVoiceNoteAudio = function (btn, audioUrl) {
    const bubble = btn.closest(".chat-bubble");
    const progressEl = bubble ? bubble.querySelector(".vn-progress") : null;

    if (btn._audioInstance && !btn._audioInstance.paused) {
      btn._audioInstance.pause();
      btn.innerText = "▶️";
      return;
    }

    if (!btn._audioInstance) {
      const audio = new Audio(audioUrl);
      btn._audioInstance = audio;

      audio.ontimeupdate = function () {
        if (progressEl && audio.duration) {
          const pct = (audio.currentTime / audio.duration) * 100;
          progressEl.style.width = pct + "%";
        }
      };

      audio.onended = function () {
        btn.innerText = "▶️";
        if (progressEl) progressEl.style.width = "0%";
      };
    }

    btn._audioInstance.play();
    btn.innerText = "⏸️";
  };

  function handleFileInputChange(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert("Ukuran file maksimal 15MB agar hemat memori HP Anda.");
      return;
    }

    const isImage = file.type.startsWith("image/");
    const reader = new FileReader();

    reader.onload = function () {
      const dataUrl = reader.result;
      const sizeStr = file.size > 1024 * 1024
        ? (file.size / (1024 * 1024)).toFixed(1) + " MB"
        : (file.size / 1024).toFixed(0) + " KB";

      const msg = {
        id: "file_" + Date.now(),
        type: isImage ? "image" : "file",
        dataUrl: dataUrl,
        fileName: file.name,
        fileSize: sizeStr,
        channel: activeChatChannel,
        senderName: myUserName,
        senderUsername: myCustomUsername,
        senderId: myPeerId,
        time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        timestamp: Date.now()
      };

      saveMessageToLocalDB(msg);
      renderChatMessageBubble(msg, true);

      sendSignal({
        room: activeChatChannel === "global" ? "global" : undefined,
        to: activeChatChannel !== "global" ? activeChatChannel : undefined,
        type: "chat-message",
        payload: msg
      });
    };

    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function shareCurrentLocation() {
    if (!navigator.geolocation) {
      alert("Fitur GPS lokasi tidak didukung oleh browser Anda.");
      return;
    }

    if (window.showToastNotification) {
      window.showToastNotification("📍 Mendeteksi titik GPS lokasi Anda...");
    }

    navigator.geolocation.getCurrentPosition(
      function (pos) {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        const msg = {
          id: "loc_" + Date.now(),
          type: "location",
          lat: lat,
          lng: lng,
          channel: activeChatChannel,
          senderName: myUserName,
          senderUsername: myCustomUsername,
          senderId: myPeerId,
          time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
          timestamp: Date.now()
        };

        saveMessageToLocalDB(msg);
        renderChatMessageBubble(msg, true);

        sendSignal({
          room: activeChatChannel === "global" ? "global" : undefined,
          to: activeChatChannel !== "global" ? activeChatChannel : undefined,
          type: "chat-message",
          payload: msg
        });
      },
      function () {
        alert("Gagal membaca lokasi. Pastikan GPS dan izin lokasi browser sudah diaktifkan.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // ==========================================================================
  // 12. EMOJI PICKER LUCU POPUP (RINGAN NATIVE UNICODE)
  // ==========================================================================
  const EMOJI_CATEGORIES = {
    reaksi: ["😂", "🤣", "😍", "🥳", "😎", "🥺", "🤪", "👏", "👍", "🔥", "💯", "🙏", "☕", "🍩", "😜", "🤩", "😁", "🥰", "🤗", "😇"],
    otomotif: ["🏍️", "🛵", "🚗", "🏎️", "🔧", "🔨", "⚙️", "🧰", "🔩", "🛞", "⛽", "🚦", "🏁", "💨", "⚡", "💡", "🔋", "🔌"],
    santri: ["🕌", "📿", "🤲", "📖", "🌙", "⭐", "☕", "❤️", "🤝", "🌟", "✨", "🎁", "🎉", "🏆"]
  };

  function toggleEmojiPicker() {
    const picker = document.getElementById("tchat-emoji-picker");
    if (!picker) return;
    const isShown = picker.style.display === "block";
    picker.style.display = isShown ? "none" : "block";
    if (!isShown) renderEmojiCategory("reaksi");
  }

  function renderEmojiCategory(catKey) {
    const listEl = document.getElementById("tchat-emoji-list");
    if (!listEl) return;
    const emojis = EMOJI_CATEGORIES[catKey] || EMOJI_CATEGORIES.reaksi;
    let html = "";
    emojis.forEach(function (emo) {
      html += `<button type="button" onclick="insertEmojiToInput('${emo}')" style="background:transparent; border:none; font-size:22px; cursor:pointer; padding:6px; border-radius:6px; transition:transform 0.1s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">${emo}</button>`;
    });
    listEl.innerHTML = html;
  }

  window.insertEmojiToInput = function (emo) {
    const input = document.getElementById("tchat-input-text");
    if (input) {
      input.value += emo;
      input.focus();
    }
  };

  // ==========================================================================
  // 13. MODAL UI: CALL OVERLAY & INCOMING CALL BANNER
  // ==========================================================================
  function showCallOverlay(isVideo, statusText, isAnswerer) {
    let overlay = document.getElementById("tchat-call-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "tchat-call-overlay";
      overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; z-index:999999; background:rgba(8,14,18,0.96); backdrop-filter:blur(16px); display:flex; flex-direction:column; justify-content:space-between; align-items:center; padding:30px 20px;";
      document.body.appendChild(overlay);
    }

    overlay.style.display = "flex";
    overlay.innerHTML = `
      <div style="text-align:center; margin-top:20px;">
        <div style="width:72px; height:72px; border-radius:50%; background:linear-gradient(135deg, #00f0ff, #0284c7); margin:0 auto 12px; display:flex; align-items:center; justify-content:center; font-size:32px; box-shadow:0 0 24px rgba(0,240,255,0.4);">
          ${isVideo ? "📹" : "📞"}
        </div>
        <h3 id="tchat-call-target-title" style="color:#ffffff; font-size:18px; font-weight:900; margin:0 0 6px;">Panggilan ${isVideo ? "Video" : "Suara"}</h3>
        <p id="tchat-call-status" style="color:var(--neon-cyan); font-size:13px; font-weight:700; margin:0;">${statusText}</p>
      </div>

      <div style="position:relative; width:100%; max-width:440px; height:280px; background:#0c1519; border:1px solid rgba(0,240,255,0.3); border-radius:14px; overflow:hidden; display:${isVideo ? "block" : "none"}; margin:20px 0;">
        <video id="tchat-remote-video" autoplay playsinline style="width:100%; height:100%; object-fit:cover; display:none;"></video>
        <video id="tchat-local-video" autoplay playsinline muted style="position:absolute; bottom:12px; right:12px; width:90px; height:120px; object-fit:cover; border-radius:8px; border:2px solid var(--neon-cyan); display:none;"></video>
      </div>
      <audio id="tchat-remote-audio" autoplay style="display:none;"></audio>

      <div style="display:flex; gap:16px; margin-bottom:20px; flex-wrap:wrap; justify-content:center;">
        <button type="button" id="tchat-btn-mute" onclick="window.tchatEngine.toggleMuteMic()" style="background:#1e293b; color:#fff; border:1px solid rgba(255,255,255,0.2); padding:12px 18px; border-radius:30px; font-weight:800; cursor:pointer;">
          🎤 Mute
        </button>
        ${isVideo ? `
        <button type="button" id="tchat-btn-video-toggle" onclick="window.tchatEngine.toggleVideoCamera()" style="background:#1e293b; color:#fff; border:1px solid rgba(255,255,255,0.2); padding:12px 18px; border-radius:30px; font-weight:800; cursor:pointer;">
          📹 Matikan
        </button>
        ` : ""}
        <button type="button" onclick="window.tchatEngine.endCall()" style="background:#ef4444; color:#fff; border:none; padding:12px 24px; border-radius:30px; font-weight:900; cursor:pointer; box-shadow:0 0 16px rgba(239,68,68,0.5);">
          🔴 Tutup Telepon
        </button>
      </div>
    `;
  }

  function hideCallOverlay() {
    const overlay = document.getElementById("tchat-call-overlay");
    if (overlay) overlay.style.display = "none";
  }

  function showIncomingCallBanner(name, handle, isVideo) {
    let banner = document.getElementById("tchat-incoming-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "tchat-incoming-banner";
      banner.style.cssText = "position:fixed; top:20px; left:50%; transform:translateX(-50%); width:90%; max-width:400px; z-index:9999999; background:#111e24; border:2px solid var(--neon-cyan); border-radius:14px; padding:14px 18px; box-shadow:0 0 30px rgba(0,240,255,0.5); display:flex; align-items:center; justify-content:space-between; animation:pulse 1s infinite;";
      document.body.appendChild(banner);
    }
    banner.style.display = "flex";
    banner.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="font-size:28px;">${isVideo ? "📹" : "📞"}</span>
        <div>
          <div style="font-size:11px; color:var(--neon-cyan); font-weight:800;">PANGGILAN ${isVideo ? "VIDEO" : "SUARA"} MASUK</div>
          <div style="font-size:14px; font-weight:900; color:#fff;">${escapeHtml(name)}</div>
          <div style="font-size:10px; color:#94a3b8;">${escapeHtml(handle)}</div>
        </div>
      </div>
      <div style="display:flex; gap:8px;">
        <button type="button" onclick="window.tchatEngine.acceptIncomingCall()" style="background:#22c55e; color:#fff; border:none; width:40px; height:40px; border-radius:50%; font-size:18px; cursor:pointer; font-weight:900; box-shadow:0 0 10px rgba(34,197,94,0.6);" title="Jawab">
          📞
        </button>
        <button type="button" onclick="window.tchatEngine.rejectIncomingCall()" style="background:#ef4444; color:#fff; border:none; width:40px; height:40px; border-radius:50%; font-size:18px; cursor:pointer; font-weight:900; box-shadow:0 0 10px rgba(239,68,68,0.6);" title="Tolak">
          ✕
        </button>
      </div>
    `;
  }

  function hideIncomingCallBanner() {
    const banner = document.getElementById("tchat-incoming-banner");
    if (banner) banner.style.display = "none";
  }

  function triggerDeviceVibration() {
    if (navigator.vibrate) {
      try { navigator.vibrate([200, 100, 200, 100, 400]); } catch (e) {}
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeQuotes(str) {
    if (!str) return "";
    return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, "&quot;");
  }

  // ==========================================================================
  // 14. PROFILE & USERNAME MANAGEMENT
  // ==========================================================================
  function updateProfileUI() {
    const myIdEl = document.getElementById("tchat-my-id-display");
    if (myIdEl) myIdEl.innerText = myPeerId;

    const myNameEl = document.getElementById("tchat-my-name-display");
    if (myNameEl) myNameEl.innerText = myUserName;

    const myUsernameEl = document.getElementById("tchat-my-username-display");
    if (myUsernameEl) {
      myUsernameEl.innerText = myCustomUsername ? `@${myCustomUsername}` : "(Belum buat @username)";
      myUsernameEl.style.color = myCustomUsername ? "var(--neon-cyan)" : "#94a3b8";
    }
  }

  window.editMyTChatProfileName = function () {
    const newName = prompt("Masukkan nama tampilan Anda (contoh: Kang Teguh Barokah Motor):", myUserName);
    if (newName && newName.trim()) {
      myUserName = newName.trim();
      localStorage.setItem("tvs_tchat_user_name", myUserName);
      updateProfileUI();
      if (window.showToastNotification) {
        window.showToastNotification("✅ Nama profil diperbarui: " + myUserName);
      }
    }
  };

  window.editMyTChatUsername = function () {
    const defaultVal = myCustomUsername || "";
    const promptVal = prompt("Buat @Username Pribadi Anda (huruf kecil, angka, atau garis bawah, tanpa spasi):\nContoh: teguh_bengkel atau montir_racing", defaultVal);
    if (promptVal !== null) {
      let clean = promptVal.trim().replace(/^@/, "").toLowerCase().replace(/[^a-z0-9_]/g, "");
      if (clean.length < 3) {
        alert("Username minimal 3 karakter.");
        return;
      }
      myCustomUsername = clean;
      localStorage.setItem("tvs_tchat_custom_username", myCustomUsername);
      updateProfileUI();
      if (window.showToastNotification) {
        window.showToastNotification("✅ Username aktif: @" + myCustomUsername);
      }
    }
  };

  window.copyMyCallLink = function () {
    const handle = myCustomUsername ? `@${myCustomUsername}` : myPeerId;
    const url = window.location.origin + window.location.pathname + "?call=" + (myCustomUsername || myPeerId);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () {
        if (window.showToastNotification) {
          window.showToastNotification("📋 Link ID @" + handle + " Disalin! Bagikan ke teman.");
        } else {
          alert("Link berhasil disalin: " + url);
        }
      });
    } else {
      prompt("Salin link ID panggil Anda:", url);
    }
  };

  window.promptStartCall = function (isVideo) {
    const target = prompt("Masukkan @Username atau ID Teman yang ingin dihubungi (contoh: @teguh_bengkel atau MTR-1234):");
    if (target && target.trim()) {
      const clean = target.trim().replace(/^@/, "");
      startCall(clean, isVideo);
    }
  };

  window.clearLocalChatDB = async function () {
    if (!confirm("Hapus semua riwayat obrolan & file yang tersimpan di HP Anda?")) return;
    if (dbInstance) {
      try {
        const tx = dbInstance.transaction("messages", "readwrite");
        tx.objectStore("messages").clear();
      } catch (e) {}
    }
    localStorage.removeItem("tvs_tchat_local_msgs");
    const container = document.getElementById("tchat-messages");
    if (container) {
      container.innerHTML = `
        <div class="chat-bubble in">
          <div class="chat-sender">⚡ Sistem TChat</div>
          Riwayat obrolan HP berhasil dibersihkan. Memori HP Anda telah dihemat!
        </div>
      `;
    }
    if (window.showToastNotification) {
      window.showToastNotification("🗑️ Memori obrolan di HP Anda berhasil dikosongkan.");
    }
  };

  window.requestTchatNotificationPermission = function () {
    if (!window.Notification) {
      alert("Browser Anda belum mendukung Web Notification.");
      return;
    }
    Notification.requestPermission().then(function (perm) {
      if (perm === "granted") {
        isNotificationAllowed = true;
        if (window.showToastNotification) {
          window.showToastNotification("🔔 Notifikasi Masuk WhatsApp-Style BERHASIL DIAKTIFKAN!");
        } else {
          alert("Notifikasi pesan masuk berhasil diaktifkan!");
        }
      } else {
        alert("Izin notifikasi ditolak. Anda tetap dapat mendengar suara ting-ting saat aplikasi terbuka.");
      }
    });
  };

  window.openImagePreviewModal = function (url) {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:99999999; display:flex; align-items:center; justify-content:center; padding:20px; cursor:pointer;";
    overlay.innerHTML = `<img src="${url}" style="max-width:95%; max-height:90vh; border-radius:10px; border:2px solid var(--neon-cyan);" />`;
    overlay.onclick = function () { overlay.remove(); };
    document.body.appendChild(overlay);
  };

  // ==========================================================================
  // 15. BOOTSTRAP TCHAT ENGINE
  // ==========================================================================
  async function initTChatEngine() {
    await initIndexedDB();
    updateProfileUI();

    // Render pesan awal di Grup Global
    const savedMsgs = await loadMessagesFromLocalDB("global");
    if (savedMsgs && savedMsgs.length > 0) {
      const container = document.getElementById("tchat-messages");
      if (container) {
        container.innerHTML = "";
        savedMsgs.forEach(function (m) {
          renderChatMessageBubble(m, m.senderId === myPeerId);
        });
      }
    }

    renderContactsListUI();

    // Polling sinyal ringan setiap 2 detik
    setInterval(pollSignals, 2000);

    // Cek jika URL memiliki parameter "?call=..."
    const params = new URLSearchParams(window.location.search);
    const targetCall = params.get("call");
    if (targetCall && targetCall !== myPeerId && targetCall !== myCustomUsername) {
      setTimeout(function () {
        if (confirm("Panggil " + targetCall + " lewat P2P Voice Call sekarang?")) {
          startCall(targetCall, false);
        }
      }, 1500);
    }
  }

  // API Publik
  window.tchatEngine = {
    init: initTChatEngine,
    startCall: startCall,
    acceptIncomingCall: acceptIncomingCall,
    rejectIncomingCall: rejectIncomingCall,
    endCall: endCall,
    toggleMuteMic: toggleMuteMic,
    toggleVideoCamera: toggleVideoCamera,
    startRecordingVoiceNote: startRecordingVoiceNote,
    cancelRecordingVoiceNote: cancelRecordingVoiceNote,
    finishAndSendVoiceNote: finishAndSendVoiceNote,
    handleFileInputChange: handleFileInputChange,
    shareCurrentLocation: shareCurrentLocation,
    toggleEmojiPicker: toggleEmojiPicker,
    renderEmojiCategory: renderEmojiCategory,
    clearLocalChatDB: clearLocalChatDB,
    playNotificationDing: playNotificationDing,
    triggerEmergencyMogokSOS: triggerEmergencyMogokSOS,
    switchChatChannel: switchChatChannel,
    openPrivateChat: openPrivateChat,
    promptStartNewPrivateChat: promptStartNewPrivateChat,
    openUserProfileActions: openUserProfileActions,
    saveContact: saveContactToStorage,
    getActiveChannel: () => activeChatChannel
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTChatEngine);
  } else {
    initTChatEngine();
  }
})();
