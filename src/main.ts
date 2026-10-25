import './styles/main.css';
import {
  AngleId,
  BirthInput,
  BodyId,
  ChartCalculationResult,
  CityLocation,
  WheelSelection
} from './types/astrology';
import {
  PRESET_LOCATIONS,
  resolveLocalToUtc,
  searchLocalLocations,
  searchOnlineLocations
} from './data/locations';
import { calculateFullChart, shortestAngularDistance } from './engine/ephemeris';
import { HOUSE_THEMES } from './engine/interpretation';
import {
  ELECTIONAL_CATEGORIES,
  ElectionalCategoryId,
  ElectionalForecastResult,
  evaluateThirtyDayElectionalForecast
} from './engine/electional';
import { ELEMENT_COLORS, NatalWheelCanvas } from './components/NatalWheelCanvas';
import { LiveSkyWheelCanvas } from './components/LiveSkyWheelCanvas';
import {
  StoredProfilePayload,
  loadProfileSync,
  recoverProfileAsync,
  removeSavedProfile,
  saveProfileEverywhere
} from './engine/storage';
import {
  AuthState,
  loadAuthStateSync,
  recoverAuthStateAsync,
  registerUserAccount,
  resetUserPassword,
  signInUserAccount,
  signOutUserAccount,
  syncChartToActiveAccount
} from './engine/auth';

const DEFAULT_BIRTH_INPUT: BirthInput = {
  fullName: 'Deniz Yıldırım',
  birthDate: '1994-11-10',
  birthTime: '14:30',
  location: PRESET_LOCATIONS[0] // İstanbul
};

const SAMPLE_PROFILES: BirthInput[] = [
  DEFAULT_BIRTH_INPUT,
  {
    fullName: 'Selin Kaya (Ankara)',
    birthDate: '1998-04-05',
    birthTime: '08:15',
    location: PRESET_LOCATIONS.find((l) => l.id === 'tr-ank') || PRESET_LOCATIONS[0]
  },
  {
    fullName: 'Kaan Demir (İzmir)',
    birthDate: '1990-07-26',
    birthTime: '21:45',
    location: PRESET_LOCATIONS.find((l) => l.id === 'tr-izm') || PRESET_LOCATIONS[0]
  }
];

type ActiveTab = 'big-three' | 'planet-table' | 'active-transits' | 'personality-synthesis';
type MainViewMode = 'chart' | 'profile';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const VENUS_SVG = `<svg class="astro-glyph-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8.5" r="4.8"/><line x1="12" y1="13.3" x2="12" y2="20.5"/><line x1="8.5" y1="17" x2="15.5" y2="17"/></svg>`;
const MARS_SVG = `<svg class="astro-glyph-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9.8" cy="14.2" r="4.8"/><line x1="13.2" y1="10.8" x2="19.2" y2="4.8"/><polyline points="14.2 4.8 19.2 4.8 19.2 9.8"/></svg>`;

function renderBodyGlyph(glyph: string): string {
  if (glyph === '♀') return VENUS_SVG;
  if (glyph === '♂') return MARS_SVG;
  return `<span class="astro-body-glyph" aria-hidden="true">${glyph}</span>`;
}

function formatMarkdownBold(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/♀/g, VENUS_SVG)
    .replace(/♂/g, MARS_SVG);
}

class ZenithApp {
  private root: HTMLElement;
  private birthInput: BirthInput;
  private profileState: StoredProfilePayload;
  private authState: AuthState;
  private authViewMode: 'signin' | 'signup' | 'reset' = 'signin';
  private authFeedback: { type: 'error' | 'success'; message: string } | null = null;
  private chart!: ChartCalculationResult;
  private wheelCanvas: NatalWheelCanvas | null = null;
  private liveSkyCanvas: LiveSkyWheelCanvas | null = null;
  private liveSkySelectedBodyId: BodyId = 'sun';
  private electionalCategoryId: ElectionalCategoryId = 'career';
  private electionalQueryText =
    'Yeni iş başlangıcı ve kariyer adımı için en uygun gün hangisi?';
  private electionalResult!: ElectionalForecastResult;
  private selectedElectionalDayIso = '';
  private isOptimalAccordionOpen = false;
  private isCautionAccordionOpen = false;
  private isPreviewingFutureDate = false;
  private selection: WheelSelection = { kind: 'planet', id: 'sun' };
  private activeTab: ActiveTab = 'big-three';
  private activeMainView: MainViewMode = 'chart';
  private deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
  private selectedModalLocation: CityLocation;
  private locationSearchResults: CityLocation[] = [];
  private searchDebounceTimer: number | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.profileState = loadProfileSync();
    this.authState = loadAuthStateSync();
    if (this.authState.currentUser) {
      this.birthInput = this.authState.currentUser.primaryChart;
    } else {
      this.birthInput = this.profileState.activeProfile;
    }
    this.selectedModalLocation = this.birthInput.location;
    this.locationSearchResults = PRESET_LOCATIONS.slice(0, 8);
    this.recalculateChart();
    this.initIntroSplashVideo();
    this.initPwaInstallListener();
    this.registerServiceWorker();
    this.renderShell();
    void this.initAsyncProfileRecovery();
  }

  private initIntroSplashVideo(): void {
    const splashEl = document.getElementById('zenith-intro-splash');
    const videoEl = document.getElementById('zenith-intro-video') as HTMLVideoElement | null;

    if (!splashEl || !videoEl) return;

    let dismissed = false;
    const dismissSplash = () => {
      if (dismissed) return;
      dismissed = true;
      splashEl.style.opacity = '0';
      splashEl.style.pointerEvents = 'none';
      window.setTimeout(() => {
        try {
          videoEl.pause();
        } catch {
          // Ignore
        }
        splashEl.style.display = 'none';
      }, 650);
    };

    videoEl.addEventListener('ended', dismissSplash);
    videoEl.addEventListener('error', dismissSplash);

    // Ensure playback starts immediately on mobile/PWA/iOS WebView
    videoEl.muted = true;
    const playPromise = videoEl.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // If low-power mode blocks autoplay, allow tap anywhere on splash to play or dismiss
        splashEl.addEventListener('click', () => {
          videoEl.play().catch(dismissSplash);
        }, { once: true });
      });
    }
  }

  private replayIntroVideo(): void {
    const splashEl = document.getElementById('zenith-intro-splash');
    const videoEl = document.getElementById('zenith-intro-video') as HTMLVideoElement | null;
    if (!splashEl || !videoEl) return;

    splashEl.style.display = 'flex';
    splashEl.style.pointerEvents = 'auto';
    // Force reflow before fading in
    void splashEl.offsetHeight;
    splashEl.style.opacity = '1';

    videoEl.currentTime = 0;
    videoEl.play().catch(() => {});

    const onEnded = () => {
      splashEl.style.opacity = '0';
      splashEl.style.pointerEvents = 'none';
      window.setTimeout(() => {
        splashEl.style.display = 'none';
      }, 650);
    };
    videoEl.addEventListener('ended', onEnded, { once: true });
  }

  private async initAsyncProfileRecovery(): Promise<void> {
    const [recoveredProfile, recoveredAuth] = await Promise.all([
      recoverProfileAsync(),
      recoverAuthStateAsync()
    ]);

    let shouldRerender = false;

    if (recoveredAuth && (recoveredAuth.currentUser || recoveredAuth.accounts.length > 0)) {
      const prevUserId = this.authState.currentUser?.id;
      this.authState = recoveredAuth;
      if (recoveredAuth.currentUser && recoveredAuth.currentUser.id !== prevUserId) {
        this.birthInput = recoveredAuth.currentUser.primaryChart;
        this.selectedModalLocation = this.birthInput.location;
        shouldRerender = true;
      }
    }

    if (recoveredProfile) {
      const changed =
        !this.authState.currentUser &&
        (recoveredProfile.activeProfile.fullName !== this.birthInput.fullName ||
          recoveredProfile.activeProfile.birthDate !== this.birthInput.birthDate ||
          recoveredProfile.activeProfile.birthTime !== this.birthInput.birthTime ||
          recoveredProfile.activeProfile.location.id !== this.birthInput.location.id ||
          recoveredProfile.savedProfiles.length !== this.profileState.savedProfiles.length);

      this.profileState = recoveredProfile;
      if (changed) {
        this.birthInput = recoveredProfile.activeProfile;
        this.selectedModalLocation = this.birthInput.location;
        shouldRerender = true;
      }
    }

    if (shouldRerender) {
      this.recalculateChart();
      this.renderShell();
    }
  }

  private async saveProfile(input: BirthInput): Promise<void> {
    this.birthInput = input;
    this.profileState = await saveProfileEverywhere(
      input,
      this.profileState.savedProfiles,
      true
    );
    if (this.authState.currentUser) {
      this.authState = await syncChartToActiveAccount(input, this.authState);
    }
  }

  private recalculateChart(transitDate: Date = new Date()): void {
    this.chart = calculateFullChart(this.birthInput, transitDate);
    if (
      this.chart.activeTransits.length > 0 &&
      !this.chart.transitPlanets.some((p) => p.id === this.liveSkySelectedBodyId)
    ) {
      this.liveSkySelectedBodyId = this.chart.activeTransits[0].transitBody.id;
    }
    this.electionalResult = evaluateThirtyDayElectionalForecast(
      this.chart,
      this.electionalQueryText,
      this.electionalCategoryId,
      new Date()
    );
    if (
      !this.selectedElectionalDayIso ||
      !this.electionalResult.allDays.some((d) => d.dateIso === this.selectedElectionalDayIso)
    ) {
      this.selectedElectionalDayIso =
        this.electionalResult.topOptimalDays[0]?.dateIso ||
        this.electionalResult.allDays[0].dateIso;
    }
  }

  private initPwaInstallListener(): void {
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredInstallPrompt = e as BeforeInstallPromptEvent;
      const installBtn = document.getElementById('pwa-install-btn');
      if (installBtn) {
        installBtn.innerHTML = '📲 Uygulamayı Yükle (Hazır)';
      }
    });
  }

  private isNativeApp(): boolean {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    return Boolean(
      cap?.isNativePlatform?.() ||
      window.location.protocol === 'capacitor:' ||
      window.matchMedia('(display-mode: standalone)').matches
    );
  }

  private registerServiceWorker(): void {
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('./sw.js', { scope: './' })
          .catch(() => {
            // Silent catch in dev mode
          });
      });
    }
  }

  private setupDialogLightDismissFallback(dialog: HTMLDialogElement): void {
    // Fallback for browsers without declarative closedby support (modern-web-guidance: light-dismiss-a-dialog)
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      dialog.addEventListener('click', (event: MouseEvent) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (isDialogContent) return;
        dialog.close();
      });
    }
  }

  private renderShell(): void {
    const { input, utcOffsetFormatted, activeTransits } = this.chart;
    const isStandaloneOrNative = this.isNativeApp();
    const isChartView = this.activeMainView === 'chart';
    const isProfileView = this.activeMainView === 'profile';
    const transitTimeStr = this.chart.transitUtcDate.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit'
    });
    const transitDateStr = this.chart.transitUtcDate.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
    const utcTimeStr = this.chart.transitUtcDate.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC'
    });
    const utcDateStr = this.chart.transitUtcDate.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC'
    });

    this.root.innerHTML = `
      <div class="zenith-shell">
        <!-- TOP NAVBAR: BRAND + MAIN VIEW NAVIGATION (DOĞUM HARİTASI / PROFİL SAYFASI) -->
        <header class="top-navbar">
          <div class="brand-group" id="brand-replay-intro-btn" style="cursor:pointer;" title="Zenith Açılış Videosunu Tekrar Oynat">
            <img src="./logo.png" alt="Zenith Logo" class="brand-logo" width="40" height="40" />
            <div>
              <div class="brand-title">ZENITH</div>
              <div class="brand-subtitle">İnteraktif Natal &amp; Transit Astroloji Motoru</div>
            </div>
          </div>

          <nav class="header-actions" aria-label="Ana Sayfa ve Profil Gezinmesi">
            <button
              type="button"
              id="nav-chart-view-btn"
              class="btn ${isChartView ? 'btn-primary' : ''}"
              aria-current="${isChartView ? 'page' : 'false'}"
            >
              🪐 Doğum Haritası
            </button>
            <button
              type="button"
              id="nav-profile-view-btn"
              class="btn ${isProfileView ? 'btn-primary' : this.authState.currentUser ? 'btn-account' : ''}"
              aria-current="${isProfileView ? 'page' : 'false'}"
            >
              👤 Profil (${this.authState.currentUser ? this.authState.currentUser.fullName.split(' ')[0] : input.fullName ? input.fullName.split(' ')[0] : 'Hesabım'})
            </button>
          </nav>
        </header>

        ${
          isChartView
            ? `
          <!-- 1. SAYFA BAŞI: DOĞUM HARİTASI (İNTERAKTİF VEKTÖR ÇARK + 4 KATMANLI SENTEZ DENETÇİSİ) -->
          <main class="workspace-grid">
            <section class="wheel-panel" aria-label="İnteraktif Doğum Haritası Çarkı">
              <div class="wheel-toolbar">
                <div class="wheel-legend">
                  <span class="legend-item"><span class="legend-dot" style="background:var(--el-fire)"></span>Ateş</span>
                  <span class="legend-item"><span class="legend-dot" style="background:var(--el-earth)"></span>Toprak</span>
                  <span class="legend-item"><span class="legend-dot" style="background:var(--el-air)"></span>Hava</span>
                  <span class="legend-item"><span class="legend-dot" style="background:var(--el-water)"></span>Su</span>
                  <span class="legend-item"><span class="legend-dot" style="background:#F59E0B"></span>ASC-DSC</span>
                  <span class="legend-item"><span class="legend-dot" style="background:#06B6D4"></span>MC-IC</span>
                </div>
                <div class="wheel-controls">
                  <button type="button" id="toggle-transit-ring-btn" class="btn btn-icon active" title="Dış Transit Halkasını Göster/Gizle">
                    Transit
                  </button>
                  <button type="button" id="toggle-touch-rotate-btn" class="btn btn-icon" title="Tek Parmakla Çark Döndürme Modu">
                    Döndür
                  </button>
                  <button type="button" id="rotate-left-btn" class="btn btn-icon" aria-label="Sola Döndür">⟲</button>
                  <button type="button" id="rotate-right-btn" class="btn btn-icon" aria-label="Sağa Döndür">⟳</button>
                  <button type="button" id="zoom-in-btn" class="btn btn-icon" aria-label="Yakınlaştır">＋</button>
                  <button type="button" id="zoom-out-btn" class="btn btn-icon" aria-label="Uzaklaştır">－</button>
                  <button type="button" id="reset-wheel-btn" class="btn btn-icon" title="Görünümü Sıfırla">↺</button>
                </div>
              </div>

              <div class="canvas-stage">
                <canvas id="natal-wheel-canvas" aria-label="Natal ve Transit Vektör Astroloji Çarkı"></canvas>
              </div>

              <div class="mobile-wheel-selection-bar" id="mobile-selection-banner"></div>

              <div class="live-sky-ephemeris-block" style="inline-size:100%;">
                <div class="live-sky-block-header">
                  <span>🪐 Doğum Haritası Gezegen &amp; Eksen Dizilimi (11 Gök Cismi)</span>
                  <small>İncelemek için bir gök cismine dokunun</small>
                </div>
                <div class="live-sky-planet-grid" id="wheel-quick-pills" role="toolbar" aria-label="Hızlı Gezegen ve Eksen Seçici"></div>
              </div>
            </section>

            <!-- RIGHT: 4-LAYER PERSONALIZED SYNTHESIS INSPECTOR -->
            <aside class="inspector-panel" id="inspector-container" aria-live="polite"></aside>
          </main>

          <!-- 2. DOĞUM HARİTASININ ALTINDA: CANLI GÖKYÜZÜ EŞLEŞTİRİCİ (UTC/YEREL GÖKSEL TEMSİLİ HARİTA MODÜLÜ) -->
          <section class="live-sky-module" aria-label="Canlı Gökyüzü Eşleştirici Göksel Temsili Harita Modülü">
            <div class="live-sky-header">
              <div class="live-sky-title-group">
                <div class="live-sky-title-row">
                  <span class="live-pulse-dot" aria-hidden="true"></span>
                  <h2 class="live-sky-title">🌌 Canlı Gökyüzü Eşleştirici (UTC / Yerel Göksel Harita)</h2>
                  <span class="badge" style="color:#67E8F9; border-color:rgba(6,182,212,0.5); background:rgba(6,182,212,0.14);">
                    ±2.0° Dar Orb • ${activeTransits.length} Aktif Transit
                  </span>
                </div>
                <div class="live-sky-timestamps">
                  <span class="profile-meta-chip">🕒 Yerel: ${transitDateStr} • ${transitTimeStr}</span>
                  <span class="profile-meta-chip">🌐 UTC: ${utcDateStr} • ${utcTimeStr} UTC</span>
                  <span class="profile-meta-chip">📍 Referans Ufuk: ${input.location.name} (ASC ${this.chart.angles.asc.sign.glyph} ${this.chart.angles.asc.degreeFormatted})</span>
                </div>
              </div>

              <div class="live-sky-controls">
                <button type="button" id="live-sky-rot-left-btn" class="btn btn-icon" aria-label="Göksel Haritayı Sola Döndür" title="Sola Döndür">⟲</button>
                <button type="button" id="live-sky-rot-right-btn" class="btn btn-icon" aria-label="Göksel Haritayı Sağa Döndür" title="Sağa Döndür">⟳</button>
                <button type="button" id="live-sky-reset-btn" class="btn btn-icon" aria-label="Göksel Harita Yönünü Sıfırla" title="Sıfırla">↺</button>
                <button type="button" id="refresh-transit-btn" class="btn btn-icon active">
                  ${this.isPreviewingFutureDate ? '🕒 Şu Anki Canlı Gökyüzüne Dön' : '🔄 Anlık Gökyüzünü Yenile'}
                </button>
              </div>
            </div>

            <div class="live-sky-workspace">
              <!-- SOL: DOĞUM HARİTASI TARZINDA GÖKSEL TEMSİLİ HARİTA ÇARKI -->
              <div class="live-sky-wheel-card">
                <div class="wheel-legend" style="justify-content:center;">
                  <span class="legend-item"><span class="legend-dot" style="background:#06B6D4"></span>Anlık Gökyüzü (Transit)</span>
                  <span class="legend-item"><span class="legend-dot" style="background:#F59E0B"></span>Natal Referans</span>
                  <span class="legend-item"><span class="legend-dot" style="background:#10B981"></span>Uyumlu Açı</span>
                  <span class="legend-item"><span class="legend-dot" style="background:#EF4444"></span>Dinamik Açı</span>
                </div>

                <div class="live-sky-canvas-stage">
                  <canvas id="live-sky-wheel-canvas" aria-label="Canlı Gökyüzü Eşleştirici Göksel Temsili Harita Çarkı"></canvas>
                </div>

                <p class="live-sky-wheel-caption">
                  Çark üzerindeki <strong>dış göksel madalyonlar</strong> gezegenlerin şu anki gerçek zamanlı Zodyak konumlarını, <strong>iç halka</strong> ise doğum haritanızla olan rezonans ışınlarını gösterir.
                </p>
              </div>

              <!-- SAĞ: SEÇİLİ GÖKSEL KONUM SENTEZİ & 11 GÖK CİSMİ EPHEMERİS DİZİLİMİ -->
              <div class="live-sky-inspector-col">
                <div id="live-sky-selected-detail" class="live-sky-detail-card" aria-live="polite"></div>

                <div class="live-sky-ephemeris-block">
                  <div class="live-sky-block-header">
                    <span>🪐 Anlık Gökyüzü Gezegen Dizilimi (11 Gök Cismi)</span>
                    <small>İncelemek için bir gök cismine dokunun</small>
                  </div>
                  <div id="live-sky-planet-grid" class="live-sky-planet-grid" role="toolbar" aria-label="Canlı Gökyüzü Gezegen Seçici"></div>
                </div>

                <div id="live-sky-active-chips" class="live-sky-active-chips"></div>
              </div>
            </div>
          </section>

          <!-- 2B. 30 GÜNLÜK GERÇEK EPHEMERİS KOZMİK ZAMANLAMA & SORU DANIŞMANI -->
          <section class="electional-planner-module" id="electional-planner-container" aria-label="30 Günlük Kozmik Zamanlama ve Soru Danışmanı"></section>

          <!-- 3. CANLI GÖKYÜZÜ EŞLEŞTİRİCİNİN ALTINDA: 4 ANA RAPOR SEKMESİ -->
          <section class="tabs-section" aria-label="Detaylı Astrolojik Rapor Sekmeleri">
            <nav class="tab-nav" role="tablist">
              <button type="button" role="tab" data-tab="big-three" class="tab-btn ${this.activeTab === 'big-three' ? 'active' : ''}" aria-selected="${this.activeTab === 'big-three'}">
                ✨ Büyük Üçlü
              </button>
              <button type="button" role="tab" data-tab="planet-table" class="tab-btn ${this.activeTab === 'planet-table' ? 'active' : ''}" aria-selected="${this.activeTab === 'planet-table'}">
                📐 Gezegen Tablosu
              </button>
              <button type="button" role="tab" data-tab="active-transits" class="tab-btn ${this.activeTab === 'active-transits' ? 'active' : ''}" aria-selected="${this.activeTab === 'active-transits'}">
                ⚡ Transitler (${activeTransits.length})
              </button>
              <button type="button" role="tab" data-tab="personality-synthesis" class="tab-btn ${this.activeTab === 'personality-synthesis' ? 'active' : ''}" aria-selected="${this.activeTab === 'personality-synthesis'}">
                🧬 Kişilik Analizi
              </button>
            </nav>

            <div class="tab-content-area" id="tab-panel-content"></div>
          </section>
        `
            : `
          <!-- PROFİL SAYFASI: HESABIM VE HARİTA BİLGİLERİ -->
          <main class="profile-page-view" aria-label="Profil Sayfası: Hesabım ve Harita Bilgileri">
            <!-- AKTİF PROFİL ÖZET BARI -->
            <section class="profile-page-banner" aria-label="Aktif Doğum Haritası Özeti">
              <div class="profile-summary-info">
                <span class="profile-name-badge">✦ ${input.fullName || 'İsimsiz Harita'}</span>
                <span class="profile-meta-chip">${input.birthDate} • ${input.birthTime}</span>
                <span class="profile-meta-chip">📍 ${input.location.name} (${input.location.latitude.toFixed(2)}°K, ${input.location.longitude.toFixed(2)}°D)</span>
                <span class="profile-tz-chip">${input.location.timezone} (${utcOffsetFormatted})</span>
                ${
                  this.authState.currentUser
                    ? `<span class="profile-tz-chip" style="color:#6EE7B7; border-color:rgba(16,185,129,0.5); background:rgba(16,185,129,0.14);">🟢 Hesap: ${this.authState.currentUser.email}</span>`
                    : `<span class="profile-tz-chip" style="color:#6EE7B7; border-color:rgba(16,185,129,0.45); background:rgba(16,185,129,0.12);">✓ Cihazda Kalıcı Kayıtlı</span>`
                }
              </div>
              <div class="profile-banner-actions">
                <button type="button" id="profile-copy-link-btn" class="btn btn-icon" style="color:#FDE68A;">
                  🔗 Harita Bağlantımı Kopyala
                </button>
                ${
                  isStandaloneOrNative
                    ? ''
                    : `<button type="button" id="pwa-install-btn" class="btn btn-pwa">
                        📲 Ana Ekrana Ekle
                      </button>`
                }
                <button type="button" id="back-to-chart-btn" class="btn btn-primary">
                  🪐 Doğum Haritasına Dön
                </button>
              </div>
            </section>

            <!-- PROFİL SAYFASI 2 SÜTUNLU PANEL: 1) HESABIM  2) HARİTA BİLGİLERİ -->
            <div class="profile-sections-grid">
              <!-- 1. HESABIM PANELİ -->
              <section class="profile-section-card" id="auth-modal-inner" aria-label="Hesabım ve Giriş/Kayıt Paneli"></section>

              <!-- 2. HARİTA BİLGİLERİ & KONUM PARAMETRELERİ PANELİ -->
              <section class="profile-section-card" id="birth-settings-card" aria-labelledby="birth-modal-title">
                <div class="dialog-header">
                  <div>
                    <h2 id="birth-modal-title" style="font-size:1.1rem; font-weight:800;">⚙️ Harita Bilgileri &amp; Konum Parametreleri</h2>
                    <p style="font-size:0.77rem; color:var(--text-secondary);">Jeosentrik Tropikal Zodyak, Placidus Ev Sistemi ve IANA Otomatik Saat Dilimi</p>
                  </div>
                </div>

                ${
                  this.profileState.savedProfiles.length > 0
                    ? `
                  <div style="background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.3); border-radius:10px; padding:0.65rem;">
                    <div style="font-size:0.75rem; font-weight:700; color:#6EE7B7; margin-bottom:0.4rem;">
                      📌 Cihazda Kalıcı Kayıtlı Haritalarım (Ana Ekran PWA Dahil):
                    </div>
                    <div style="display:flex; gap:0.4rem; flex-wrap:wrap; align-items:center;">
                      ${this.profileState.savedProfiles
                        .map(
                          (sp, idx) => `
                        <div style="display:inline-flex; align-items:center; gap:0.2rem; background:rgba(15,23,42,0.85); border:1px solid rgba(255,255,255,0.14); border-radius:8px; padding:0.15rem 0.35rem;">
                          <button type="button" class="btn btn-icon saved-profile-select-btn" data-saved-idx="${idx}" style="border:none; background:transparent; padding:0.2rem 0.35rem; font-size:0.76rem;">
                            ✦ ${sp.fullName} (${sp.birthDate})
                          </button>
                          <button type="button" class="btn btn-icon saved-profile-delete-btn" data-delete-idx="${idx}" title="Bu kaydı sil" style="border:none; background:transparent; color:#FDA4AF; padding:0.15rem 0.3rem; font-size:0.72rem;">✕</button>
                        </div>
                      `
                        )
                        .join('')}
                    </div>
                  </div>
                `
                    : ''
                }

                <div style="display:flex; gap:0.4rem; flex-wrap:wrap; align-items:center;">
                  <span style="font-size:0.74rem; color:var(--text-secondary);">Hızlı Örnek Profiller:</span>
                  ${SAMPLE_PROFILES.map(
                    (sp, idx) => `
                    <button type="button" class="btn btn-icon sample-profile-btn" data-sample-idx="${idx}">
                      ${sp.fullName}
                    </button>
                  `
                  ).join('')}
                </div>

                <form id="birth-data-form" novalidate>
                  <div class="form-grid">
                    <div class="field full-span">
                      <label for="input-fullname">Ad &amp; Soyad (İsteğe Bağlı)</label>
                      <span id="fullname-hint" class="hint">Harita başlığında gösterilecek isim</span>
                      <input
                        type="text"
                        id="input-fullname"
                        name="fullName"
                        value="${this.birthInput.fullName}"
                        placeholder="Örn: Deniz Yıldırım"
                        autocomplete="name"
                        aria-describedby="fullname-hint"
                      />
                    </div>

                    <div class="field">
                      <label for="input-birthdate">Doğum Tarihi</label>
                      <span id="birthdate-hint" class="hint">Gün, Ay ve Yıl seçiniz</span>
                      <input
                        type="date"
                        id="input-birthdate"
                        name="birthDate"
                        value="${this.birthInput.birthDate}"
                        required
                        min="1900-01-01"
                        max="2100-12-31"
                        aria-describedby="birthdate-hint"
                        aria-errormessage="birthdate-error"
                      />
                      <div id="birthdate-error" class="error-msg">
                        <span aria-hidden="true">❌</span> Lütfen geçerli bir doğum tarihi giriniz.
                      </div>
                    </div>

                    <div class="field">
                      <label for="input-birthtime">Doğum Saati</label>
                      <span id="birthtime-hint" class="hint">Yükselen ve Placidus evleri için (SS:DD)</span>
                      <input
                        type="time"
                        id="input-birthtime"
                        name="birthTime"
                        value="${this.birthInput.birthTime}"
                        required
                        aria-describedby="birthtime-hint"
                        aria-errormessage="birthtime-error"
                      />
                      <div id="birthtime-error" class="error-msg">
                        <span aria-hidden="true">❌</span> Lütfen doğum saatini (SS:DD) giriniz.
                      </div>
                    </div>

                    <div class="field full-span">
                      <label for="input-location-search">Doğum Yeri (Şehir / İlçe)</label>
                      <span id="location-hint" class="hint">Şehir veya ilçe yazın; enlem/boylam ve IANA saat dilimi otomatik çözülür</span>
                      <input
                        type="search"
                        id="input-location-search"
                        name="locationQuery"
                        value="${this.birthInput.location.name}"
                        placeholder="İstanbul, Kadıköy, Ankara, İzmir, Londra..."
                        required
                        autocomplete="off"
                        aria-describedby="location-hint"
                        aria-errormessage="location-error"
                      />
                      <div id="location-error" class="error-msg">
                        <span aria-hidden="true">❌</span> Lütfen bir doğum şehri/ilçesi seçiniz.
                      </div>

                      <div id="selected-location-Readout" style="margin-top:0.35rem; font-family:var(--font-mono); font-size:0.75rem; color:var(--accent-blue);">
                        Seçili Konum: <strong>${this.selectedModalLocation.name} (${this.selectedModalLocation.country})</strong> •
                        ${this.selectedModalLocation.latitude.toFixed(4)}°K, ${this.selectedModalLocation.longitude.toFixed(4)}°D •
                        IANA: ${this.selectedModalLocation.timezone}
                      </div>

                      <ul class="location-results-list" id="location-results-ul" role="listbox" aria-label="Şehir ve İlçe Sonuçları"></ul>
                    </div>
                  </div>

                  <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.6rem; margin-top:1.15rem;">
                    <span style="font-size:0.74rem; color:#6EE7B7;">
                      🔒 Bilgileriniz bu cihazda ve Ana Ekran (PWA) uygulamasında kalıcı olarak saklanır.
                    </span>
                    <div style="display:flex; gap:0.6rem;">
                      <button type="submit" class="btn btn-primary">✨ Kalıcı Kaydet &amp; Haritayı Çiz</button>
                    </div>
                  </div>
                </form>
              </section>
            </div>
          </main>
        `
        }
      </div>

      <!-- PWA INSTALL INFO DIALOG -->
      <dialog id="pwa-info-modal" class="zenith-dialog" closedby="any" aria-labelledby="pwa-modal-title">
        <div class="dialog-inner">
          <div class="dialog-header">
            <h2 id="pwa-modal-title" style="font-size:1.05rem; font-weight:800;">📲 Zenith PWA — Ana Ekrana Ekle</h2>
            <button type="button" id="close-pwa-modal-btn" class="btn btn-icon" aria-label="Kapat">✕</button>
          </div>
          <p style="font-size:0.86rem; color:#E2E8F0;">
            <strong>Zenith</strong>, kişisel doğum bilgilerinizi <strong>5 katmanlı kalıcı hafıza</strong> (IndexedDB, Service Worker Cache, 10 Yıllık Çerez, LocalStorage ve Kişisel URL) ile korur; uygulamayı ana ekrana eklediğinizde veya kapattığınızda bilgileriniz silinmez.
          </p>
          <ul style="font-size:0.83rem; color:var(--text-secondary); padding-inline-start:1.2rem; display:flex; flex-direction:column; gap:0.45rem;">
            <li><strong>1. Adım:</strong> Önce <em>"Profil"</em> sayfasından kendi doğum bilgilerinizi kaydedin.</li>
            <li><strong>2. Adım (iOS / Safari):</strong> Alt bardaki <em>Paylaş</em> simgesine dokunun ve <strong>"Ana Ekrana Ekle"</strong> seçeneğini seçin (aktif profiliniz otomatik olarak ana ekran simgesine gömülür).</li>
            <li><strong>2. Adım (Android / Chrome):</strong> Tarayıcı menüsünden (⋮) <strong>"Uygulamayı Yükle"</strong> veya <strong>"Ana Ekrana Ekle"</strong> seçeneğine dokunun.</li>
          </ul>
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
            <button type="button" id="copy-profile-link-btn" class="btn btn-icon" style="color:#FDE68A;">
              🔗 Kişisel Harita Bağlantımı Kopyala
            </button>
            <button type="button" id="ok-pwa-modal-btn" class="btn btn-primary">Tamam</button>
          </div>
        </div>
      </dialog>
    `;

    // Initialize Canvas Wheel when on Chart View
    const canvasEl = document.getElementById('natal-wheel-canvas') as HTMLCanvasElement | null;
    if (canvasEl) {
      this.wheelCanvas = new NatalWheelCanvas(canvasEl, this.chart, (sel) => {
        this.selection = sel;
        this.renderQuickPills();
        this.renderInspector();
      });
      this.wheelCanvas.setSelection(this.selection, false);
    } else {
      this.wheelCanvas = null;
    }

    const liveSkyCanvasEl = document.getElementById('live-sky-wheel-canvas') as HTMLCanvasElement | null;
    if (liveSkyCanvasEl) {
      this.liveSkyCanvas = new LiveSkyWheelCanvas(
        liveSkyCanvasEl,
        this.chart,
        this.liveSkySelectedBodyId,
        (bodyId) => {
          this.liveSkySelectedBodyId = bodyId;
          this.renderLiveSkyMatcher();
        }
      );
    } else {
      this.liveSkyCanvas = null;
    }

    if (isChartView) {
      this.renderQuickPills();
      this.renderInspector();
      this.renderLiveSkyMatcher();
      this.renderElectionalPlanner();
      this.renderTabContent();
    } else {
      this.renderLocationDropdown();
      this.renderAuthModalContent();
    }
    this.bindDOMEvents();
  }

  private renderElectionalPlanner(): void {
    const container = document.getElementById('electional-planner-container');
    if (!container) return;

    const res = this.electionalResult;
    const catList = Object.values(ELECTIONAL_CATEGORIES);
    const selectedDay =
      res.allDays.find((d) => d.dateIso === this.selectedElectionalDayIso) ||
      res.topOptimalDays[0] ||
      res.allDays[0];

    container.innerHTML = `
      <div class="electional-header">
        <div class="electional-title-block">
          <div class="live-sky-title-row">
            <span class="live-pulse-dot" style="background:#F59E0B;" aria-hidden="true"></span>
            <h2 class="live-sky-title">🔮 30 Günlük Kozmik Zamanlama &amp; Soru Danışmanı (Gerçek Ephemeris Taraması)</h2>
            <span class="badge" style="color:#FDE68A; border-color:rgba(245,158,11,0.5); background:rgba(245,158,11,0.14);">
              %100 Gerçek Astronomik Veri (VSOP87 / JPL)
            </span>
          </div>
          <p class="electional-subtitle">
            Seçtiğiniz kategoriyle ilgili doğum haritası evlerinizi, kişisel ev yöneticilerinizi ve natal gezegen derecelerinizi önümüzdeki 30 günün (<strong>${res.startDateFormatted} — ${res.endDateFormatted}</strong>) gerçek gökyüzü boylamlarıyla gün gün karşılaştırır.
          </p>
        </div>
      </div>

      <!-- SADECE KATEGORİLERE AYRILMIŞ BAŞLIKLAR -->
      <div class="electional-category-pills" role="toolbar" aria-label="Zamanlama Kategorileri">
        ${catList
          .map((cat) => {
            const isAct = cat.id === res.category.id;
            return `
              <button
                type="button"
                class="planet-pill-btn ${isAct ? 'selected' : ''}"
                data-elec-cat="${cat.id}"
                aria-pressed="${isAct}"
              >
                <span>${cat.icon}</span>
                <span>${cat.shortLabel}</span>
              </button>
            `;
          })
          .join('')}
      </div>

      <!-- KİŞİSEL HARİTA METODOLOJİ VE EV YÖNETİCİSİ KANIT KUTUSU -->
      <div class="electional-methodology-bar">
        <div>
          <strong>📐 Kişisel Harita Referanslarınız (${res.category.icon} ${res.category.title}):</strong>
          <span>${res.category.methodologyText}</span>
        </div>
        <div class="electional-rulers-row">
          ${res.natalFocusSummary.personalHouseRulers
            .map(
              (r) => `
              <span class="profile-meta-chip">
                <strong>${r.house}. Eviniz:</strong> ${r.cuspSign} (${r.cuspDegree}) → Yöneticisi: ${renderBodyGlyph(r.rulerGlyph)} <strong>${r.rulerName}</strong> (Natal ${r.rulerNatalSign}, ${r.rulerNatalHouse}. Ev)
              </span>
            `
            )
            .join('')}
        </div>
      </div>

      <!-- TIKLANDIĞINDA AŞAĞIYA DOĞRU AÇILIR AKORDEON: ÖNÜMÜZDEKİ 30 GÜNDE EN UYGUN GÜNLER (modern-web-guidance: search-hidden-content) -->
      <details id="optimal-days-accordion" class="electional-accordion" ${this.isOptimalAccordionOpen ? 'open' : ''}>
        <summary class="electional-accordion-summary">
          <span class="electional-summary-left">
            <span>🌟 Önümüzdeki 30 Günde En Uygun Günler (${res.topOptimalDays.length} Gün — Gerçek Açı &amp; Orb Kanıtlı)</span>
          </span>
          <span class="electional-summary-hint">Listeyi Aç / Kapat ▾</span>
        </summary>
        <div class="electional-accordion-body">
          <div class="electional-optimal-grid">
            ${res.topOptimalDays
              .map((day, idx) => {
                const isSel = day.dateIso === selectedDay.dateIso;
                const topEv = day.supportiveEvidences[0];
                return `
                  <div
                    class="electional-day-card optimal ${isSel ? 'selected' : ''}"
                    data-open-elec-day="${day.dateIso}"
                    role="button"
                    tabindex="0"
                  >
                    <div class="electional-day-card-head">
                      <div>
                        <span class="electional-rank-badge">#${idx + 1} En Uygun Gün</span>
                        <strong class="electional-date-title">${day.dateFormatted}</strong>
                      </div>
                      <span class="badge" style="color:#6EE7B7; border-color:rgba(16,185,129,0.5); background:rgba(16,185,129,0.14);">
                        Net Açı Puanı: ${day.netScore >= 0 ? '+' : ''}${day.netScore}
                      </span>
                    </div>
                    <div class="electional-day-meta">
                      <span>☽ Ay: <strong>${day.moonSignGlyph} ${day.moonSignName} ${day.moonDegreeFormatted}</strong> (Natal ${day.moonNatalHouse}. Evinizde)</span>
                      <span>•</span>
                      <span>${day.lunarPhaseName}</span>
                    </div>
                    ${
                      topEv
                        ? `<div class="electional-top-evidence">
                            <strong>Ana Göksel Kanıt:</strong> Transit ${renderBodyGlyph(topEv.transitBodyGlyph)} <strong>${topEv.transitBodyName}</strong> (${topEv.transitSignName} ${topEv.transitDegreeFormatted})
                            <strong>${topEv.aspectGlyph} ${topEv.aspectName}</strong> Natal ${renderBodyGlyph(topEv.natalTargetGlyph)} <strong>${topEv.natalTargetName}</strong> (${topEv.natalSignName} ${topEv.natalDegreeFormatted})
                            — <span style="color:#67E8F9; font-family:var(--font-mono);">Orb: ${topEv.orbFormatted}</span>
                          </div>`
                        : ''
                    }
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>
      </details>

      ${
        res.cautionDays.length > 0
          ? `
        <details id="caution-days-accordion" class="electional-accordion caution-accordion" ${this.isCautionAccordionOpen ? 'open' : ''}>
          <summary class="electional-accordion-summary caution-summary">
            <span class="electional-summary-left">
              <span>⚠️ Dikkat Edilmesi / Esnek Olunması Önerilen Günler (${res.cautionDays.length} Gün — Sert Kare/Karşıt Açılar)</span>
            </span>
            <span class="electional-summary-hint">Listeyi Aç / Kapat ▾</span>
          </summary>
          <div class="electional-accordion-body">
            <div class="electional-optimal-grid">
              ${res.cautionDays
                .map((day) => {
                  const isSel = day.dateIso === selectedDay.dateIso;
                  const topChal = day.challengingEvidences[0];
                  return `
                    <div
                      class="electional-day-card caution ${isSel ? 'selected' : ''}"
                      data-open-elec-day="${day.dateIso}"
                      role="button"
                      tabindex="0"
                    >
                      <div class="electional-day-card-head">
                        <div>
                          <span class="electional-rank-badge caution-badge">⚠️ Yüksek Gerilim Açısı</span>
                          <strong class="electional-date-title">${day.dateFormatted}</strong>
                        </div>
                        <span class="badge badge-retro">
                          Net Açı Puanı: ${day.netScore}
                        </span>
                      </div>
                      ${
                        topChal
                          ? `<div class="electional-top-evidence">
                              <strong>Gerilim Kanıtı:</strong> Transit ${renderBodyGlyph(topChal.transitBodyGlyph)} <strong>${topChal.transitBodyName}</strong> (${topChal.transitSignName} ${topChal.transitDegreeFormatted})
                              <strong>${topChal.aspectGlyph} ${topChal.aspectName}</strong> Natal ${renderBodyGlyph(topChal.natalTargetGlyph)} <strong>${topChal.natalTargetName}</strong> (${topChal.natalSignName} ${topChal.natalDegreeFormatted})
                              — <span style="color:#FDA4AF; font-family:var(--font-mono);">Orb: ${topChal.orbFormatted}</span>
                            </div>`
                          : ''
                      }
                    </div>
                  `;
                })
                .join('')}
            </div>
          </div>
        </details>
      `
          : ''
      }

      <!-- 30 GÜNLÜK TAM TAKVİM ŞERİDİ (TIKLANDIĞINDA AÇILIR PENCEREDE DETAY GÖSTERİR) -->
      <div class="electional-Strip-wrap">
        <div class="live-sky-block-header">
          <span>📅 30 Günlük Tam Ephemeris Takvimi (Güne Tıklayarak Açılır Pencerede Detayları Görün)</span>
          <small>Yeşil: En Uygun • Mavi: Destekleyici • Kırmızı: Gerilimli Açı</small>
        </div>
        <div class="electional-calendar-strip" role="listbox" aria-label="30 Günlük Astrolojik Takvim">
          ${res.allDays
            .map((d) => {
              const isSel = d.dateIso === selectedDay.dateIso;
              return `
                <button
                  type="button"
                  role="option"
                  aria-selected="${isSel}"
                  class="electional-cal-day ${d.verdict} ${isSel ? 'selected' : ''}"
                  data-open-elec-day="${d.dateIso}"
                >
                  <span class="cal-day-date">${d.shortDateFormatted}</span>
                  <span class="cal-day-moon">${d.moonSignGlyph} ${d.moonSignName.slice(0, 3)}</span>
                  <span class="cal-day-score">${d.netScore >= 0 ? '+' : ''}${d.netScore}</span>
                </button>
              `;
            })
            .join('')}
        </div>
      </div>

      <!-- SEÇİLEN GÜNÜN AÇILIR PENCERE (MODAL DIALOG) DETAYI (modern-web-guidance: light-dismiss-a-dialog) -->
      <dialog id="electional-day-modal" closedby="any" class="astro-dialog" aria-labelledby="electional-modal-title">
        <div class="dialog-inner" id="electional-day-modal-content"></div>
      </dialog>
    `;

    // Track accordion open/close state
    const optAcc = document.getElementById('optimal-days-accordion') as HTMLDetailsElement | null;
    optAcc?.addEventListener('toggle', () => {
      this.isOptimalAccordionOpen = optAcc.open;
    });

    const cautAcc = document.getElementById('caution-days-accordion') as HTMLDetailsElement | null;
    cautAcc?.addEventListener('toggle', () => {
      this.isCautionAccordionOpen = cautAcc.open;
    });

    const dayModal = document.getElementById('electional-day-modal') as HTMLDialogElement | null;
    if (dayModal) {
      this.setupDialogLightDismissFallback(dayModal);
    }

    container.querySelectorAll('[data-elec-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const catId = btn.getAttribute('data-elec-cat') as ElectionalCategoryId | null;
        if (catId && ELECTIONAL_CATEGORIES[catId]) {
          this.electionalCategoryId = catId;
          this.electionalQueryText = ELECTIONAL_CATEGORIES[catId].sampleQuestion;
          this.electionalResult = evaluateThirtyDayElectionalForecast(
            this.chart,
            this.electionalQueryText,
            this.electionalCategoryId,
            new Date()
          );
          this.selectedElectionalDayIso =
            this.electionalResult.topOptimalDays[0]?.dateIso ||
            this.electionalResult.allDays[0].dateIso;
          this.renderElectionalPlanner();
        }
      });
    });

    container.querySelectorAll('[data-open-elec-day]').forEach((el) => {
      el.addEventListener('click', () => {
        const iso = el.getAttribute('data-open-elec-day');
        if (iso) {
          this.selectedElectionalDayIso = iso;
          this.openElectionalDayModal(iso);
        }
      });
    });
  }

  private openElectionalDayModal(dateIso: string): void {
    const res = this.electionalResult;
    const selectedDay =
      res.allDays.find((d) => d.dateIso === dateIso) ||
      res.topOptimalDays[0] ||
      res.allDays[0];
    if (!selectedDay) return;

    // Update selected highlight in the calendar strip and accordion cards without closing open accordions
    document.querySelectorAll('[data-open-elec-day]').forEach((el) => {
      const isMatch = el.getAttribute('data-open-elec-day') === dateIso;
      el.classList.toggle('selected', isMatch);
      if (el.getAttribute('role') === 'option') {
        el.setAttribute('aria-selected', String(isMatch));
      }
    });

    const modalEl = document.getElementById('electional-day-modal') as HTMLDialogElement | null;
    const contentEl = document.getElementById('electional-day-modal-content');
    if (!modalEl || !contentEl) return;

    contentEl.innerHTML = `
      <div class="dialog-header">
        <div>
          <div class="electional-inspector-badge">${res.category.icon} ${res.category.shortLabel} • ${selectedDay.verdictLabel}</div>
          <h2 id="electional-modal-title" style="font-size:1.05rem; font-weight:800; color:#F8FAFC;">
            📅 ${selectedDay.dateFormatted} (Saat 12:00 Yerel Ephemeris)
          </h2>
        </div>
        <button type="button" id="close-electional-day-modal-btn" class="btn btn-icon" aria-label="Pencereyi Kapat">✕</button>
      </div>

      <div class="electional-inspector-chips">
        <span class="profile-meta-chip">☽ Ay Konumu: ${selectedDay.moonSignGlyph} ${selectedDay.moonSignName} ${selectedDay.moonDegreeFormatted} (${selectedDay.moonNatalHouse}. Ev)</span>
        <span class="profile-meta-chip">${selectedDay.lunarPhaseName} (${selectedDay.lunarElongationDeg.toFixed(1)}°)</span>
        <span class="profile-meta-chip">Astronomik Net Skor: ${selectedDay.netScore >= 0 ? '+' : ''}${selectedDay.netScore}</span>
      </div>

      ${
        selectedDay.keyTransitedHouses.length > 0
          ? `
        <div class="electional-evidence-group">
          <div class="electional-evidence-title" style="color:#67E8F9;">
            🪐 O Gün Hedef Evlerinizden (${res.natalFocusSummary.targetHousesLabel}) Geçen Gezegenler:
          </div>
          <div class="electional-house-transits">
            ${selectedDay.keyTransitedHouses
              .map(
                (kh) => `
              <span class="profile-meta-chip">
                ${renderBodyGlyph(kh.bodyGlyph)} <strong>${kh.bodyName}:</strong> ${kh.signName} ${kh.degreeFormatted} → <strong>${kh.house}. Evinizde</strong>
              </span>
            `
              )
              .join('')}
          </div>
        </div>
      `
          : ''
      }

      <div class="electional-evidence-group">
        <div class="electional-evidence-title" style="color:#6EE7B7;">
          ✅ Destekleyici Gerçek Gökyüzü Açıları (${selectedDay.supportiveEvidences.length} Açı):
        </div>
        ${
          selectedDay.supportiveEvidences.length > 0
            ? `<ul class="electional-evidence-list">
                ${selectedDay.supportiveEvidences
                  .map(
                    (ev) => `
                  <li class="electional-evidence-item supportive">
                    <div class="electional-ev-main">
                      <strong>${ev.aspectGlyph} ${ev.aspectName} (${ev.exactAngle}°):</strong>
                      Transit ${renderBodyGlyph(ev.transitBodyGlyph)} <strong>${ev.transitBodyName}</strong> (${ev.transitSignGlyph} ${ev.transitSignName} ${ev.transitDegreeFormatted}, ${ev.transitHouse}. Ev)
                      → Natal ${renderBodyGlyph(ev.natalTargetGlyph)} <strong>${ev.natalTargetName}</strong> (${ev.natalSignName} ${ev.natalDegreeFormatted}, ${ev.natalHouse}. Ev)
                    </div>
                    <div class="electional-ev-meta">
                      <span class="orb-pill" style="color:#6EE7B7; border-color:rgba(16,185,129,0.45);">Kesin Orb: ${ev.orbFormatted}</span>
                      <span class="badge">${ev.reasonTag}</span>
                    </div>
                  </li>
                `
                  )
                  .join('')}
              </ul>`
            : `<p class="electional-empty-note">Bu tarihte hedef ev/gezegenlerinize dar orb içinde destekleyici üçgen/sekstil açı bulunmuyor.</p>`
        }
      </div>

      <div class="electional-evidence-group">
        <div class="electional-evidence-title" style="color:#FDA4AF;">
          ⚡ Zorlayıcı / Dikkat Gerektiren Gerçek Gökyüzü Açıları (${selectedDay.challengingEvidences.length} Açı):
        </div>
        ${
          selectedDay.challengingEvidences.length > 0
            ? `<ul class="electional-evidence-list">
                ${selectedDay.challengingEvidences
                  .map(
                    (ev) => `
                  <li class="electional-evidence-item challenging">
                    <div class="electional-ev-main">
                      <strong>${ev.aspectGlyph} ${ev.aspectName} (${ev.exactAngle}°):</strong>
                      Transit ${renderBodyGlyph(ev.transitBodyGlyph)} <strong>${ev.transitBodyName}</strong> (${ev.transitSignGlyph} ${ev.transitSignName} ${ev.transitDegreeFormatted}, ${ev.transitHouse}. Ev)
                      → Natal ${renderBodyGlyph(ev.natalTargetGlyph)} <strong>${ev.natalTargetName}</strong> (${ev.natalSignName} ${ev.natalDegreeFormatted}, ${ev.natalHouse}. Ev)
                    </div>
                    <div class="electional-ev-meta">
                      <span class="orb-pill" style="color:#FDA4AF; border-color:rgba(244,63,94,0.45);">Kesin Orb: ${ev.orbFormatted}</span>
                      <span class="badge">${ev.reasonTag}</span>
                    </div>
                  </li>
                `
                  )
                  .join('')}
              </ul>`
            : `<p class="electional-empty-note">Bu tarihte hedef ev/gezegenlerinize dar orb içinde zorlayıcı kare veya karşıt açı bulunmuyor.</p>`
        }
      </div>

      ${
        selectedDay.retrogradeBodies.length > 0
          ? `
        <div class="electional-retro-footer">
          <strong>℞ O Gün Retro Harekette Olan Gezegenler:</strong> ${selectedDay.retrogradeBodies.map((r) => formatMarkdownBold(r)).join(' • ')}
        </div>
      `
          : ''
      }

      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.55rem; padding-block-start:0.4rem; border-block-start:1px solid var(--border-subtle);">
        <button
          type="button"
          id="preview-day-on-sky-wheel-btn"
          class="btn btn-icon active"
          data-preview-date="${selectedDay.dateIso}"
        >
          🌌 Bu Günün Gökyüzünü Haritada Gör
        </button>
        <button type="button" id="ok-electional-day-modal-btn" class="btn btn-primary">Kapat</button>
      </div>
    `;

    document.getElementById('close-electional-day-modal-btn')?.addEventListener('click', () => {
      modalEl.close();
    });
    document.getElementById('ok-electional-day-modal-btn')?.addEventListener('click', () => {
      modalEl.close();
    });

    const previewBtn = document.getElementById('preview-day-on-sky-wheel-btn');
    previewBtn?.addEventListener('click', () => {
      const targetIso = previewBtn.getAttribute('data-preview-date');
      if (!targetIso) return;
      modalEl.close();
      const { utcDate } = resolveLocalToUtc(targetIso, '12:00', this.birthInput.location.timezone);
      this.isPreviewingFutureDate = true;
      this.recalculateChart(utcDate);
      this.selectedElectionalDayIso = targetIso;
      this.renderShell();
      document.querySelector('.live-sky-module')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    });

    if (!modalEl.open) {
      modalEl.showModal();
    }
  }

  private renderLiveSkyMatcher(): void {
    const detailEl = document.getElementById('live-sky-selected-detail');
    const gridEl = document.getElementById('live-sky-planet-grid');
    const chipsEl = document.getElementById('live-sky-active-chips');
    if (!detailEl || !gridEl) return;

    const tp =
      this.chart.transitPlanets.find((p) => p.id === this.liveSkySelectedBodyId) ||
      this.chart.transitPlanets[0];
    if (!tp) return;

    const elColor = ELEMENT_COLORS[tp.sign.element].primary;
    const elGlow = ELEMENT_COLORS[tp.sign.element].glow;
    const houseMeta = HOUSE_THEMES[tp.house];
    const matchingTransits = this.chart.activeTransits.filter(
      (at) => at.transitBody.id === tp.id
    );

    // Find closest aspect to any natal planet/angle if no tight <=2.0° aspect is active
    let closestNatalInfo = '';
    if (matchingTransits.length === 0) {
      const majorAngles = [
        { deg: 0, name: 'Kavuşum (0°)', glyph: '☌' },
        { deg: 60, name: 'Sekstil (60°)', glyph: '⚹' },
        { deg: 90, name: 'Kare (90°)', glyph: '□' },
        { deg: 120, name: 'Üçgen (120°)', glyph: '△' },
        { deg: 180, name: 'Karşıt (180°)', glyph: '☍' }
      ];
      let bestOrb = 999;
      let bestLabel = '';
      for (const np of this.chart.planets) {
        const dist = shortestAngularDistance(tp.longitude, np.longitude);
        for (const ma of majorAngles) {
          const orb = Math.abs(dist - ma.deg);
          if (orb < bestOrb) {
            bestOrb = orb;
            bestLabel = `${ma.glyph} Natal ${renderBodyGlyph(np.glyph)} ${np.name} (${np.sign.glyph} ${np.degreeFormatted}) ile ${ma.name} — Orb: ${orb.toFixed(2)}°`;
          }
        }
      }
      if (bestLabel) {
        closestNatalInfo = bestLabel;
      }
    }

    detailEl.innerHTML = `
      <div class="live-sky-detail-top">
        <div class="inspector-glyph-box" style="color:${elColor}; border-color:${elColor}; box-shadow: 0 0 16px ${elGlow};">
          ${renderBodyGlyph(tp.glyph)}
        </div>
        <div class="inspector-title-group">
          <div class="inspector-title">
            <span>Anlık ${tp.name} — ${tp.sign.glyph} ${tp.sign.name}</span>
            <span class="profile-meta-chip">${tp.degreeFormatted}</span>
            <span class="badge" style="color:#67E8F9; border-color:rgba(6,182,212,0.5);">Natal ${tp.house}. Evinizde</span>
            ${tp.isRetrograde ? `<span class="badge badge-retro">℞ Retro</span>` : `<span class="badge" style="color:#6EE7B7; border-color:rgba(16,185,129,0.4);">İleri Hareket</span>`}
          </div>
          <div class="inspector-subtitle">
            ${tp.sign.elementName} Elementi • ${tp.sign.modalityName} Nitelik • Günlük Hız: ${tp.speed >= 0 ? '+' : ''}${tp.speed.toFixed(2)}°/gün
          </div>
        </div>
      </div>

      <div class="live-sky-resonance-box">
        <div class="live-sky-resonance-house">
          <strong>🏠 Haritanızdaki Konum (${tp.house}. Ev — ${houseMeta.shortArena}):</strong>
          Gökyüzünde şu an <strong>${tp.sign.name} (${tp.degreeFormatted})</strong> derecesinde ilerleyen <strong>${tp.name}</strong>, doğum haritanızın <em>${houseMeta.transitActionDomain}</em> temalarını temsil eden <strong>${tp.house}. Ev</strong> alanından geçiyor.
        </div>

        ${
          matchingTransits.length > 0
            ? `<div class="live-sky-resonance-matches">
                ${matchingTransits
                  .map((tr) => {
                    const toneColor =
                      tr.nature === 'harmonious'
                        ? '#10B981'
                        : tr.nature === 'challenging'
                          ? '#EF4444'
                          : '#F59E0B';
                    return `
                      <div class="live-sky-match-item" style="border-inline-start: 3px solid ${toneColor};">
                        <div class="live-sky-match-head">
                          <strong>⚡ ${formatMarkdownBold(tr.headline)}</strong>
                          <span class="orb-pill" style="color:${toneColor}; border-color:${toneColor}55;">
                            Orb: ${tr.orb.toFixed(2)}° • ${tr.isApplying ? 'Yaklaşan' : 'Uzaklaşan'}
                          </span>
                        </div>
                        <p>${formatMarkdownBold(tr.summary)}</p>
                      </div>
                    `;
                  })
                  .join('')}
              </div>`
            : `<div class="live-sky-resonance-calm">
                <span>🎯 <strong>Dar Orb (±2.0°) Durumu:</strong> Anlık ${tp.name} şu an ±2.0° dar orb içinde kesin bir majör açı yapmıyor; ${tp.house}. Ev konularını arka planda çalıştırıyor.</span>
                ${closestNatalInfo ? `<small>En yakın açısal yaklaşım: ${closestNatalInfo}</small>` : ''}
              </div>`
        }
      </div>
    `;

    gridEl.innerHTML = this.chart.transitPlanets
      .map((p) => {
        const isSel = p.id === tp.id;
        const tightCount = this.chart.activeTransits.filter(
          (at) => at.transitBody.id === p.id
        ).length;
        const pColor = ELEMENT_COLORS[p.sign.element].primary;
        return `
          <button
            type="button"
            class="live-sky-planet-card ${isSel ? 'selected' : ''} ${tightCount > 0 ? 'has-tight' : ''}"
            data-live-body-id="${p.id}"
            aria-pressed="${isSel}"
          >
            <div class="live-sky-planet-card-top">
              <span class="live-sky-p-name" style="color:${isSel ? '#67E8F9' : pColor};">
                ${renderBodyGlyph(p.glyph)}
                <span>${p.name}</span>
              </span>
              ${
                tightCount > 0
                  ? `<span class="live-sky-tight-dot" title="${tightCount} Aktif Dar Orb Transit">⚡${tightCount}</span>`
                  : p.isRetrograde
                    ? `<span class="live-sky-retro-tag">℞</span>`
                    : ''
              }
            </div>
            <div class="live-sky-planet-card-mid">
              <span>${p.sign.glyph} ${p.degreeFormatted}</span>
              <span class="live-sky-house-tag">${p.house}. Ev</span>
            </div>
          </button>
        `;
      })
      .join('');

    gridEl.querySelectorAll('[data-live-body-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-live-body-id') as BodyId | null;
        if (id) {
          this.liveSkySelectedBodyId = id;
          this.liveSkyCanvas?.setSelectedBody(id, false);
          this.renderLiveSkyMatcher();
        }
      });
    });

    if (chipsEl) {
      if (this.chart.activeTransits.length > 0) {
        chipsEl.innerHTML = `
          <div class="live-sky-chips-row">
            <span class="live-sky-chips-label">⚡ Aktif ±2.0° Eşleşmeler:</span>
            ${this.chart.activeTransits
              .map((at) => {
                const isAct = at.transitBody.id === tp.id;
                return `
                  <button
                    type="button"
                    class="planet-pill-btn ${isAct ? 'selected' : ''}"
                    data-live-chip-body="${at.transitBody.id}"
                  >
                    ${renderBodyGlyph(at.transitBody.glyph)}
                    <span>${at.transitBody.name} ${at.glyph} ${at.natalTarget.name} (${at.orb.toFixed(2)}°)</span>
                  </button>
                `;
              })
              .join('')}
            <button type="button" id="jump-to-transits-tab-btn" class="btn btn-icon" style="margin-inline-start:auto; color:#67E8F9; border-color:rgba(6,182,212,0.4);">
              Tüm Transit Raporu (${this.chart.activeTransits.length}) ↓
            </button>
          </div>
        `;

        chipsEl.querySelectorAll('[data-live-chip-body]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-live-chip-body') as BodyId | null;
            if (id) {
              this.liveSkySelectedBodyId = id;
              this.liveSkyCanvas?.setSelectedBody(id, false);
              this.renderLiveSkyMatcher();
            }
          });
        });

        document.getElementById('jump-to-transits-tab-btn')?.addEventListener('click', () => {
          this.activeTab = 'active-transits';
          document.querySelectorAll('.tab-btn[data-tab]').forEach((b) => {
            const isAct = b.getAttribute('data-tab') === 'active-transits';
            b.classList.toggle('active', isAct);
            b.setAttribute('aria-selected', String(isAct));
          });
          this.renderTabContent();
          document.getElementById('tab-panel-content')?.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        });
      } else {
        chipsEl.innerHTML = '';
      }
    }
  }

  private renderQuickPills(): void {
    const container = document.getElementById('wheel-quick-pills');
    if (!container) return;

    const planetCards = this.chart.planets
      .map((p) => {
        const isSel =
          this.selection?.kind === 'planet' && this.selection.id === p.id;
        const pColor = ELEMENT_COLORS[p.sign.element].primary;
        const aspectCount = this.chart.natalAspects.filter(
          (a) => a.bodyA === p.id || a.bodyB === p.id
        ).length;
        return `
          <button
            type="button"
            class="live-sky-planet-card ${isSel ? 'selected' : ''} ${aspectCount > 0 ? 'has-tight' : ''}"
            data-sel-kind="planet"
            data-sel-id="${p.id}"
            aria-pressed="${isSel}"
          >
            <div class="live-sky-planet-card-top">
              <span class="live-sky-p-name" style="color:${isSel ? '#67E8F9' : pColor};">
                ${renderBodyGlyph(p.glyph)}
                <span>${p.name}</span>
              </span>
              <span style="display:inline-flex; align-items:center; gap:0.2rem;">
                ${p.isRetrograde ? `<span class="live-sky-retro-tag" title="Retro Hareket">℞</span>` : ''}
                ${aspectCount > 0 ? `<span class="live-sky-tight-dot" title="${aspectCount} Majör Açı">📐${aspectCount}</span>` : ''}
              </span>
            </div>
            <div class="live-sky-planet-card-mid">
              <span>${p.sign.glyph} ${p.degreeFormatted}</span>
              <span class="live-sky-house-tag">${p.house}. Ev</span>
            </div>
          </button>
        `;
      })
      .join('');

    const angleHouseMap: Record<AngleId, { house: number; tag: string }> = {
      asc: { house: 1, tag: 'Yükselen' },
      mc: { house: 10, tag: 'Zenith' },
      dsc: { house: 7, tag: 'Alçalan' },
      ic: { house: 4, tag: 'Dip Nokta' }
    };

    const angleCards = (['asc', 'mc', 'dsc', 'ic'] as AngleId[])
      .map((aid) => {
        const ang = this.chart.angles[aid];
        const isSel =
          this.selection?.kind === 'angle' && this.selection.id === aid;
        const aColor = ELEMENT_COLORS[ang.sign.element].primary;
        const aspectCount = this.chart.natalAspects.filter(
          (a) => a.bodyA === aid || a.bodyB === aid
        ).length;
        const meta = angleHouseMap[aid];
        return `
          <button
            type="button"
            class="live-sky-planet-card ${isSel ? 'selected' : ''}"
            data-sel-kind="angle"
            data-sel-id="${aid}"
            aria-pressed="${isSel}"
          >
            <div class="live-sky-planet-card-top">
              <span class="live-sky-p-name" style="color:${isSel ? '#67E8F9' : aColor};">
                <span>🧭</span>
                <span>${ang.shortLabel} (${meta.tag})</span>
              </span>
              ${aspectCount > 0 ? `<span class="live-sky-tight-dot" title="${aspectCount} Majör Açı">📐${aspectCount}</span>` : ''}
            </div>
            <div class="live-sky-planet-card-mid">
              <span>${ang.sign.glyph} ${ang.degreeFormatted}</span>
              <span class="live-sky-house-tag">${meta.house}. Ev</span>
            </div>
          </button>
        `;
      })
      .join('');

    container.innerHTML = planetCards + angleCards;

    container.querySelectorAll('[data-sel-kind]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const kind = btn.getAttribute('data-sel-kind');
        const id = btn.getAttribute('data-sel-id');
        if (kind === 'planet' && id) {
          this.selection = { kind: 'planet', id: id as BodyId };
        } else if (kind === 'angle' && id) {
          this.selection = { kind: 'angle', id: id as AngleId };
        }
        this.wheelCanvas?.setSelection(this.selection, false);
        this.renderQuickPills();
        this.renderInspector();
      });
    });
  }

  private renderInspector(): void {
    const container = document.getElementById('inspector-container');
    if (!container) return;

    const sel = this.selection || { kind: 'planet', id: 'sun' };
    const mobileBanner = document.getElementById('mobile-selection-banner');
    if (mobileBanner) {
      let summaryLabel = '';
      if (sel.kind === 'planet') {
        const p = this.chart.syntheses[sel.id].planet;
        summaryLabel = `<strong>${renderBodyGlyph(p.glyph)} ${p.name}</strong> — ${p.sign.glyph} ${p.fullFormatted} (${p.house}. Ev)`;
      } else if (sel.kind === 'angle') {
        const ang = this.chart.angles[sel.id];
        summaryLabel = `<strong>${ang.shortLabel}</strong> — ${ang.sign.glyph} ${ang.fullFormatted}`;
      } else {
        const cusp = this.chart.houses[sel.house - 1];
        summaryLabel = `<strong>${cusp.house}. Ev</strong> — ${cusp.sign.glyph} ${cusp.degreeFormatted} ${cusp.sign.name}`;
      }
      mobileBanner.innerHTML = `
        <span style="min-inline-size:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${summaryLabel}</span>
        <button type="button" id="scroll-to-inspector-btn" class="btn btn-icon" style="color:var(--accent-gold); border-color:rgba(245,158,11,0.4);">
          Analizi Gör ↓
        </button>
      `;
      document.getElementById('scroll-to-inspector-btn')?.addEventListener('click', () => {
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    if (sel.kind === 'planet') {
      const syn = this.chart.syntheses[sel.id];
      const p = syn.planet;
      const elColor = ELEMENT_COLORS[p.sign.element].primary;

      container.innerHTML = `
        <div class="inspector-header">
          <div style="display:flex; gap:0.9rem; align-items:center;">
            <div class="inspector-glyph-box" style="color:${elColor}; border-color:${elColor}; box-shadow: 0 0 18px ${ELEMENT_COLORS[p.sign.element].glow};">
              ${renderBodyGlyph(p.glyph)}
            </div>
            <div class="inspector-title-group">
              <div class="inspector-title">
                <span>${p.name} — ${p.sign.glyph} ${p.sign.name}</span>
                <span class="profile-meta-chip">${p.degreeFormatted}</span>
                <span class="badge" style="color:${elColor}; border-color:${elColor};">${p.house}. Ev</span>
                ${p.isRetrograde ? `<span class="badge badge-retro">℞ Retro</span>` : ''}
                ${p.dignity && p.dignity !== 'Peregrin' ? `<span class="badge badge-dignity">✦ ${p.dignity}</span>` : ''}
              </div>
              <div class="inspector-subtitle">
                ${p.sign.elementName} Elementi • ${p.sign.modalityName} Nitelik • Günlük Hız: ${p.speed >= 0 ? '+' : ''}${p.speed.toFixed(2)}°/gün
              </div>
            </div>
          </div>
        </div>

        <div class="synthesis-layers">
          <!-- LAYER 1: LOCATION -->
          <div class="layer-card layer-1">
            <div class="layer-header">
              <span class="layer-title">🪐 ${syn.layer1Location.title}</span>
              <span class="badge">${syn.layer1Location.signTheme}</span>
            </div>
            <div class="layer-body">
              ${formatMarkdownBold(syn.layer1Location.narrative)}
            </div>
          </div>

          <!-- LAYER 2: ASPECT MODULATION -->
          <div class="layer-card layer-2">
            <div class="layer-header">
              <span class="layer-title">📐 ${syn.layer2AspectModulation.title}</span>
              <span class="badge" style="color:var(--accent-blue);">${syn.layer2AspectModulation.dominantTone}</span>
            </div>
            <div class="layer-body">
              <p>${formatMarkdownBold(syn.layer2AspectModulation.synthesisText)}</p>
              ${
                syn.layer2AspectModulation.aspectBullets.length > 0
                  ? `<ul class="aspect-modulation-list">
                      ${syn.layer2AspectModulation.aspectBullets
                        .map(
                          (b) => `
                        <li class="aspect-modulation-item" style="border-inline-start: 3px solid ${b.aspect.color}">
                          <strong>${b.aspect.glyph}</strong> ${formatMarkdownBold(b.modulationText)}
                        </li>
                      `
                        )
                        .join('')}
                    </ul>`
                  : ''
              }
            </div>
          </div>

          <!-- LAYER 3: DISPOSITOR / RULERSHIP -->
          <div class="layer-card layer-3">
            <div class="layer-header">
              <span class="layer-title">👑 ${syn.layer3Dispositor.title}</span>
              <span class="badge" style="color:var(--accent-emerald);">
                ${syn.layer3Dispositor.isSelfRuled ? 'Öz-Yönetici (Domicile)' : `${syn.layer3Dispositor.rulerSign} / ${syn.layer3Dispositor.rulerHouse}. Ev`}
              </span>
            </div>
            <div class="layer-body">
              ${formatMarkdownBold(syn.layer3Dispositor.chainNarrative)}
            </div>
          </div>

          <!-- LAYER 4: DAILY TRANSIT SUMMARY -->
          <div class="layer-card layer-4">
            <div class="layer-header">
              <span class="layer-title">⚡ ${syn.layer4TransitSummary.title}</span>
              <span class="badge" style="color:#67E8F9; border-color:rgba(6,182,212,0.4);">
                ${syn.layer4TransitSummary.hasTightTransit ? 'Aktif Dar Orblu Transit (±2°)' : 'Ev Akışı İzleniyor'}
              </span>
            </div>
            <div class="layer-body">
              ${formatMarkdownBold(syn.layer4TransitSummary.bulletinText)}
            </div>
          </div>
        </div>
      `;
      return;
    }

    if (sel.kind === 'angle') {
      const ang = this.chart.angles[sel.id];
      const houseNum =
        sel.id === 'asc' ? 1 : sel.id === 'ic' ? 4 : sel.id === 'dsc' ? 7 : 10;
      const houseMeta = HOUSE_THEMES[houseNum];
      const rulerPlanet =
        this.chart.planets.find((p) => p.id === ang.sign.ruler) || this.chart.planets[0];
      const elColor = ELEMENT_COLORS[ang.sign.element].primary;

      container.innerHTML = `
        <div class="inspector-header">
          <div style="display:flex; gap:0.9rem; align-items:center;">
            <div class="inspector-glyph-box" style="color:${elColor}; border-color:${elColor}; font-size:0.95rem;">
              ${ang.shortLabel}
            </div>
            <div class="inspector-title-group">
              <div class="inspector-title">
                <span>${ang.name} — ${ang.sign.glyph} ${ang.sign.name}</span>
                <span class="profile-meta-chip">${ang.degreeFormatted}</span>
              </div>
              <div class="inspector-subtitle">
                ${houseMeta.title} • Eksen Yöneticisi: ${renderBodyGlyph(rulerPlanet.glyph)} ${rulerPlanet.name} (${rulerPlanet.sign.name}, ${rulerPlanet.house}. Ev)
              </div>
            </div>
          </div>
        </div>

        <div class="synthesis-layers">
          <div class="layer-card layer-1">
            <div class="layer-header">
              <span class="layer-title">🧭 Ana Eksen Mimarisi</span>
            </div>
            <div class="layer-body">
              <strong>${ang.name}</strong>, doğum anınızda ufuk ve meridyen düzleminin zodyak kuşağıyla kesiştiği en kritik kardinal kapıdır. <strong>${ang.fullFormatted}</strong> derecesindeki bu yerleşim, ${houseMeta.arenaDescription} alanında <strong>${ang.sign.keywords.join(', ')}</strong> ilkeleriyle hareket ettiğinizi gösterir.
            </div>
          </div>
          <div class="layer-card layer-3">
            <div class="layer-header">
              <span class="layer-title">👑 Eksen Yöneticisi Bağlantısı</span>
            </div>
            <div class="layer-body">
              ${ang.shortLabel} burcunuz olan ${ang.sign.name}'in yöneticisi <strong>${renderBodyGlyph(rulerPlanet.glyph)} ${rulerPlanet.name}</strong>, haritanızda <strong>${rulerPlanet.fullFormatted}</strong> konumunda ve <strong>${rulerPlanet.house}. Evde</strong> yer alıyor. Bu durum, ${houseNum}. ev temalarınızın doğrudan ${rulerPlanet.house}. ev yaşam sahnesiyle birbirine kenetlendiğini gösterir.
            </div>
          </div>
        </div>
      `;
      return;
    }

    if (sel.kind === 'house') {
      const cusp = this.chart.houses[sel.house - 1];
      const houseMeta = HOUSE_THEMES[cusp.house];
      const rulerPlanet =
        this.chart.planets.find((p) => p.id === cusp.rulerId) || this.chart.planets[0];
      const natalInHouse = this.chart.planets.filter((p) => p.house === cusp.house);
      const transitInHouse = this.chart.transitPlanets.filter(
        (tp) => tp.house === cusp.house
      );
      const elColor = ELEMENT_COLORS[cusp.sign.element].primary;

      container.innerHTML = `
        <div class="inspector-header">
          <div style="display:flex; gap:0.9rem; align-items:center;">
            <div class="inspector-glyph-box" style="color:${elColor}; border-color:${elColor}; font-size:0.92rem;">
              ${cusp.house}. Ev
            </div>
            <div class="inspector-title-group">
              <div class="inspector-title">
                <span>${houseMeta.title}</span>
                <span class="profile-meta-chip">${cusp.sign.glyph} ${cusp.degreeFormatted} ${cusp.sign.name}</span>
              </div>
              <div class="inspector-subtitle">
                Placidus Ev Başlangıcı • Ev Yöneticisi: ${renderBodyGlyph(rulerPlanet.glyph)} ${rulerPlanet.name} (${rulerPlanet.house}. Evde)
              </div>
            </div>
          </div>
        </div>

        <div class="synthesis-layers">
          <div class="layer-card layer-1">
            <div class="layer-header">
              <span class="layer-title">🏛️ Yaşam Alanı &amp; Burç Sentezi</span>
            </div>
            <div class="layer-body">
              Haritanızda <strong>${cusp.house}. Ev</strong> başlangıcı <strong>${cusp.sign.name}</strong> burcunun ${cusp.degreeFormatted} derecesiyle açılıyor. Yaşamınızda ${houseMeta.arenaDescription} süreçlerini ${cusp.sign.name} burcunun <strong>${cusp.sign.keywords.join(', ')}</strong> doğasıyla yönetirsiniz.
            </div>
          </div>

          <div class="layer-card layer-2">
            <div class="layer-header">
              <span class="layer-title">🪐 Bu Evdeki Natal Gezegenler (${natalInHouse.length})</span>
            </div>
            <div class="layer-body">
              ${
                natalInHouse.length > 0
                  ? natalInHouse
                      .map(
                        (p) =>
                          `<div>• <strong>${renderBodyGlyph(p.glyph)} ${p.name}</strong> (${p.fullFormatted}${p.isRetrograde ? ' ℞' : ''}) — Bu yaşam alanına doğrudan aktif arketipsel odak taşır.</div>`
                      )
                      .join('')
                  : `Bu evde yerleşik natal gezegen bulunmuyor (boş ev); evin enerjisi doğrudan yöneticisi olan <strong>${renderBodyGlyph(rulerPlanet.glyph)} ${rulerPlanet.name}</strong> (${rulerPlanet.sign.name}, ${rulerPlanet.house}. Ev) üzerinden çalışır.`
              }
            </div>
          </div>

          <div class="layer-card layer-4">
            <div class="layer-header">
              <span class="layer-title">⚡ Anlık Gökyüzü Transit Geçişleri (${transitInHouse.length})</span>
            </div>
            <div class="layer-body">
              ${
                transitInHouse.length > 0
                  ? `Bugün gökyüzünde <strong>${transitInHouse.map((t) => `${renderBodyGlyph(t.glyph)} ${t.name} (${t.fullFormatted})`).join(', ')}</strong> doğrudan ${cusp.house}. evinizden geçerek ${houseMeta.transitActionDomain} güncel hareketlilik yaratıyor.`
                  : `Şu anda bu evinizden geçen bir transit gezegen bulunmuyor; rutin akış korunuyor.`
              }
            </div>
          </div>
        </div>
      `;
    }
  }

  private renderTabContent(): void {
    const container = document.getElementById('tab-panel-content');
    if (!container) return;

    const sun = this.chart.planets.find((p) => p.id === 'sun')!;
    const moon = this.chart.planets.find((p) => p.id === 'moon')!;
    const asc = this.chart.angles.asc;
    const mc = this.chart.angles.mc;
    const ruler = this.chart.chartRuler;

    if (this.activeTab === 'big-three') {
      container.innerHTML = `
        <div class="big-three-grid">
          <article class="archetype-card">
            <div class="archetype-card-top">
              <span class="archetype-role">☉ Güneş Burcu — Bilinçli Öz &amp; İrade</span>
              <span class="archetype-degree-mono">${sun.degreeFormatted} • ${sun.house}. Ev</span>
            </div>
            <div class="archetype-sign-headline">
              <span style="color:${ELEMENT_COLORS[sun.sign.element].primary}">${sun.sign.glyph}</span>
              <span>${sun.sign.name}</span>
            </div>
            <p style="font-size:0.84rem; color:#CBD5E1;">
              ${formatMarkdownBold(this.chart.syntheses.sun.layer1Location.narrative)}
            </p>
          </article>

          <article class="archetype-card">
            <div class="archetype-card-top">
              <span class="archetype-role">☽ Ay Burcu — Duygusal Pusula &amp; İçgüdü</span>
              <span class="archetype-degree-mono">${moon.degreeFormatted} • ${moon.house}. Ev</span>
            </div>
            <div class="archetype-sign-headline">
              <span style="color:${ELEMENT_COLORS[moon.sign.element].primary}">${moon.sign.glyph}</span>
              <span>${moon.sign.name}</span>
            </div>
            <p style="font-size:0.84rem; color:#CBD5E1;">
              ${formatMarkdownBold(this.chart.syntheses.moon.layer1Location.narrative)}
            </p>
          </article>

          <article class="archetype-card">
            <div class="archetype-card-top">
              <span class="archetype-role">ASC Yükselen — Persona &amp; Hayat Rotası</span>
              <span class="archetype-degree-mono">${asc.degreeFormatted} • 1. Ev Kapısı</span>
            </div>
            <div class="archetype-sign-headline">
              <span style="color:${ELEMENT_COLORS[asc.sign.element].primary}">${asc.sign.glyph}</span>
              <span>${asc.sign.name}</span>
            </div>
            <p style="font-size:0.84rem; color:#CBD5E1;">
              Dış dünyayla kurduğunuz ilk temas ve yaşama başlangıç motivasyonunuz <strong>${asc.sign.name}</strong> burcunun ${asc.sign.keywords.join(', ').toLocaleLowerCase('tr-TR')} filtresinden geçer. Harita yöneticiniz <strong>${renderBodyGlyph(ruler.glyph)} ${ruler.name}</strong>, <strong>${ruler.sign.name}</strong> burcunda ve <strong>${ruler.house}. Evde</strong> konumlanarak yaşam enerjinizi bu alana odaklar.
            </p>
          </article>

          <article class="archetype-card">
            <div class="archetype-card-top">
              <span class="archetype-role" style="color:var(--accent-cyan);">MC Zenith — Kariyer Zirvesi &amp; İtibar</span>
              <span class="archetype-degree-mono">${mc.degreeFormatted} • 10. Ev Zirvesi</span>
            </div>
            <div class="archetype-sign-headline">
              <span style="color:${ELEMENT_COLORS[mc.sign.element].primary}">${mc.sign.glyph}</span>
              <span>${mc.sign.name}</span>
            </div>
            <p style="font-size:0.84rem; color:#CBD5E1;">
              Toplumsal statü, kariyer zirvesi (Zenith) ve profesyonel miras ekseniniz <strong>${mc.fullFormatted}</strong> derecesindedir. Kamusal alanda <strong>${mc.sign.keywords.join(', ')}</strong> nitelikleriyle tanınır ve otorite inşa edersiniz.
            </p>
          </article>
        </div>

        <div class="element-balance-grid">
          ${(['fire', 'earth', 'air', 'water'] as const)
            .map((elKey) => {
              const info = this.chart.elementCounts[elKey];
              const names = {
                fire: '🔥 Ateş Elementi (İrade & Vizyon)',
                earth: '🌿 Toprak Elementi (Somutluk & İstikrar)',
                air: '🌬️ Hava Elementi (Analiz & İletişim)',
                water: '🌊 Su Elementi (Sezgi & Derinlik)'
              };
              const col = ELEMENT_COLORS[elKey].primary;
              return `
                <div class="balance-card">
                  <div style="display:flex; justify-content:space-between; font-size:0.8rem; font-weight:700;">
                    <span>${names[elKey]}</span>
                    <span style="color:${col};">%${info.percentage} (${info.count})</span>
                  </div>
                  <div class="progress-track">
                    <div class="progress-fill" style="width:${info.percentage}%; background:${col};"></div>
                  </div>
                  <div style="font-size:0.74rem; color:var(--text-secondary);">
                    ${formatMarkdownBold(info.bodies.join(' • ')) || 'Yerleşim yok'}
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      `;
      return;
    }

    if (this.activeTab === 'planet-table') {
      // Responsive Data Table following modern-web-guidance: responsive-table
      container.innerHTML = `
        <div tabindex="0" role="region" aria-labelledby="planet-table-caption" class="table-wrapper">
          <table class="astro-table">
            <caption id="planet-table-caption">
              Jeosentrik Tropikal Gezegen Konumları, Placidus Evleri ve Yöneticilik (Dispozitör) Tablosu — (Satıra tıklayarak çarkta vurgulayabilirsiniz)
            </caption>
            <thead>
              <tr>
                <th scope="col">Gök Cismi</th>
                <th scope="col">Burç &amp; Derece</th>
                <th scope="col">Placidus Evi</th>
                <th scope="col">Hareket &amp; Hız</th>
                <th scope="col">Dispozitör</th>
                <th scope="col">Asalet</th>
              </tr>
            </thead>
            <tbody>
              ${this.chart.planets
                .map((p) => {
                  const ruler =
                    this.chart.planets.find((r) => r.id === p.dispositorId) ||
                    this.chart.planets[0];
                  const elColor = ELEMENT_COLORS[p.sign.element].primary;
                  return `
                    <tr data-row-planet="${p.id}">
                      <th scope="row">
                        <span style="color:${elColor}; font-size:1.05rem; margin-right:0.35rem;">${renderBodyGlyph(p.glyph)}</span>
                        ${p.name}
                      </th>
                      <td style="font-family:var(--font-mono);">
                        <span style="color:${elColor}; font-weight:700;">${p.sign.glyph} ${p.sign.name}</span>
                        — ${p.degreeFormatted}
                      </td>
                      <td><strong>${p.house}. Ev</strong></td>
                      <td style="font-family:var(--font-mono);">
                        ${
                          p.isRetrograde
                            ? `<span class="badge badge-retro">℞ Retro (${p.speed.toFixed(2)}°/g)</span>`
                            : `<span style="color:#6EE7B7;">Düz (+${p.speed.toFixed(2)}°/g)</span>`
                        }
                      </td>
                      <td>${renderBodyGlyph(ruler.glyph)} ${ruler.name} (${ruler.house}. Ev)</td>
                      <td>${p.dignity || 'Peregrin'}</td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
          </table>
        </div>

        <div style="margin-top:1.25rem; display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:0.75rem;">
          ${this.chart.houses
            .map(
              (h) => `
              <div class="balance-card" style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:700; font-size:0.82rem;">${h.house}. Ev Başlangıcı ${h.house === 1 ? '(ASC)' : h.house === 10 ? '(MC)' : h.house === 7 ? '(DSC)' : h.house === 4 ? '(IC)' : ''}</span>
                <span style="font-family:var(--font-mono); font-size:0.8rem; color:${ELEMENT_COLORS[h.sign.element].primary};">
                  ${h.sign.glyph} ${h.degreeFormatted} ${h.sign.name}
                </span>
              </div>
            `
            )
            .join('')}
        </div>
      `;

      container.querySelectorAll('tr[data-row-planet]').forEach((row) => {
        row.addEventListener('click', () => {
          const pid = row.getAttribute('data-row-planet') as BodyId;
          if (pid) {
            this.selection = { kind: 'planet', id: pid };
            this.wheelCanvas?.setSelection(this.selection, false);
            this.renderQuickPills();
            this.renderInspector();
            document
              .getElementById('inspector-container')
              ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        });
      });
      return;
    }

    if (this.activeTab === 'active-transits') {
      const transits = this.chart.activeTransits;
      container.innerHTML = `
        <div style="margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
          <div>
            <h3 style="font-size:1.05rem; font-weight:800;">Bugünün Gökyüzü Etkisi — Aktif Dar Orblu (±2.0°) Transit Eşleşmeleri</h3>
            <p style="font-size:0.82rem; color:var(--text-secondary);">
              Anlık UTC gökyüzü koordinatları ile doğum haritanız arasındaki en keskin açı temasları:
            </p>
          </div>
        </div>

        ${
          transits.length > 0
            ? `<div class="transit-grid">
                ${transits
                  .map(
                    (tr) => `
                  <article class="transit-card ${tr.nature}">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
                      <span class="badge" style="font-family:var(--font-mono); color:#FDE68A; border-color:rgba(245,158,11,0.4);">
                        ${renderBodyGlyph(tr.transitBody.glyph)} ${tr.glyph} ${renderBodyGlyph(tr.natalTarget.glyph)} • Orb: ${tr.orb.toFixed(2)}°
                      </span>
                      <span class="badge">
                        ${tr.isApplying ? '⚡ Yaklaşan (Güçlenen)' : '🌊 Uzaklaşan'} • Yoğunluk %${tr.intensityScore}
                      </span>
                    </div>
                    <h4 style="font-size:0.95rem; font-weight:700; color:var(--text-primary);">
                      ${tr.headline}
                    </h4>
                    <p style="font-size:0.84rem; color:#CBD5E1;">
                      ${tr.summary}
                    </p>
                    <div class="transit-advice-box">
                      🎯 <strong>Aksiyon Önerisi:</strong> ${tr.actionAdvice}
                    </div>
                  </article>
                `
                  )
                  .join('')}
              </div>`
            : `<div class="balance-card" style="margin-bottom:1rem;">
                Şu anda ±2.0° dar orb içinde tam açı yapan bir transit bulunmuyor. Aşağıdan tüm anlık gökyüzü gezegenlerinin hangi Placidus evinizden geçtiğini inceleyebilirsiniz.
              </div>`
        }

        <h4 style="margin-top:1.4rem; margin-bottom:0.75rem; font-size:0.92rem; font-weight:700; color:var(--text-secondary);">
          🪐 Anlık Gökyüzü Ephemeris Konumları ve Haritanızda Geçtikleri Evler
        </h4>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap:0.75rem;">
          ${this.chart.transitPlanets
            .map(
              (tp) => `
              <div class="balance-card" style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <div style="font-weight:700; font-size:0.85rem;">${renderBodyGlyph(tp.glyph)} Transit ${tp.name} ${tp.isRetrograde ? '<span style="color:#FDA4AF;">℞</span>' : ''}</div>
                  <div style="font-size:0.75rem; color:var(--text-secondary);">Natal <strong>${tp.house}. Evinizde</strong> ilerlemekte</div>
                </div>
                <div style="font-family:var(--font-mono); font-size:0.8rem; color:${ELEMENT_COLORS[tp.sign.element].primary}; text-align:right;">
                  ${tp.sign.glyph} ${tp.degreeFormatted}<br/>${tp.sign.name}
                </div>
              </div>
            `
            )
            .join('')}
        </div>
      `;
      return;
    }

    if (this.activeTab === 'personality-synthesis') {
      container.innerHTML = `
        <div style="margin-bottom:1.1rem;">
          <h3 style="font-size:1.05rem; font-weight:800;">Bütünsel 4 Katmanlı Astrolojik Sentez Raporu</h3>
          <p style="font-size:0.82rem; color:var(--text-secondary);">
            Her gezegen için: (1) Burç ve Ev Konumu, (2) Majör Açı Modülasyonu, (3) Dispozitör Yöneticilik Zinciri ve (4) Günlük Transit Özeti.
          </p>
        </div>
        <div style="display:flex; flex-direction:column; gap:1.15rem;">
          ${this.chart.planets
            .map((p) => {
              const syn = this.chart.syntheses[p.id];
              const elColor = ELEMENT_COLORS[p.sign.element].primary;
              return `
                <article class="balance-card" style="padding:1.15rem; border-inline-start: 4px solid ${elColor};">
                  <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.75rem;">
                    <h4 style="font-size:1.02rem; font-weight:800;">
                      <span style="color:${elColor};">${renderBodyGlyph(p.glyph)}</span> ${p.name} — ${p.sign.glyph} ${p.fullFormatted} (${p.house}. Ev)
                    </h4>
                    <span class="badge">${syn.layer2AspectModulation.dominantTone}</span>
                  </div>
                  <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:0.85rem; font-size:0.84rem; color:#CBD5E1;">
                    <div>
                      <strong style="color:var(--accent-gold); display:block; margin-bottom:0.25rem;">1. Konum (Burç &amp; Ev):</strong>
                      ${formatMarkdownBold(syn.layer1Location.narrative)}
                    </div>
                    <div>
                      <strong style="color:var(--accent-blue); display:block; margin-bottom:0.25rem;">2. Açı Modülasyonu:</strong>
                      ${formatMarkdownBold(syn.layer2AspectModulation.synthesisText)}
                    </div>
                    <div>
                      <strong style="color:var(--accent-emerald); display:block; margin-bottom:0.25rem;">3. Yöneticilik (Dispozitör):</strong>
                      ${formatMarkdownBold(syn.layer3Dispositor.chainNarrative)}
                    </div>
                    <div>
                      <strong style="color:var(--accent-cyan); display:block; margin-bottom:0.25rem;">4. Günlük Transit Özeti:</strong>
                      ${formatMarkdownBold(syn.layer4TransitSummary.bulletinText)}
                    </div>
                  </div>
                </article>
              `;
            })
            .join('')}
        </div>
      `;
    }
  }

  private renderLocationDropdown(): void {
    const ul = document.getElementById('location-results-ul');
    const readout = document.getElementById('selected-location-Readout');
    if (readout) {
      readout.innerHTML = `
        Seçili Konum: <strong>${this.selectedModalLocation.name} (${this.selectedModalLocation.country})</strong> •
        ${this.selectedModalLocation.latitude.toFixed(4)}°K, ${this.selectedModalLocation.longitude.toFixed(4)}°D •
        IANA: ${this.selectedModalLocation.timezone}
      `;
    }
    if (!ul) return;

    ul.innerHTML = this.locationSearchResults
      .map((loc) => {
        const isCurrent = loc.id === this.selectedModalLocation.id;
        return `
          <li class="location-result-item ${isCurrent ? 'active' : ''}" role="option" aria-selected="${isCurrent}" data-loc-id="${loc.id}">
            <span>📍 <strong>${loc.name}</strong> <small style="color:var(--text-secondary);">(${loc.country})</small></span>
            <span style="font-family:var(--font-mono); font-size:0.72rem; color:var(--accent-gold);">
              ${loc.latitude.toFixed(2)}°, ${loc.longitude.toFixed(2)}° • ${loc.timezone}
            </span>
          </li>
        `;
      })
      .join('');

    ul.querySelectorAll('.location-result-item').forEach((li) => {
      li.addEventListener('click', () => {
        const id = li.getAttribute('data-loc-id');
        const found = this.locationSearchResults.find((l) => l.id === id);
        if (found) {
          this.selectedModalLocation = found;
          const searchInput = document.getElementById(
            'input-location-search'
          ) as HTMLInputElement | null;
          if (searchInput) {
            searchInput.value = found.name;
          }
          this.renderLocationDropdown();
        }
      });
    });
  }

  private renderAuthModalContent(): void {
    const inner = document.getElementById('auth-modal-inner');
    if (!inner) return;

    const user = this.authState.currentUser;

    // 1. LOGGED-IN ACCOUNT VIEW
    if (user) {
      const createdDateStr = new Date(user.createdAt).toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });

      inner.innerHTML = `
        <div class="dialog-header">
          <div>
            <h2 id="auth-modal-title" style="font-size:1.1rem; font-weight:800;">🟢 Hesabım (${user.fullName})</h2>
            <p style="font-size:0.77rem; color:var(--text-secondary);">Kişisel astroloji profiliniz ve kayıtlı doğum haritalarınız</p>
          </div>
        </div>

        ${
          this.authFeedback
            ? `<div class="auth-alert ${this.authFeedback.type}" role="status">${this.authFeedback.message}</div>`
            : ''
        }

        <div class="account-summary-box">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <div style="font-size:1.05rem; font-weight:800; color:var(--text-primary);">✦ ${user.fullName}</div>
              <div style="font-size:0.8rem; color:#6EE7B7; font-family:var(--font-mono);">${user.email}</div>
            </div>
            <span class="badge badge-dignity">Kayıt: ${createdDateStr}</span>
          </div>

          <div style="font-size:0.8rem; color:#CBD5E1; border-block-start:1px solid rgba(255,255,255,0.1); padding-block-start:0.55rem;">
            <strong>Ana Doğum Haritası:</strong> ${user.primaryChart.fullName} —
            ${user.primaryChart.birthDate} • ${user.primaryChart.birthTime} •
            📍 ${user.primaryChart.location.name} (${user.primaryChart.location.timezone})
          </div>
        </div>

        <div style="background:var(--bg-deep); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:0.85rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.4rem; margin-bottom:0.55rem;">
            <span style="font-size:0.8rem; font-weight:700; color:#FDE68A;">
              🪐 Hesabıma Kayıtlı Haritalar (${user.savedCharts.length})
            </span>
            <button type="button" id="account-edit-birth-btn" class="btn btn-icon" style="color:var(--accent-blue);">
              ⚙️ Harita Bilgilerini Düzenle
            </button>
          </div>
          <div style="display:flex; flex-direction:column; gap:0.4rem;">
            ${user.savedCharts
              .map(
                (chart, idx) => `
              <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; padding:0.45rem 0.65rem; background:var(--bg-card); border:1px solid var(--border-subtle); border-radius:8px;">
                <div style="font-size:0.8rem;">
                  <strong>✦ ${chart.fullName}</strong>
                  <span style="color:var(--text-secondary); font-size:0.75rem; margin-inline-start:0.35rem;">
                    ${chart.birthDate} ${chart.birthTime} • ${chart.location.name}
                  </span>
                </div>
                <button type="button" class="btn btn-icon account-load-chart-btn" data-chart-idx="${idx}" style="color:#6EE7B7;">
                  Haritayı Aç
                </button>
              </div>
            `
              )
              .join('')}
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.6rem; margin-top:0.25rem;">
          <button type="button" id="signout-account-btn" class="btn" style="color:#FDA4AF; border-color:rgba(244,63,94,0.4);">
            🚪 Hesaptan Çıkış Yap
          </button>
          <button type="button" id="done-auth-modal-btn" class="btn btn-primary">🪐 Doğum Haritasına Geç</button>
        </div>
      `;

      this.bindAuthModalInnerEvents();
      return;
    }

    // 2. GUEST VIEW: SIGN IN / SIGN UP / PASSWORD RESET
    const isSignIn = this.authViewMode === 'signin';
    const isSignUp = this.authViewMode === 'signup';
    const isReset = this.authViewMode === 'reset';

    inner.innerHTML = `
      <div class="dialog-header">
        <div>
          <h2 id="auth-modal-title" style="font-size:1.1rem; font-weight:800;">
            ${
              isSignUp
                ? '✨ Hesabım — Yeni Hesap Oluştur'
                : isReset
                  ? '🔒 Şifremi Sıfırla'
                  : '🔑 Hesabım — Giriş Yap / Kayıt Ol'
            }
          </h2>
          <p style="font-size:0.77rem; color:var(--text-secondary);">
            Doğum haritanızı ve kişisel transit tercihlerinizi hesabınızla kalıcı olarak eşleştirin
          </p>
        </div>
      </div>

      <div class="auth-mode-tabs" role="tablist" aria-label="Giriş veya Kayıt Seçimi">
        <button type="button" role="tab" class="auth-tab-btn ${isSignIn ? 'active' : ''}" data-auth-mode="signin" aria-selected="${isSignIn}">
          🔑 Giriş Yap
        </button>
        <button type="button" role="tab" class="auth-tab-btn ${isSignUp ? 'active' : ''}" data-auth-mode="signup" aria-selected="${isSignUp}">
          ✨ Kayıt Ol
        </button>
      </div>

      ${
        this.authFeedback
          ? `<div class="auth-alert ${this.authFeedback.type}" role="alert">${this.authFeedback.message}</div>`
          : ''
      }

      ${
        isSignIn
          ? `
        <!-- SIGN-IN FORM (modern-web-guidance: autofill-sign-in-form) -->
        <form id="auth-signin-form" novalidate>
          <div class="form-grid">
            <div class="field full-span">
              <label for="signin-email">E-posta Adresi</label>
              <span id="signin-email-hint" class="hint">Kayıtlı e-posta adresinizi giriniz</span>
              <input
                type="email"
                id="signin-email"
                name="email"
                autocomplete="username"
                spellcheck="false"
                enterkeyhint="next"
                placeholder="ornek@eposta.com"
                required
                aria-describedby="signin-email-hint"
                aria-errormessage="signin-email-error"
              />
              <div id="signin-email-error" class="error-msg">
                <span aria-hidden="true">❌</span> Lütfen geçerli bir e-posta adresi giriniz.
              </div>
            </div>

            <div class="field full-span">
              <label for="current-password">Şifre</label>
              <span id="signin-pass-hint" class="hint">Hesap şifrenizi giriniz</span>
              <div class="password-input-wrap">
                <input
                  type="password"
                  id="current-password"
                  name="current-password"
                  autocomplete="current-password"
                  enterkeyhint="done"
                  placeholder="••••••••"
                  required
                  aria-describedby="signin-pass-hint"
                  aria-errormessage="signin-pass-error"
                />
                <button type="button" class="password-toggle-btn" data-toggle-pass="current-password" aria-label="Şifreyi göster" aria-pressed="false">
                  Göster
                </button>
              </div>
              <div id="signin-pass-error" class="error-msg">
                <span aria-hidden="true">❌</span> Lütfen şifrenizi giriniz.
              </div>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-top:0.85rem;">
            <div style="display:flex; gap:0.65rem; flex-wrap:wrap;">
              <button type="button" class="btn btn-icon" data-auth-mode="reset" style="font-size:0.74rem; color:#FDE68A;">
                Şifremi Unuttum
              </button>
            </div>
            <button type="submit" class="btn btn-primary">🔑 Giriş Yap</button>
          </div>
        </form>
      `
          : ''
      }

      ${
        isSignUp
          ? `
        <!-- SIGN-UP FORM (modern-web-guidance: autofill-sign-up-form) -->
        <form id="auth-signup-form" novalidate>
          <div class="form-grid">
            <div class="field full-span">
              <label for="signup-name">Ad &amp; Soyad</label>
              <span id="signup-name-hint" class="hint">Haritanızda ve profilinizde görünecek tam adınız</span>
              <input
                type="text"
                id="signup-name"
                name="name"
                autocomplete="name"
                enterkeyhint="next"
                value="${this.profileState.isUserCustomized ? this.birthInput.fullName : ''}"
                placeholder="Örn: Deniz Yıldırım"
                required
                aria-describedby="signup-name-hint"
                aria-errormessage="signup-name-error"
              />
              <div id="signup-name-error" class="error-msg">
                <span aria-hidden="true">❌</span> Lütfen adınızı ve soyadınızı giriniz.
              </div>
            </div>

            <div class="field full-span">
              <label for="signup-email">E-posta Adresi</label>
              <span id="signup-email-hint" class="hint">Giriş yaparken kullanacağınız e-posta adresiniz</span>
              <input
                type="email"
                id="signup-email"
                name="email"
                autocomplete="username"
                spellcheck="false"
                enterkeyhint="next"
                placeholder="ornek@eposta.com"
                required
                aria-describedby="signup-email-hint"
                aria-errormessage="signup-email-error"
              />
              <div id="signup-email-error" class="error-msg">
                <span aria-hidden="true">❌</span> Lütfen geçerli bir e-posta adresi giriniz.
              </div>
            </div>

            <div class="field full-span">
              <label for="new-password">Şifre Oluştur</label>
              <span id="signup-pass-hint" class="hint">En az 6 karakter uzunluğunda bir şifre belirleyin</span>
              <div class="password-input-wrap">
                <input
                  type="password"
                  id="new-password"
                  name="new-password"
                  autocomplete="new-password"
                  minlength="6"
                  enterkeyhint="next"
                  placeholder="En az 6 karakter"
                  required
                  aria-describedby="signup-pass-hint"
                  aria-errormessage="signup-pass-error"
                />
                <button type="button" class="password-toggle-btn" data-toggle-pass="new-password" aria-label="Şifreyi göster" aria-pressed="false">
                  Göster
                </button>
              </div>
              <div id="signup-pass-error" class="error-msg">
                <span aria-hidden="true">❌</span> Şifreniz en az 6 karakter olmalıdır.
              </div>
            </div>

            <div class="field">
              <label for="signup-birthdate">Doğum Tarihi</label>
              <span id="signup-bdate-hint" class="hint">Gün, Ay, Yıl</span>
              <input
                type="date"
                id="signup-birthdate"
                name="bday"
                autocomplete="bday"
                value="${this.birthInput.birthDate}"
                min="1900-01-01"
                max="2100-12-31"
                required
                aria-describedby="signup-bdate-hint"
              />
            </div>

            <div class="field">
              <label for="signup-birthtime">Doğum Saati</label>
              <span id="signup-btime-hint" class="hint">Yükselen ve Evler için (SS:DD)</span>
              <input
                type="time"
                id="signup-birthtime"
                name="birthTime"
                value="${this.birthInput.birthTime}"
                required
                aria-describedby="signup-btime-hint"
              />
            </div>

            <div class="field full-span">
              <label for="signup-location-search">Doğum Yeri (Şehir / İlçe)</label>
              <span id="signup-loc-hint" class="hint">Doğum şehrinizi veya ilçenizi arayın</span>
              <input
                type="search"
                id="signup-location-search"
                name="locationQuery"
                value="${this.selectedModalLocation.name}"
                placeholder="İstanbul, Ankara, İzmir, Londra..."
                autocomplete="off"
                enterkeyhint="done"
                required
                aria-describedby="signup-loc-hint"
              />
              <div id="signup-location-readout" style="margin-top:0.25rem; font-family:var(--font-mono); font-size:0.74rem; color:var(--accent-blue);">
                Seçili Konum: <strong>${this.selectedModalLocation.name} (${this.selectedModalLocation.country})</strong> •
                IANA: ${this.selectedModalLocation.timezone}
              </div>
              <ul class="location-results-list" id="signup-location-results-ul" role="listbox" aria-label="Kayıt Doğum Yeri Sonuçları" style="max-block-size:125px;"></ul>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.6rem; margin-top:1rem;">
            <span style="font-size:0.74rem; color:#6EE7B7;">
              🔒 Hesabınız ve haritanız 5 katmanlı kalıcı hafızaya kaydedilir.
            </span>
            <button type="submit" class="btn btn-primary">✨ Hesap Oluştur ve Kayıt Ol</button>
          </div>
        </form>
      `
          : ''
      }

      ${
        isReset
          ? `
        <!-- PASSWORD RESET FORM -->
        <form id="auth-reset-form" novalidate>
          <div class="form-grid">
            <div class="field full-span">
              <label for="reset-email">Kayıtlı E-posta Adresiniz</label>
              <input
                type="email"
                id="reset-email"
                name="email"
                autocomplete="username"
                spellcheck="false"
                enterkeyhint="next"
                placeholder="ornek@eposta.com"
                required
              />
            </div>

            <div class="field full-span">
              <label for="reset-birthdate">Kayıtlı Doğum Tarihiniz (Güvenlik Doğrulaması)</label>
              <input
                type="date"
                id="reset-birthdate"
                name="birthDate"
                required
              />
            </div>

            <div class="field full-span">
              <label for="reset-new-password">Yeni Şifreniz (En az 6 karakter)</label>
              <div class="password-input-wrap">
                <input
                  type="password"
                  id="reset-new-password"
                  name="new-password"
                  autocomplete="new-password"
                  minlength="6"
                  enterkeyhint="done"
                  required
                />
                <button type="button" class="password-toggle-btn" data-toggle-pass="reset-new-password" aria-label="Şifreyi göster" aria-pressed="false">
                  Göster
                </button>
              </div>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-top:0.9rem;">
            <button type="button" class="btn btn-icon" data-auth-mode="signin">← Giriş Ekranına Dön</button>
            <button type="submit" class="btn btn-primary">🔒 Şifremi Güncelle</button>
          </div>
        </form>
      `
          : ''
      }
    `;

    this.bindAuthModalInnerEvents();
  }

  private renderSignupLocationDropdown(): void {
    const ul = document.getElementById('signup-location-results-ul');
    const readout = document.getElementById('signup-location-readout');
    if (readout) {
      readout.innerHTML = `
        Seçili Konum: <strong>${this.selectedModalLocation.name} (${this.selectedModalLocation.country})</strong> •
        IANA: ${this.selectedModalLocation.timezone}
      `;
    }
    if (!ul) return;

    ul.innerHTML = this.locationSearchResults
      .map((loc) => {
        const isCurrent = loc.id === this.selectedModalLocation.id;
        return `
          <li class="location-result-item ${isCurrent ? 'active' : ''}" role="option" aria-selected="${isCurrent}" data-signup-loc-id="${loc.id}">
            <span>📍 <strong>${loc.name}</strong> <small style="color:var(--text-secondary);">(${loc.country})</small></span>
            <span style="font-family:var(--font-mono); font-size:0.72rem; color:var(--accent-gold);">
              ${loc.timezone}
            </span>
          </li>
        `;
      })
      .join('');

    ul.querySelectorAll('[data-signup-loc-id]').forEach((li) => {
      li.addEventListener('click', () => {
        const id = li.getAttribute('data-signup-loc-id');
        const found = this.locationSearchResults.find((l) => l.id === id);
        if (found) {
          this.selectedModalLocation = found;
          const inp = document.getElementById('signup-location-search') as HTMLInputElement | null;
          if (inp) inp.value = found.name;
          this.renderSignupLocationDropdown();
        }
      });
    });
  }

  private bindAuthModalInnerEvents(): void {
    document.getElementById('done-auth-modal-btn')?.addEventListener('click', () => {
      this.activeMainView = 'chart';
      this.renderShell();
    });

    // Mode switching buttons (Sign In / Sign Up / Reset)
    document.querySelectorAll('[data-auth-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-auth-mode') as 'signin' | 'signup' | 'reset';
        if (mode) {
          this.authViewMode = mode;
          this.authFeedback = null;
          this.renderAuthModalContent();
        }
      });
    });

    // Show / Hide password toggle buttons
    document.querySelectorAll('[data-toggle-pass]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-toggle-pass');
        if (!targetId) return;
        const input = document.getElementById(targetId) as HTMLInputElement | null;
        if (!input) return;
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        btn.textContent = isPassword ? 'Gizle' : 'Göster';
        btn.setAttribute('aria-pressed', String(isPassword));
      });
    });

    // Populate location dropdown inside Sign-Up form if open
    if (this.authViewMode === 'signup') {
      this.renderSignupLocationDropdown();
      const signupLocInput = document.getElementById(
        'signup-location-search'
      ) as HTMLInputElement | null;
      signupLocInput?.addEventListener('input', () => {
        const q = signupLocInput.value;
        this.locationSearchResults = searchLocalLocations(q);
        if (this.locationSearchResults.length > 0) {
          this.selectedModalLocation = this.locationSearchResults[0];
        }
        this.renderSignupLocationDropdown();

        if (this.searchDebounceTimer) {
          window.clearTimeout(this.searchDebounceTimer);
        }
        this.searchDebounceTimer = window.setTimeout(async () => {
          const remote = await searchOnlineLocations(q);
          if (remote.length > 0) {
            this.locationSearchResults = remote;
            this.selectedModalLocation = remote[0];
            this.renderSignupLocationDropdown();
          }
        }, 260);
      });
    }

    // 1. Sign-In Form Submit
    const signInForm = document.getElementById('auth-signin-form') as HTMLFormElement | null;
    signInForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!signInForm.checkValidity()) {
        signInForm.reportValidity();
        return;
      }
      const email = (document.getElementById('signin-email') as HTMLInputElement)?.value || '';
      const password = (document.getElementById('current-password') as HTMLInputElement)?.value || '';

      const res = await signInUserAccount({
        email,
        password,
        existingState: this.authState
      });

      if (!res.ok) {
        this.authFeedback = { type: 'error', message: res.error || 'Giriş yapılamadı.' };
        this.renderAuthModalContent();
        return;
      }

      this.authState = res.state;
      if (this.authState.currentUser) {
        this.birthInput = this.authState.currentUser.primaryChart;
        this.selectedModalLocation = this.birthInput.location;
        await this.saveProfile(this.birthInput);
      }
      this.authFeedback = {
        type: 'success',
        message: 'Hoş geldiniz! Doğum haritanız ve hesap ayarlarınız yüklendi.'
      };
      this.recalculateChart();
      this.renderShell();
    });

    // 2. Sign-Up Form Submit
    const signUpForm = document.getElementById('auth-signup-form') as HTMLFormElement | null;
    signUpForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!signUpForm.checkValidity()) {
        signUpForm.reportValidity();
        return;
      }

      const fullName = (document.getElementById('signup-name') as HTMLInputElement)?.value.trim() || 'Zenith Üyesi';
      const email = (document.getElementById('signup-email') as HTMLInputElement)?.value.trim() || '';
      const password = (document.getElementById('new-password') as HTMLInputElement)?.value || '';
      const birthDate = (document.getElementById('signup-birthdate') as HTMLInputElement)?.value || this.birthInput.birthDate;
      const birthTime = (document.getElementById('signup-birthtime') as HTMLInputElement)?.value || this.birthInput.birthTime;

      const newChart: BirthInput = {
        fullName,
        birthDate,
        birthTime,
        location: this.selectedModalLocation
      };

      const res = await registerUserAccount({
        fullName,
        email,
        password,
        birthChart: newChart,
        existingState: this.authState
      });

      if (!res.ok) {
        this.authFeedback = { type: 'error', message: res.error || 'Kayıt işlemi başarısız oldu.' };
        this.renderAuthModalContent();
        return;
      }

      this.authState = res.state;
      this.birthInput = newChart;
      await this.saveProfile(newChart);
      this.authFeedback = {
        type: 'success',
        message: 'Hesabınız başarıyla oluşturuldu ve kişisel doğum haritanız kaydedildi!'
      };
      this.recalculateChart();
      this.renderShell();
    });

    // 3. Password Reset Form Submit
    const resetForm = document.getElementById('auth-reset-form') as HTMLFormElement | null;
    resetForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!resetForm.checkValidity()) {
        resetForm.reportValidity();
        return;
      }
      const email = (document.getElementById('reset-email') as HTMLInputElement)?.value || '';
      const birthDateVerification = (document.getElementById('reset-birthdate') as HTMLInputElement)?.value || '';
      const newPassword = (document.getElementById('reset-new-password') as HTMLInputElement)?.value || '';

      const res = await resetUserPassword({
        email,
        birthDateVerification,
        newPassword,
        existingState: this.authState
      });

      if (!res.ok) {
        this.authFeedback = { type: 'error', message: res.error || 'Şifre sıfırlanamadı.' };
        this.renderAuthModalContent();
        return;
      }

      this.authState = res.state;
      if (this.authState.currentUser) {
        this.birthInput = this.authState.currentUser.primaryChart;
        this.selectedModalLocation = this.birthInput.location;
      }
      this.authFeedback = { type: 'success', message: 'Şifreniz başarıyla güncellendi ve giriş yapıldı.' };
      this.recalculateChart();
      this.renderShell();
    });

    // 4. Logged-in Account Actions
    document.getElementById('signout-account-btn')?.addEventListener('click', async () => {
      this.authState = await signOutUserAccount(this.authState);
      this.authViewMode = 'signin';
      this.authFeedback = { type: 'success', message: 'Hesabınızdan güvenle çıkış yapıldı.' };
      this.renderShell();
    });

    document.getElementById('account-edit-birth-btn')?.addEventListener('click', () => {
      const birthCard = document.getElementById('birth-settings-card');
      birthCard?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const nameInput = document.getElementById('input-fullname') as HTMLInputElement | null;
      nameInput?.focus();
    });

    document.querySelectorAll('.account-load-chart-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const idx = Number(btn.getAttribute('data-chart-idx') || 0);
        const chart = this.authState.currentUser?.savedCharts[idx];
        if (chart) {
          this.birthInput = { ...chart };
          this.selectedModalLocation = chart.location;
          await this.saveProfile(this.birthInput);
          this.recalculateChart();
          this.activeMainView = 'chart';
          this.renderShell();
        }
      });
    });
  }

  private bindDOMEvents(): void {
    // 1. Main View Navigation (Doğum Haritası <-> Profil Sayfası)
    document.getElementById('nav-chart-view-btn')?.addEventListener('click', () => {
      if (this.activeMainView !== 'chart') {
        this.activeMainView = 'chart';
        this.renderShell();
      }
    });

    document.getElementById('back-to-chart-btn')?.addEventListener('click', () => {
      this.activeMainView = 'chart';
      this.renderShell();
    });

    document.getElementById('nav-profile-view-btn')?.addEventListener('click', () => {
      if (this.activeMainView !== 'profile') {
        this.activeMainView = 'profile';
        this.selectedModalLocation = this.birthInput.location;
        this.authFeedback = null;
        if (!this.authState.currentUser && this.authState.accounts.length === 0) {
          this.authViewMode = 'signup';
        } else if (!this.authState.currentUser) {
          this.authViewMode = 'signin';
        }
        this.renderShell();
      }
    });

    // 2. PWA Install Modal / Prompt & Copy Personal Link
    const pwaModal = document.getElementById(
      'pwa-info-modal'
    ) as HTMLDialogElement | null;
    const pwaInstallBtn = document.getElementById('pwa-install-btn');
    const closePwaBtn = document.getElementById('close-pwa-modal-btn');
    const okPwaBtn = document.getElementById('ok-pwa-modal-btn');
    const copyLinkBtn = document.getElementById('copy-profile-link-btn');
    const profileCopyLinkBtn = document.getElementById('profile-copy-link-btn');

    if (pwaModal) {
      this.setupDialogLightDismissFallback(pwaModal);
      closePwaBtn?.addEventListener('click', () => pwaModal.close());
      okPwaBtn?.addEventListener('click', () => pwaModal.close());
    }

    const handleCopyPersonalLink = async (btnEl: HTMLElement | null) => {
      await this.saveProfile(this.birthInput);
      try {
        await navigator.clipboard.writeText(window.location.href);
        if (btnEl) btnEl.innerHTML = '✅ Kişisel Bağlantı Kopyalandı!';
      } catch {
        if (btnEl) btnEl.innerHTML = '🔗 Adres Çubuğundaki URL Hazır';
      }
    };

    copyLinkBtn?.addEventListener('click', () => void handleCopyPersonalLink(copyLinkBtn));
    profileCopyLinkBtn?.addEventListener('click', () => void handleCopyPersonalLink(profileCopyLinkBtn));

    pwaInstallBtn?.addEventListener('click', async () => {
      await this.saveProfile(this.birthInput);
      if (this.deferredInstallPrompt) {
        await this.deferredInstallPrompt.prompt();
        this.deferredInstallPrompt = null;
      } else {
        pwaModal?.showModal();
      }
    });

    // 3. Saved Profiles & Sample Profile Buttons inside Profile Page
    document.querySelectorAll('.saved-profile-select-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const idx = Number(btn.getAttribute('data-saved-idx') || 0);
        const saved = this.profileState.savedProfiles[idx];
        if (saved) {
          this.birthInput = { ...saved };
          this.selectedModalLocation = saved.location;
          await this.saveProfile(this.birthInput);
          this.recalculateChart();
          this.activeMainView = 'chart';
          this.renderShell();
        }
      });
    });

    document.querySelectorAll('.saved-profile-delete-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const idx = Number(btn.getAttribute('data-delete-idx') || 0);
        if (this.profileState.savedProfiles[idx]) {
          this.profileState = await removeSavedProfile(idx, this.profileState);
          this.birthInput = this.profileState.activeProfile;
          this.selectedModalLocation = this.birthInput.location;
          this.recalculateChart();
          this.renderShell();
        }
      });
    });

    document.querySelectorAll('.sample-profile-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const idx = Number(btn.getAttribute('data-sample-idx') || 0);
        const sample = SAMPLE_PROFILES[idx];
        if (sample) {
          this.birthInput = { ...sample };
          this.selectedModalLocation = sample.location;
          await this.saveProfile(this.birthInput);
          this.recalculateChart();
          this.activeMainView = 'chart';
          this.renderShell();
        }
      });
    });

    // 4. Location Search Input (Local + Live Geocoding)
    const locInput = document.getElementById(
      'input-location-search'
    ) as HTMLInputElement | null;
    locInput?.addEventListener('input', () => {
      const q = locInput.value;
      this.locationSearchResults = searchLocalLocations(q);
      if (this.locationSearchResults.length > 0) {
        this.selectedModalLocation = this.locationSearchResults[0];
      }
      this.renderLocationDropdown();

      if (this.searchDebounceTimer) {
        window.clearTimeout(this.searchDebounceTimer);
      }
      this.searchDebounceTimer = window.setTimeout(async () => {
        const remote = await searchOnlineLocations(q);
        if (remote.length > 0) {
          this.locationSearchResults = remote;
          this.selectedModalLocation = remote[0];
          this.renderLocationDropdown();
        }
      }, 260);
    });

    // 5. Birth Form Submission & Live Field Persistence
    const birthForm = document.getElementById(
      'birth-data-form'
    ) as HTMLFormElement | null;

    const collectDraftInput = (): BirthInput => {
      const nameVal =
        (document.getElementById('input-fullname') as HTMLInputElement)?.value.trim() ||
        'Zenith Kullanıcısı';
      const dateVal =
        (document.getElementById('input-birthdate') as HTMLInputElement)?.value ||
        this.birthInput.birthDate ||
        '1994-11-10';
      const timeVal =
        (document.getElementById('input-birthtime') as HTMLInputElement)?.value ||
        this.birthInput.birthTime ||
        '14:30';

      return {
        fullName: nameVal,
        birthDate: dateVal,
        birthTime: timeVal,
        location: this.selectedModalLocation
      };
    };

    ['input-fullname', 'input-birthdate', 'input-birthtime'].forEach((fieldId) => {
      document.getElementById(fieldId)?.addEventListener('change', () => {
        const draft = collectDraftInput();
        void this.saveProfile(draft);
      });
    });

    birthForm?.addEventListener('submit', async (e: SubmitEvent) => {
      e.preventDefault();
      if (!birthForm.checkValidity()) {
        birthForm.reportValidity();
        return;
      }

      const nextInput = collectDraftInput();
      await this.saveProfile(nextInput);
      this.recalculateChart();
      this.activeMainView = 'chart';
      this.renderShell();
    });

    // 6. Wheel Toolbar Controls
    const transitToggleBtn = document.getElementById('toggle-transit-ring-btn');
    transitToggleBtn?.addEventListener('click', () => {
      if (!this.wheelCanvas) return;
      const next = !this.wheelCanvas.getShowTransitRing();
      this.wheelCanvas.setShowTransitRing(next);
      transitToggleBtn.classList.toggle('active', next);
    });

    const touchRotateBtn = document.getElementById('toggle-touch-rotate-btn');
    touchRotateBtn?.addEventListener('click', () => {
      if (!this.wheelCanvas) return;
      const next = !this.wheelCanvas.getTouchRotateEnabled();
      this.wheelCanvas.setTouchRotateEnabled(next);
      touchRotateBtn.classList.toggle('active', next);
    });

    document.getElementById('rotate-left-btn')?.addEventListener('click', () => {
      this.wheelCanvas?.rotateBy(-15);
    });
    document.getElementById('rotate-right-btn')?.addEventListener('click', () => {
      this.wheelCanvas?.rotateBy(15);
    });
    document.getElementById('zoom-in-btn')?.addEventListener('click', () => {
      this.wheelCanvas?.adjustZoom(0.2);
    });
    document.getElementById('zoom-out-btn')?.addEventListener('click', () => {
      this.wheelCanvas?.adjustZoom(-0.2);
    });
    document.getElementById('reset-wheel-btn')?.addEventListener('click', () => {
      this.wheelCanvas?.resetView();
    });

    document.getElementById('live-sky-rot-left-btn')?.addEventListener('click', () => {
      this.liveSkyCanvas?.rotateBy(-15);
    });
    document.getElementById('live-sky-rot-right-btn')?.addEventListener('click', () => {
      this.liveSkyCanvas?.rotateBy(15);
    });
    document.getElementById('live-sky-reset-btn')?.addEventListener('click', () => {
      this.liveSkyCanvas?.resetRotation();
    });

    document.getElementById('refresh-transit-btn')?.addEventListener('click', () => {
      this.isPreviewingFutureDate = false;
      this.recalculateChart(new Date());
      this.renderShell();
    });

    document.getElementById('brand-replay-intro-btn')?.addEventListener('click', () => {
      this.replayIntroVideo();
    });

    // 7. Bottom Tab Switching
    document.querySelectorAll('.tab-btn[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab') as ActiveTab;
        if (targetTab) {
          this.activeTab = targetTab;
          document.querySelectorAll('.tab-btn[data-tab]').forEach((b) => {
            const isAct = b.getAttribute('data-tab') === targetTab;
            b.classList.toggle('active', isAct);
            b.setAttribute('aria-selected', String(isAct));
          });
          this.renderTabContent();
        }
      });
    });
  }
}

const appRoot = document.getElementById('zenith-app');
if (appRoot) {
  new ZenithApp(appRoot);
}
