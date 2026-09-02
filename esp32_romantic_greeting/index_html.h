#ifndef INDEX_HTML_H
#define INDEX_HTML_H

#include <pgmspace.h>

const char index_html[] PROGMEM = R"=====(
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Pesan Khusus Untukmu ✨</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-dark: #0f0a02;
      --primary: #ffb703;
      --primary-glow: rgba(255, 183, 3, 0.4);   
      --secondary: #ffd166;
      --accent: #fff3b0;
      --gold: #ffc300;
      --orange: #fb8500;
      --glass: rgba(25, 17, 5, 0.7);
      --glass-border: rgba(255, 215, 0, 0.25);
      --text: #ffffff;
      --text-sub: #eddcd2;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; }

    body {
      background-color: var(--bg-dark);
      background-image: 
        radial-gradient(circle at 20% 20%, rgba(255, 183, 3, 0.2) 0%, transparent 45%),
        radial-gradient(circle at 80% 80%, rgba(251, 133, 0, 0.18) 0%, transparent 45%),
        radial-gradient(circle at 50% 50%, #140d03 0%, #080501 100%);
      color: var(--text);
      font-family: 'Outfit', sans-serif;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      overflow-x: hidden;
      position: relative;
      padding: 20px 15px;
    }

    #canvas-hearts { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1; }

    .container { width: 100%; max-width: 440px; z-index: 10; display: flex; flex-direction: column; gap: 20px; position: relative; }

    .glass-card {
      background: var(--glass);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--glass-border);
      border-radius: 24px;
      padding: 24px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 235, 150, 0.2);
      text-align: center;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
      pointer-events: auto;
    }

    .music-widget {
      position: fixed; top: 20px; right: 20px; z-index: 100;
      display: flex; align-items: center; gap: 10px;
      background: rgba(25, 17, 5, 0.85); backdrop-filter: blur(12px);
      border: 1px solid var(--glass-border); padding: 6px 16px 6px 8px;
      border-radius: 30px; box-shadow: 0 6px 25px rgba(0,0,0,0.6);
      pointer-events: auto; transition: all 0.3s ease;
    }
    .music-btn {
      width: 38px; height: 38px; border-radius: 50%;
      background: linear-gradient(135deg, var(--gold), var(--orange));
      color: #0f0a02; font-size: 16px; display: flex;
      justify-content: center; align-items: center; cursor: pointer;
      box-shadow: 0 2px 10px var(--primary-glow); transition: transform 0.2s ease;
    }
    .music-btn:active { transform: scale(0.9); }
    .music-btn.playing { animation: pulse 1.8s infinite; }
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(255, 183, 3, 0.6); }
      70% { box-shadow: 0 0 0 12px rgba(255, 183, 3, 0); }
      100% { box-shadow: 0 0 0 0 rgba(255, 183, 3, 0); }
    }
    .music-info { text-align: left; }
    .music-title { font-size: 0.78rem; font-weight: 700; color: var(--secondary); white-space: nowrap; }
    .music-artist { font-size: 0.7rem; color: var(--text-sub); }

    .badge {
      display: inline-block; padding: 6px 16px; border-radius: 20px;
      background: linear-gradient(135deg, rgba(255,183,3,0.25), rgba(251,133,0,0.25));
      border: 1px solid rgba(255, 183, 3, 0.4); color: var(--secondary);
      font-size: 0.85rem; font-weight: 700; letter-spacing: 1px; margin-bottom: 15px; text-transform: uppercase;
    }

    .content-section { display: flex; flex-direction: column; gap: 20px; opacity: 1; transform: translateY(0); }

    .letter-box { text-align: left; position: relative; overflow: hidden; border-color: rgba(255, 183, 3, 0.3); }
    .letter-title { font-family: 'Caveat', cursive; font-size: 2.3rem; color: var(--secondary); margin-bottom: 12px; }
    .letter-body { font-size: 1.05rem; line-height: 1.7; color: #f3e9dc; white-space: pre-line; margin-bottom: 15px; }
    .letter-signature { font-family: 'Caveat', cursive; font-size: 1.9rem; color: var(--gold); text-align: right; }

    .polaroid { background: #ffffff; padding: 12px 12px 25px 12px; border-radius: 4px; box-shadow: 0 10px 25px rgba(0,0,0,0.6); transform: rotate(-2deg); transition: transform 0.3s ease; margin: 10px auto; max-width: 280px; }
    .polaroid:hover { transform: rotate(0deg) scale(1.03); }
    .polaroid-img { width: 100%; height: 200px; object-fit: cover; border-radius: 2px; background-color: #fff9e6; display: flex; align-items: center; justify-content: center; font-size: 48px; }
    .polaroid-caption { font-family: 'Caveat', cursive; color: #332200; font-size: 1.4rem; margin-top: 10px; text-align: center; font-weight: 700; }

    footer { color: rgba(255, 235, 180, 0.4); font-size: 0.75rem; text-align: center; margin-top: 10px; }
  </style>
</head>
<body onclick="enableAudioDirectly(event)">

  <canvas id="canvas-hearts"></canvas>

  <audio id="audioPlayer" loop preload="auto">
    <source src="bergema.mp3" type="audio/mpeg">
    <source src="https://files.catbox.moe/q91a8m.mp3" type="audio/mpeg">
  </audio>

  <div class="music-widget">
    <div class="music-btn" id="musicToggle" onclick="userToggleMusic(event)" title="Putar Musik">▶</div>
    <div class="music-info">
      <div class="music-title">Bergema Sampai Selamanya</div>
      <div class="music-artist">Nadhif Basalamah 🎶</div>
    </div>
  </div>

  <div class="container">
    <div class="content-section" id="mainContent">
      <div class="glass-card letter-box">
        <div class="badge">Spesial Untukmu ✨</div>
        <h2 class="letter-title">Hai Sayang, ✨</h2>
        <div class="letter-body">
Terima kasih ya sudah selalu ada dan bikin hari-hariku jadi jauh lebih berwarna. 

Setiap momen sama kamu itu selalu berharga. Semoga kita bisa terus jalan bareng, saling dukung, dan bahagia terus sama-sama ya! 🌟
        </div>
        <div class="letter-signature">- Seseorang yang selalu menyayangimu 💛</div>
      </div>

      <div class="glass-card">
        <div class="badge">Momen Manis 📸</div>
        <div class="polaroid">
          <div class="polaroid-img">👩‍❤️‍👨</div>
          <div class="polaroid-caption">Senyuman favoritku setiap hari ✨</div>
        </div>
      </div>

      <footer>Dibuat khusus menggunakan ESP32 & Cinta 💛</footer>
    </div>
  </div>

  <script>
    let audioCtx = null;
    let isPlaying = false;
    let synthRunning = false;
    let synthTimer = null;
    const musicBtn = document.getElementById('musicToggle');
    const audioPlayer = document.getElementById('audioPlayer');

    const melodyNotes = [
      { note: 523.25, duration: 0.5 }, { note: 659.25, duration: 0.5 }, { note: 783.99, duration: 0.5 }, { note: 1046.50, duration: 1.0 },
      { note: 493.88, duration: 0.5 }, { note: 587.33, duration: 0.5 }, { note: 783.99, duration: 0.5 }, { note: 987.77, duration: 1.0 },
      { note: 440.00, duration: 0.5 }, { note: 523.25, duration: 0.5 }, { note: 659.25, duration: 0.5 }, { note: 880.00, duration: 1.0 },
      { note: 349.23, duration: 0.5 }, { note: 440.00, duration: 0.5 }, { note: 523.25, duration: 0.5 }, { note: 698.46, duration: 1.0 }
    ];
    let noteIdx = 0;

    function initAudioCtx() {
      try {
        if (!audioCtx) {
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
      } catch (err) {}
    }

    function startSynthMelody() {
      if (synthRunning) return;
      initAudioCtx();
      synthRunning = true;
      playNextPianoNote();
    }

    function playNextPianoNote() {
      if (!isPlaying || !synthRunning || !audioCtx) return;

      try {
        const item = melodyNotes[noteIdx];
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(item.note, audioCtx.currentTime);

        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.25, audioCtx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + item.duration);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + item.duration);

        noteIdx = (noteIdx + 1) % melodyNotes.length;
        synthTimer = setTimeout(playNextPianoNote, item.duration * 1000);
      } catch (e) {}
    }

    function enableAudioDirectly(e) {
      if (isPlaying) return;

      initAudioCtx();
      isPlaying = true;
      musicBtn.classList.add('playing');
      musicBtn.innerText = '⏸';

      let mp3Loaded = false;
      if (audioPlayer) {
        audioPlayer.onplaying = function() {
          mp3Loaded = true;
          synthRunning = false;
          clearTimeout(synthTimer);
        };

        const playPromise = audioPlayer.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            setTimeout(() => {
              if (audioPlayer.paused || audioPlayer.currentTime === 0) {
                startSynthMelody();
              }
            }, 600);
          }).catch(err => {
            startSynthMelody();
          });
        } else {
          startSynthMelody();
        }
      } else {
        startSynthMelody();
      }
    }

    function userToggleMusic(e) {
      if (e) e.stopPropagation();
      if (isPlaying) {
        isPlaying = false;
        synthRunning = false;
        clearTimeout(synthTimer);
        if (audioPlayer) audioPlayer.pause();
        if (audioCtx) audioCtx.suspend();
        musicBtn.classList.remove('playing');
        musicBtn.innerText = '▶';
      } else {
        enableAudioDirectly(e);
      }
    }

    window.addEventListener('DOMContentLoaded', () => {
      enableAudioDirectly();
    });

    const canvas = document.getElementById('canvas-hearts');
    const ctx = canvas.getContext('2d');

    let particles = [];
    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    class HeartParticle {
      constructor() {
        this.reset();
      }
      reset() {
        this.x = Math.random() * canvas.width;
        this.y = canvas.height + 20;
        this.size = Math.random() * 12 + 6;
        this.speedY = Math.random() * 1.5 + 0.5;
        this.speedX = Math.random() * 0.8 - 0.4;
        this.opacity = Math.random() * 0.6 + 0.2;
        this.color = `hsla(${Math.random() * 25 + 40}, 100%, 65%, ${this.opacity})`;
      }
      update() {
        this.y -= this.speedY;
        this.x += this.speedX;
        if (this.y < -30) this.reset();
      }
      draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        const d = this.size;
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-d / 2, -d / 2, -d, d / 3, 0, d);
        ctx.bezierCurveTo(d, d / 3, d / 2, -d / 2, 0, 0);
        ctx.fill();
        ctx.restore();
      }
    }

    for (let i = 0; i < 30; i++) {
      particles.push(new HeartParticle());
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.update();
        p.draw();
      });
      requestAnimationFrame(animate);
    }
    animate();
  </script>
</body>
</html>
)=====";

#endif
