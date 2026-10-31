// MAISON AURA — Experiência Cinemática 3D do Perfume
// Rotação 3D contínua a 360°, controle total com mouse/toque (arrastar, girar e soltar com inércia),
// abertura sincronizada da tampa, borrifador com névoa de partículas e sintetizador de som Web Audio.

class PerfumeIntro {
  constructor() {
    this.container = null;
    this.canvas = null;
    this.ctx = null;
    this.bottle = null;
    this.cap = null;
    this.flash = null;
    this.reveal = null;
    this.soundBtn = null;
    this.viewport = null;
    this.reflectionDiagonal = null;

    this.particles = [];
    this.isMuted = true;
    this.audioCtx = null;
    this.animFrame = null;

    // Física e rotação contínua em 3D
    this.rotY = -20;              // Ângulo Y inicial em graus (gira 360° continuamente)
    this.rotX = -3;               // Inclinação X em graus
    this.autoSpinSpeed = 0.55;    // Velocidade de giro automático contínuo
    this.mouseInfluenceSpin = 0;  // Influência sutil da posição do cursor no giro
    this.targetTiltX = -3;        // Inclinação vertical induzida pelo mouse

    // Interação com Mouse / Toque (Arrasto 3D)
    this.isDragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.velocityX = 0;
    this.velocityY = 0;
    this.dragDistance = 0;

    this.isCapOpened = false;
    this.isOpen = false;
  }

  init() {
    this.container = document.getElementById('perfume-intro');
    if (!this.container) return;

    this.canvas = document.getElementById('intro-canvas');
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
      this.resizeCanvas();
      window.addEventListener('resize', () => this.resizeCanvas());
    }

    this.bottle = document.getElementById('perfume-3d-bottle');
    this.cap = document.getElementById('perfume-cap-assembly');
    this.flash = document.getElementById('spray-burst-flash');
    this.reveal = document.getElementById('intro-reveal-content');
    this.soundBtn = document.getElementById('intro-sound-btn');
    this.viewport = document.getElementById('intro-bottle-viewport');
    this.reflectionDiagonal = this.container.querySelector('.glass-reflection-diagonal');

    this.bindEvents();
    this.startParticleLoop();
    this.playSequence();
  }

  resizeCanvas() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth * window.devicePixelRatio;
    this.canvas.height = window.innerHeight * window.devicePixelRatio;
    if (this.ctx) {
      this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
  }

  bindEvents() {
    const enterBtn = document.getElementById('intro-enter-btn');
    const skipBtn = document.getElementById('intro-skip-btn');
    const sprayBtn = document.getElementById('intro-spray-again-btn');

    if (enterBtn) enterBtn.addEventListener('click', () => this.close());
    if (skipBtn) skipBtn.addEventListener('click', () => this.close());
    if (sprayBtn) sprayBtn.addEventListener('click', () => this.spray());
    if (this.soundBtn) this.soundBtn.addEventListener('click', () => this.toggleSound());

    // Controle direto de mouse / toque para rodar o perfume em 3D
    const targetArea = this.viewport || this.container;

    targetArea.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button') || e.target.closest('a')) return;
      this.isDragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.velocityX = 0;
      this.velocityY = 0;
      this.dragDistance = 0;
      if (this.viewport) this.viewport.classList.add('is-grabbing');
      if (targetArea.setPointerCapture) {
        try { targetArea.setPointerCapture(e.pointerId); } catch {}
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isOpen || this.container?.classList.contains('closing')) return;

      if (this.isDragging) {
        const dx = e.clientX - this.lastX;
        const dy = e.clientY - this.lastY;
        this.dragDistance += Math.hypot(dx, dy);

        // Movimentação direta em 3D com o mouse
        this.rotY += dx * 0.55;
        this.rotX = Math.max(-28, Math.min(28, this.rotX - dy * 0.35));

        // Registra velocidade para dar inércia ao soltar
        this.velocityY = dx * 0.55;
        this.velocityX = -dy * 0.35;

        this.lastX = e.clientX;
        this.lastY = e.clientY;
      } else {
        // Quando o mouse apenas passa pela tela, inclina suavemente o perfume
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const normX = (e.clientX - cx) / cx;
        const normY = (e.clientY - cy) / cy;

        this.targetTiltX = -normY * 14;
        this.mouseInfluenceSpin = normX * 0.45;
      }
    });

    const endDrag = (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      if (this.viewport) this.viewport.classList.remove('is-grabbing');

      // Se foi apenas um clique rápido sem arrastar, borrifa perfume!
      if (this.dragDistance < 6) {
        this.spray();
      }
    };

    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    // Botões no site para rever a experiência
    document.addEventListener('click', (e) => {
      const replayBtn = e.target.closest('[data-replay-intro]');
      if (replayBtn) {
        e.preventDefault();
        this.open();
      }
    });
  }

  playSequence() {
    this.isOpen = true;
    if (!this.container) return;

    this.container.classList.remove('closing');

    // Estado da tampa
    if (this.cap) {
      this.cap.classList.remove('cap-opened');
      this.isCapOpened = false;
    }
    if (this.reveal) {
      this.reveal.classList.remove('revealed');
    }

    // 1. Abertura da tampa em ~2s
    setTimeout(() => {
      if (!this.isOpen) return;
      this.openCap();
    }, 2000);

    // 2. Primeiro borrifo de névoa dourada em ~2.7s
    setTimeout(() => {
      if (!this.isOpen) return;
      this.spray();
    }, 2700);

    // 3. Revelação dos botões e títulos
    setTimeout(() => {
      if (!this.isOpen) return;
      if (this.reveal) this.reveal.classList.add('revealed');
    }, 3400);
  }

  openCap() {
    if (this.isCapOpened) return;
    this.isCapOpened = true;
    if (this.cap) {
      this.cap.classList.add('cap-opened');
    }
    this.playChimeSound();
  }

  spray() {
    if (!this.isCapOpened) {
      this.openCap();
    }

    // Efeito de brilho no bico
    if (this.flash) {
      this.flash.classList.add('flash-active');
      setTimeout(() => {
        if (this.flash) this.flash.classList.remove('flash-active');
      }, 350);
    }

    // Recuo físico suave do frasco
    this.velocityX -= 4;

    // Som de spray
    this.playSpraySound();

    // Partículas de névoa e aura
    this.emitFragranceBurst();
  }

  emitFragranceBurst() {
    if (!this.canvas) return;
    const rect = this.bottle ? this.bottle.getBoundingClientRect() : null;
    const originX = rect ? (rect.left + rect.width / 2) : (window.innerWidth / 2);
    const originY = rect ? (rect.top + 45) : (window.innerHeight / 2 - 80);

    // Partículas de névoa e ouro estelar
    for (let i = 0; i < 150; i++) {
      const angle = (Math.random() * Math.PI) - Math.PI;
      const spread = (Math.random() - 0.5) * 1.6;
      const speed = Math.random() * 8 + 2.5;
      const size = Math.random() * 5 + 1.5;
      const isGold = Math.random() > 0.3;

      this.particles.push({
        x: originX + (Math.random() - 0.5) * 16,
        y: originY,
        vx: Math.cos(angle + spread) * speed * 0.9,
        vy: Math.sin(angle + spread) * speed - 1.8,
        size: size,
        alpha: Math.random() * 0.85 + 0.15,
        decay: Math.random() * 0.012 + 0.006,
        color: isGold 
          ? `rgba(235, 195, 115, ${Math.random() * 0.7 + 0.3})`
          : `rgba(255, 245, 225, ${Math.random() * 0.9 + 0.1})`,
        isSparkle: Math.random() > 0.65,
        sparkleSpeed: Math.random() * 0.2 + 0.05
      });
    }

    // Ondas circulares de aroma
    for (let r = 0; r < 3; r++) {
      setTimeout(() => {
        this.particles.push({
          x: originX,
          y: originY,
          radius: 12,
          maxRadius: 190 + Math.random() * 120,
          growth: 3.8,
          alpha: 0.55,
          decay: 0.011,
          isRing: true
        });
      }, r * 130);
    }
  }

  startParticleLoop() {
    const loop = () => {
      this.updatePhysics();
      this.renderParticles();
      this.animFrame = requestAnimationFrame(loop);
    };
    this.animFrame = requestAnimationFrame(loop);
  }

  updatePhysics() {
    if (!this.isOpen || !this.bottle) return;

    // Levitação suave (flutuação natural no ar)
    const time = Date.now() * 0.0022;
    const floatY = Math.sin(time) * 8;

    if (this.isDragging) {
      // Usuário está no controle manual total com o mouse
      // (os valores rotX e rotY foram atualizados no pointermove)
    } else {
      // Inércia quando o usuário solta após um arrasto rápido
      if (Math.abs(this.velocityY) > 0.08) {
        this.rotY += this.velocityY;
        this.velocityY *= 0.94; // atrito suave
      } else {
        // Giro contínuo automático a 360 graus
        const speed = this.autoSpinSpeed + this.mouseInfluenceSpin;
        this.rotY += speed;
      }

      if (Math.abs(this.velocityX) > 0.08) {
        this.rotX = Math.max(-28, Math.min(28, this.rotX + this.velocityX));
        this.velocityX *= 0.92;
      } else {
        // Retorno sutil à inclinação do cursor
        this.rotX += (this.targetTiltX - this.rotX) * 0.05;
      }
    }

    // Mantém o ângulo em 360° limpo
    this.rotY = (this.rotY % 360);

    // Aplica a transformação 3D no frasco
    this.bottle.style.transform = `translateY(${floatY.toFixed(2)}px) rotateX(${this.rotX.toFixed(2)}deg) rotateY(${this.rotY.toFixed(2)}deg)`;

    // Reflexo de luz dinâmico que viaja pelo vidro conforme o perfume gira
    if (this.reflectionDiagonal) {
      const rad = (this.rotY * Math.PI) / 180;
      const sweepX = Math.sin(rad) * 35;
      this.reflectionDiagonal.style.transform = `translate(${sweepX}%, ${sweepX * 0.5}%) rotate(15deg)`;
    }
  }

  renderParticles() {
    if (!this.ctx || !this.canvas) return;
    this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      if (p.isRing) {
        p.radius += p.growth;
        p.alpha -= p.decay;

        if (p.alpha <= 0 || p.radius >= p.maxRadius) {
          this.particles.splice(i, 1);
          continue;
        }

        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        this.ctx.strokeStyle = `rgba(220, 185, 125, ${p.alpha * 0.5})`;
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();
        this.ctx.restore();
      } else {
        p.x += p.vx;
        p.y += p.vy;
        p.vy *= 0.98;
        p.vx *= 0.98;
        p.vy -= 0.08;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          this.particles.splice(i, 1);
          continue;
        }

        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);

        if (p.isSparkle) {
          const glow = Math.sin(Date.now() * p.sparkleSpeed) * 0.5 + 0.5;
          this.ctx.fillStyle = `rgba(255, 235, 175, ${p.alpha * glow})`;
          this.ctx.shadowColor = '#FFE7A0';
          this.ctx.shadowBlur = 8;
        } else {
          this.ctx.fillStyle = p.color;
          this.ctx.shadowColor = 'rgba(215, 175, 95, 0.4)';
          this.ctx.shadowBlur = 4;
        }

        this.ctx.fill();
        this.ctx.restore();
      }
    }
  }

  /* ================= SINTETIZADOR DE ÁUDIO WEB ================= */
  ensureAudio() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  toggleSound() {
    this.ensureAudio();
    this.isMuted = !this.isMuted;
    const offIcon = document.getElementById('sound-icon-off');
    const onIcon = document.getElementById('sound-icon-on');
    if (offIcon && onIcon) {
      offIcon.style.display = this.isMuted ? 'block' : 'none';
      onIcon.style.display = this.isMuted ? 'none' : 'block';
    }
    if (!this.isMuted) {
      this.playChimeSound();
    }
  }

  playSpraySound() {
    if (this.isMuted) return;
    try {
      this.ensureAudio();
      if (!this.audioCtx) return;

      const bufferSize = this.audioCtx.sampleRate * 0.6;
      const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.audioCtx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(3200, this.audioCtx.currentTime);
      filter.Q.setValueAtTime(1.8, this.audioCtx.currentTime);

      const gain = this.audioCtx.createGain();
      const t = this.audioCtx.currentTime;
      gain.gain.setValueAtTime(0.01, t);
      gain.gain.linearRampToValueAtTime(0.35, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.audioCtx.destination);

      noise.start();
      noise.stop(t + 0.6);
    } catch {}
  }

  playChimeSound() {
    if (this.isMuted) return;
    try {
      this.ensureAudio();
      if (!this.audioCtx) return;

      const freqs = [1046.5, 1318.5, 1567.98, 1975.5];
      const now = this.audioCtx.currentTime;

      freqs.forEach((freq, idx) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.04);

        gain.gain.setValueAtTime(0.001, now + idx * 0.04);
        gain.gain.linearRampToValueAtTime(0.08, now + idx * 0.04 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.04 + 1.2);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now + idx * 0.04);
        osc.stop(now + idx * 0.04 + 1.3);
      });
    } catch {}
  }

  close() {
    this.isOpen = false;
    if (!this.container) return;
    this.container.classList.add('closing');

    try {
      sessionStorage.setItem('maison_aura_intro_viewed', '1');
    } catch {}

    setTimeout(() => {
      if (this.container) {
        this.container.style.display = 'none';
      }
    }, 850);
  }

  open() {
    if (!this.container) return;
    this.container.style.display = 'flex';
    void this.container.offsetWidth;
    this.container.classList.remove('closing');
    this.playSequence();
  }
}

let introInstance = null;

export function initPerfumeIntro() {
  if (!introInstance) {
    introInstance = new PerfumeIntro();
    introInstance.init();
  }
  return introInstance;
}
