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
  searchLocalLocations,
  searchOnlineLocations
} from './data/locations';
import { calculateFullChart } from './engine/ephemeris';
import { HOUSE_THEMES } from './engine/interpretation';
import { ELEMENT_COLORS, NatalWheelCanvas } from './components/NatalWheelCanvas';
import {
  StoredProfilePayload,
  loadProfileSync,
  recoverProfileAsync,
  removeSavedProfile,
  saveProfileEverywhere
} from './engine/storage';
import {
  AuthState,
  exportAccountSyncToken,
  importAccountSyncToken,
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

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function formatMarkdownBold(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

class ZenithApp {
  private root: HTMLElement;
  private birthInput: BirthInput;
  private profileState: StoredProfilePayload;
  private authState: AuthState;
  private authViewMode: 'signin' | 'signup' | 'reset' | 'import' = 'signin';
  private authFeedback: { type: 'error' | 'success'; message: string } | null = null;
  private chart!: ChartCalculationResult;
  private wheelCanvas: NatalWheelCanvas | null = null;
  private selection: WheelSelection = { kind: 'planet', id: 'sun' };
  private activeTab: ActiveTab = 'big-three';
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
    const skipBtn = document.getElementById('intro-skip-btn');
    const soundBtn = document.getElementById('intro-sound-btn');

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
    skipBtn?.addEventListener('click', dismissSplash);

    soundBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      videoEl.muted = !videoEl.muted;
      soundBtn.innerHTML = videoEl.muted ? '🔇 Sesi Aç' : '🔊 Ses Açık';
    });

    // Ensure playback starts immediately on mobile/PWA/iOS WebView
    videoEl.muted = true;
    const playPromise = videoEl.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // If low-power mode blocks autoplay, allow tap anywhere on splash to play or skip
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
    document.getElementById('intro-skip-btn')?.addEventListener('click', onEnded, { once: true });
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
    const transitTimeStr = this.chart.transitUtcDate.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit'
    });
    const transitDateStr = this.chart.transitUtcDate.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    this.root.innerHTML = `
      <div class="zenith-shell">
        <!-- 1. TOP NAVBAR -->
        <header class="top-navbar">
          <div class="brand-group" id="brand-replay-intro-btn" style="cursor:pointer;" title="Zenith Açılış Videosunu Tekrar Oynat">
            <img src="./icon-192.svg" alt="Zenith Logo" class="brand-logo" width="40" height="40" />
            <div>
              <div class="brand-title">ZENITH</div>
              <div class="brand-subtitle">İnteraktif Natal &amp; Transit Astroloji Motoru</div>
            </div>
          </div>

          <div class="quick-profile-bar" role="region" aria-label="Aktif Doğum Haritası Profili">
            <div class="profile-summary-info">
              <span class="profile-name-badge">✦ ${input.fullName || 'İsimsiz Harita'}</span>
              <span class="profile-meta-chip">${input.birthDate} • ${input.birthTime}</span>
              <span class="profile-meta-chip">📍 ${input.location.name} (${input.location.latitude.toFixed(2)}°K, ${input.location.longitude.toFixed(2)}°D)</span>
              <span class="profile-tz-chip">${input.location.timezone} (${utcOffsetFormatted})</span>
              ${
                this.authState.currentUser
                  ? `<button type="button" id="quick-account-chip-btn" class="profile-tz-chip" style="cursor:pointer; color:#6EE7B7; border-color:rgba(16,185,129,0.5); background:rgba(16,185,129,0.14);" title="Aktif Zenith Hesabınız">🟢 Hesap: ${this.authState.currentUser.email}</button>`
                  : this.profileState.isUserCustomized
                    ? `<span class="profile-tz-chip" style="color:#6EE7B7; border-color:rgba(16,185,129,0.45); background:rgba(16,185,129,0.12);" title="Doğum bilgileriniz ana ekran uygulamasında (PWA) silinmeyecek şekilde 5 katmanlı kalıcı hafızaya kaydedildi.">✓ Cihazda Kalıcı Kayıtlı</span>`
                    : `<button type="button" id="quick-custom-profile-btn" class="profile-tz-chip" style="cursor:pointer; color:#FDE68A; border-color:rgba(245,158,11,0.5); background:rgba(245,158,11,0.15);">📌 Kendi Bilgilerinizi Kalıcı Kaydedin</button>`
              }
            </div>
          </div>

          <div class="header-actions">
            <button type="button" id="open-auth-modal-btn" class="btn ${this.authState.currentUser ? 'btn-account' : ''}">
              ${
                this.authState.currentUser
                  ? `🟢 ${this.authState.currentUser.fullName.split(' ')[0]} (Hesabım)`
                  : '👤 Giriş Yap / Kayıt Ol'
              }
            </button>
            <button type="button" id="open-birth-modal-btn" class="btn btn-primary">
              ⚙️ ${this.profileState.isUserCustomized || this.authState.currentUser ? 'Harita Bilgileri' : 'Kişisel Bilgilerini Gir'}
            </button>
            ${
              isStandaloneOrNative
                ? ''
                : `<button type="button" id="pwa-install-btn" class="btn btn-pwa">
                    📲 Ana Ekrana Ekle
                  </button>`
            }
          </div>
        </header>

        <!-- LIVE SKY TRANSIT STRIP -->
        <section class="sky-ticker-bar" aria-label="Anlık Gökyüzü Transit Durumu">
          <div class="sky-ticker-left">
            <span class="live-pulse-dot" aria-hidden="true"></span>
            <span>
              <strong>Canlı Gökyüzü Eşleştirici (UTC/Yerel):</strong> ${transitDateStr} ${transitTimeStr} —
              Haritanızla <strong>±2.0° dar orb</strong> içinde <strong>${activeTransits.length} aktif majör transit</strong> tespit edildi.
            </span>
          </div>
          <div style="display:flex; gap:0.45rem; align-items:center;">
            <button type="button" id="refresh-transit-btn" class="btn btn-icon">
              🔄 Anlık Gökyüzünü Yenile
            </button>
          </div>
        </section>

        <!-- 2. MIDDLE WORKSPACE: INTERACTIVE VECTOR WHEEL + 4-LAYER INSPECTOR -->
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
                  🪐 Transit
                </button>
                <button type="button" id="toggle-touch-rotate-btn" class="btn btn-icon" title="Tek Parmakla Çark Döndürme Modu">
                  ✋ Döndür
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

            <div class="wheel-quick-selector" id="wheel-quick-pills" role="toolbar" aria-label="Hızlı Gezegen ve Eksen Seçici"></div>
          </section>

          <!-- RIGHT: 4-LAYER PERSONALIZED SYNTHESIS INSPECTOR -->
          <aside class="inspector-panel" id="inspector-container" aria-live="polite"></aside>
        </main>

        <!-- 3. BOTTOM TABS SECTION -->
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
      </div>

      <!-- BIRTH DATA & LOCATION MODAL DIALOG (light-dismiss-a-dialog + validate-input-after-interaction) -->
      <dialog id="birth-modal" class="zenith-dialog" closedby="any" aria-labelledby="birth-modal-title">
        <div class="dialog-inner">
          <div class="dialog-header">
            <div>
              <h2 id="birth-modal-title" style="font-size:1.1rem; font-weight:800;">Doğum Haritası &amp; Konum Parametreleri</h2>
              <p style="font-size:0.77rem; color:var(--text-secondary);">Jeosentrik Tropikal Zodyak, Placidus Ev Sistemi ve IANA Otomatik Saat Dilimi</p>
            </div>
            <button type="button" id="close-birth-modal-btn" class="btn btn-icon" aria-label="Kapat">✕</button>
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
                <button type="button" id="cancel-modal-btn" class="btn">İptal</button>
                <button type="submit" class="btn btn-primary">✨ Kalıcı Kaydet &amp; Haritayı Çiz</button>
              </div>
            </div>
          </form>
        </div>
      </dialog>

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
            <li><strong>1. Adım:</strong> Önce <em>"Kişisel Bilgilerini Gir"</em> butonundan kendi doğum bilgilerinizi kaydedin.</li>
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

      <!-- AUTH / REGISTER / LOGIN / ACCOUNT PANEL DIALOG -->
      <dialog id="auth-modal" class="zenith-dialog" closedby="any" aria-labelledby="auth-modal-title">
        <div class="dialog-inner" id="auth-modal-inner"></div>
      </dialog>
    `;

    // Initialize Canvas Wheel
    const canvasEl = document.getElementById('natal-wheel-canvas') as HTMLCanvasElement;
    if (canvasEl) {
      this.wheelCanvas = new NatalWheelCanvas(canvasEl, this.chart, (sel) => {
        this.selection = sel;
        this.renderQuickPills();
        this.renderInspector();
      });
      this.wheelCanvas.setSelection(this.selection, false);
    }

    this.renderQuickPills();
    this.renderInspector();
    this.renderTabContent();
    this.renderLocationDropdown();
    this.renderAuthModalContent();
    this.bindDOMEvents();
  }

  private renderQuickPills(): void {
    const container = document.getElementById('wheel-quick-pills');
    if (!container) return;

    const planetPills = this.chart.planets
      .map((p) => {
        const isSel =
          this.selection?.kind === 'planet' && this.selection.id === p.id;
        return `
          <button type="button" class="planet-pill-btn ${isSel ? 'selected' : ''}" data-sel-kind="planet" data-sel-id="${p.id}">
            <span>${p.glyph}</span>
            <span>${p.name}</span>
          </button>
        `;
      })
      .join('');

    const anglePills = (['asc', 'mc', 'dsc', 'ic'] as AngleId[])
      .map((aid) => {
        const ang = this.chart.angles[aid];
        const isSel =
          this.selection?.kind === 'angle' && this.selection.id === aid;
        return `
          <button type="button" class="planet-pill-btn ${isSel ? 'selected' : ''}" data-sel-kind="angle" data-sel-id="${aid}">
            <span>🧭</span>
            <span>${ang.shortLabel}</span>
          </button>
        `;
      })
      .join('');

    container.innerHTML = planetPills + anglePills;

    container.querySelectorAll('.planet-pill-btn').forEach((btn) => {
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
        summaryLabel = `<strong>${p.glyph} ${p.name}</strong> — ${p.sign.glyph} ${p.fullFormatted} (${p.house}. Ev)`;
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
              ${p.glyph}
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
            <div class="inspector-glyph-box" style="color:${elColor}; border-color:${elColor}; font-size:1.15rem;">
              ${ang.shortLabel}
            </div>
            <div class="inspector-title-group">
              <div class="inspector-title">
                <span>${ang.name} — ${ang.sign.glyph} ${ang.sign.name}</span>
                <span class="profile-meta-chip">${ang.degreeFormatted}</span>
              </div>
              <div class="inspector-subtitle">
                ${houseMeta.title} • Eksen Yöneticisi: ${rulerPlanet.glyph} ${rulerPlanet.name} (${rulerPlanet.sign.name}, ${rulerPlanet.house}. Ev)
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
              ${ang.shortLabel} burcunuz olan ${ang.sign.name}'in yöneticisi <strong>${rulerPlanet.glyph} ${rulerPlanet.name}</strong>, haritanızda <strong>${rulerPlanet.fullFormatted}</strong> konumunda ve <strong>${rulerPlanet.house}. Evde</strong> yer alıyor. Bu durum, ${houseNum}. ev temalarınızın doğrudan ${rulerPlanet.house}. ev yaşam sahnesiyle birbirine kenetlendiğini gösterir.
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
            <div class="inspector-glyph-box" style="color:${elColor}; border-color:${elColor}; font-size:1.25rem;">
              ${cusp.house}. Ev
            </div>
            <div class="inspector-title-group">
              <div class="inspector-title">
                <span>${houseMeta.title}</span>
                <span class="profile-meta-chip">${cusp.sign.glyph} ${cusp.degreeFormatted} ${cusp.sign.name}</span>
              </div>
              <div class="inspector-subtitle">
                Placidus Ev Başlangıcı • Ev Yöneticisi: ${rulerPlanet.glyph} ${rulerPlanet.name} (${rulerPlanet.house}. Evde)
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
                          `<div>• <strong>${p.glyph} ${p.name}</strong> (${p.fullFormatted}${p.isRetrograde ? ' ℞' : ''}) — Bu yaşam alanına doğrudan aktif arketipsel odak taşır.</div>`
                      )
                      .join('')
                  : `Bu evde yerleşik natal gezegen bulunmuyor (boş ev); evin enerjisi doğrudan yöneticisi olan <strong>${rulerPlanet.glyph} ${rulerPlanet.name}</strong> (${rulerPlanet.sign.name}, ${rulerPlanet.house}. Ev) üzerinden çalışır.`
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
                  ? `Bugün gökyüzünde <strong>${transitInHouse.map((t) => `${t.glyph} ${t.name} (${t.fullFormatted})`).join(', ')}</strong> doğrudan ${cusp.house}. evinizden geçerek ${houseMeta.transitActionDomain} güncel hareketlilik yaratıyor.`
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
              Dış dünyayla kurduğunuz ilk temas ve yaşama başlangıç motivasyonunuz <strong>${asc.sign.name}</strong> burcunun ${asc.sign.keywords.join(', ').toLocaleLowerCase('tr-TR')} filtresinden geçer. Harita yöneticiniz <strong>${ruler.glyph} ${ruler.name}</strong>, <strong>${ruler.sign.name}</strong> burcunda ve <strong>${ruler.house}. Evde</strong> konumlanarak yaşam enerjinizi bu alana odaklar.
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
                    ${info.bodies.join(' • ') || 'Yerleşim yok'}
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
                        <span style="color:${elColor}; font-size:1.05rem; margin-right:0.35rem;">${p.glyph}</span>
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
                      <td>${ruler.glyph} ${ruler.name} (${ruler.house}. Ev)</td>
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
                        ${tr.transitBody.glyph} ${tr.glyph} ${tr.natalTarget.glyph} • Orb: ${tr.orb.toFixed(2)}°
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
                  <div style="font-weight:700; font-size:0.85rem;">${tp.glyph} Transit ${tp.name} ${tp.isRetrograde ? '<span style="color:#FDA4AF;">℞</span>' : ''}</div>
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
                      <span style="color:${elColor};">${p.glyph}</span> ${p.name} — ${p.sign.glyph} ${p.fullFormatted} (${p.house}. Ev)
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
            <h2 id="auth-modal-title" style="font-size:1.1rem; font-weight:800;">🟢 Zenith Hesabım</h2>
            <p style="font-size:0.77rem; color:var(--text-secondary);">Kişisel astroloji profiliniz ve kayıtlı doğum haritalarınız</p>
          </div>
          <button type="button" id="close-auth-modal-btn" class="btn btn-icon" aria-label="Kapat">✕</button>
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
              ⚙️ Yeni Harita / Bilgi Düzenle
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

        <div style="background:var(--bg-deep); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:0.85rem; display:flex; flex-direction:column; gap:0.5rem;">
          <div style="font-size:0.78rem; font-weight:700; color:var(--text-primary);">
            📲 Cihazlar Arası Hesap Taşıma Anahtarı
          </div>
          <p style="font-size:0.75rem; color:var(--text-secondary);">
            Hesabınızı başka bir telefon, tablet veya tarayıcıda anında açmak için kişisel senkronizasyon anahtarınızı kopyalayabilirsiniz:
          </p>
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
            <button type="button" id="copy-account-token-btn" class="btn btn-icon" style="color:#FDE68A;">
              🔑 Hesap Anahtarımı Kopyala
            </button>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.6rem; margin-top:0.25rem;">
          <button type="button" id="signout-account-btn" class="btn" style="color:#FDA4AF; border-color:rgba(244,63,94,0.4);">
            🚪 Hesaptan Çıkış Yap
          </button>
          <button type="button" id="done-auth-modal-btn" class="btn btn-primary">Tamam</button>
        </div>
      `;

      this.bindAuthModalInnerEvents();
      return;
    }

    // 2. GUEST VIEW: SIGN IN / SIGN UP / PASSWORD RESET / IMPORT TOKEN
    const isSignIn = this.authViewMode === 'signin';
    const isSignUp = this.authViewMode === 'signup';
    const isReset = this.authViewMode === 'reset';
    const isImport = this.authViewMode === 'import';

    inner.innerHTML = `
      <div class="dialog-header">
        <div>
          <h2 id="auth-modal-title" style="font-size:1.1rem; font-weight:800;">
            ${
              isSignUp
                ? '✨ Zenith — Yeni Hesap Oluştur'
                : isReset
                  ? '🔒 Şifremi Sıfırla'
                  : isImport
                    ? '📲 Hesap Anahtarı ile İçe Aktar'
                    : '🔑 Zenith — Hesaba Giriş Yap'
            }
          </h2>
          <p style="font-size:0.77rem; color:var(--text-secondary);">
            Doğum haritanızı ve kişisel transit tercihlerinizi hesabınızla kalıcı olarak eşleştirin
          </p>
        </div>
        <button type="button" id="close-auth-modal-btn" class="btn btn-icon" aria-label="Kapat">✕</button>
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
              <button type="button" class="btn btn-icon" data-auth-mode="import" style="font-size:0.74rem; color:var(--accent-blue);">
                🔑 Anahtar ile Aç
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

      ${
        isImport
          ? `
        <!-- IMPORT SYNC TOKEN FORM -->
        <form id="auth-import-form" novalidate>
          <div class="form-grid">
            <div class="field full-span">
              <label for="import-token-input">Hesap Senkronizasyon Anahtarı</label>
              <span class="hint">Diğer cihazınızdan kopyaladığınız ZENITH-ACC-... kodunu yapıştırın</span>
              <input
                type="text"
                id="import-token-input"
                name="syncToken"
                spellcheck="false"
                autocomplete="off"
                placeholder="ZENITH-ACC-..."
                required
              />
            </div>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-top:0.9rem;">
            <button type="button" class="btn btn-icon" data-auth-mode="signin">← Giriş Ekranına Dön</button>
            <button type="submit" class="btn btn-primary">📲 Hesabı İçe Aktar ve Aç</button>
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
    const authModal = document.getElementById('auth-modal') as HTMLDialogElement | null;

    document.getElementById('close-auth-modal-btn')?.addEventListener('click', () => {
      authModal?.close();
    });
    document.getElementById('done-auth-modal-btn')?.addEventListener('click', () => {
      authModal?.close();
    });

    // Mode switching buttons (Sign In / Sign Up / Reset / Import)
    document.querySelectorAll('[data-auth-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-auth-mode') as 'signin' | 'signup' | 'reset' | 'import';
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
      const reopened = document.getElementById('auth-modal') as HTMLDialogElement | null;
      reopened?.showModal();
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
      const reopened = document.getElementById('auth-modal') as HTMLDialogElement | null;
      reopened?.showModal();
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
      const reopened = document.getElementById('auth-modal') as HTMLDialogElement | null;
      reopened?.showModal();
    });

    // 4. Import Sync Token Form Submit
    const importForm = document.getElementById('auth-import-form') as HTMLFormElement | null;
    importForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = (document.getElementById('import-token-input') as HTMLInputElement)?.value || '';
      const res = await importAccountSyncToken(token, this.authState);
      if (!res.ok) {
        this.authFeedback = { type: 'error', message: res.error || 'Hesap anahtarı geçersiz.' };
        this.renderAuthModalContent();
        return;
      }
      this.authState = res.state;
      if (this.authState.currentUser) {
        this.birthInput = this.authState.currentUser.primaryChart;
        this.selectedModalLocation = this.birthInput.location;
        await this.saveProfile(this.birthInput);
      }
      this.authFeedback = { type: 'success', message: 'Hesabınız ve haritalarınız başarıyla içe aktarıldı!' };
      this.recalculateChart();
      this.renderShell();
      const reopened = document.getElementById('auth-modal') as HTMLDialogElement | null;
      reopened?.showModal();
    });

    // 5. Logged-in Account Actions
    document.getElementById('signout-account-btn')?.addEventListener('click', async () => {
      this.authState = await signOutUserAccount(this.authState);
      this.authViewMode = 'signin';
      this.authFeedback = { type: 'success', message: 'Hesabınızdan güvenle çıkış yapıldı.' };
      this.renderShell();
      const reopened = document.getElementById('auth-modal') as HTMLDialogElement | null;
      reopened?.showModal();
    });

    document.getElementById('copy-account-token-btn')?.addEventListener('click', async (e) => {
      if (!this.authState.currentUser) return;
      const token = exportAccountSyncToken(this.authState.currentUser);
      const btn = e.currentTarget as HTMLButtonElement;
      try {
        await navigator.clipboard.writeText(token);
        btn.textContent = '✅ Hesap Anahtarı Kopyalandı!';
      } catch {
        btn.textContent = '🔑 ' + token.slice(0, 24) + '...';
      }
    });

    document.getElementById('account-edit-birth-btn')?.addEventListener('click', () => {
      authModal?.close();
      const birthModal = document.getElementById('birth-modal') as HTMLDialogElement | null;
      birthModal?.showModal();
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
          authModal?.close();
          this.renderShell();
        }
      });
    });
  }

  private bindDOMEvents(): void {
    // 1. Birth Modal Open / Close
    const birthModal = document.getElementById(
      'birth-modal'
    ) as HTMLDialogElement | null;
    const openModalBtn = document.getElementById('open-birth-modal-btn');
    const closeModalBtn = document.getElementById('close-birth-modal-btn');
    const cancelModalBtn = document.getElementById('cancel-modal-btn');

    if (birthModal) {
      this.setupDialogLightDismissFallback(birthModal);
      const openModalHandler = () => {
        this.selectedModalLocation = this.birthInput.location;
        this.renderLocationDropdown();
        birthModal.showModal();
      };
      openModalBtn?.addEventListener('click', openModalHandler);
      document
        .getElementById('quick-custom-profile-btn')
        ?.addEventListener('click', openModalHandler);
      closeModalBtn?.addEventListener('click', () => birthModal.close());
      cancelModalBtn?.addEventListener('click', () => birthModal.close());
    }

    // 1b. Auth / Account Modal Open / Close
    const authModal = document.getElementById(
      'auth-modal'
    ) as HTMLDialogElement | null;
    if (authModal) {
      this.setupDialogLightDismissFallback(authModal);
      const openAuthHandler = () => {
        this.authFeedback = null;
        if (!this.authState.currentUser && this.authState.accounts.length === 0) {
          this.authViewMode = 'signup';
        } else if (!this.authState.currentUser) {
          this.authViewMode = 'signin';
        }
        this.renderAuthModalContent();
        authModal.showModal();
      };
      document.getElementById('open-auth-modal-btn')?.addEventListener('click', openAuthHandler);
      document.getElementById('quick-account-chip-btn')?.addEventListener('click', openAuthHandler);
    }

    // 2. PWA Install Modal / Prompt
    const pwaModal = document.getElementById(
      'pwa-info-modal'
    ) as HTMLDialogElement | null;
    const pwaInstallBtn = document.getElementById('pwa-install-btn');
    const closePwaBtn = document.getElementById('close-pwa-modal-btn');
    const okPwaBtn = document.getElementById('ok-pwa-modal-btn');
    const copyLinkBtn = document.getElementById('copy-profile-link-btn');

    if (pwaModal) {
      this.setupDialogLightDismissFallback(pwaModal);
      closePwaBtn?.addEventListener('click', () => pwaModal.close());
      okPwaBtn?.addEventListener('click', () => pwaModal.close());
    }

    copyLinkBtn?.addEventListener('click', async () => {
      await this.saveProfile(this.birthInput);
      try {
        await navigator.clipboard.writeText(window.location.href);
        copyLinkBtn.innerHTML = '✅ Kişisel Bağlantı Kopyalandı!';
      } catch {
        copyLinkBtn.innerHTML = '🔗 Adres Çubuğundaki URL Hazır';
      }
    });

    pwaInstallBtn?.addEventListener('click', async () => {
      await this.saveProfile(this.birthInput);
      if (this.deferredInstallPrompt) {
        await this.deferredInstallPrompt.prompt();
        this.deferredInstallPrompt = null;
      } else {
        pwaModal?.showModal();
      }
    });

    // 3. Saved Profiles & Sample Profile Buttons inside Modal
    document.querySelectorAll('.saved-profile-select-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const idx = Number(btn.getAttribute('data-saved-idx') || 0);
        const saved = this.profileState.savedProfiles[idx];
        if (saved) {
          this.birthInput = { ...saved };
          this.selectedModalLocation = saved.location;
          await this.saveProfile(this.birthInput);
          this.recalculateChart();
          birthModal?.close();
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
          const reopenedModal = document.getElementById(
            'birth-modal'
          ) as HTMLDialogElement | null;
          reopenedModal?.showModal();
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
          birthModal?.close();
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
      birthModal?.close();
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

    document.getElementById('refresh-transit-btn')?.addEventListener('click', () => {
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
