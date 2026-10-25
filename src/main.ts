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

type ActiveTab =
  | 'big-three'
  | 'planet-table'
  | 'active-transits'
  | 'personality-synthesis'
  | null;
type MainViewMode = 'live-sky' | 'chart' | 'cosmic-calendar' | 'profile';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const VENUS_SVG = `<svg class="astro-glyph-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8.5" r="4.8"/><line x1="12" y1="13.3" x2="12" y2="20.5"/><line x1="8.5" y1="17" x2="15.5" y2="17"/></svg>`;
const MARS_SVG = `<svg class="astro-glyph-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9.8" cy="14.2" r="4.8"/><line x1="13.2" y1="10.8" x2="19.2" y2="4.8"/><polyline points="14.2 4.8 19.2 4.8 19.2 9.8"/></svg>`;

const UI_ICONS = {
  planet: `<svg class="ui-min-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="6"/><ellipse cx="12" cy="12" rx="11" ry="4.2" transform="rotate(-24 12 12)"/></svg>`,
  user: `<svg class="ui-min-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M5 20c0-3.87 3.13-7 7-7s7 3.13 7 7"/></svg>`,
  sparkle: `<svg class="ui-min-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2L12 3z"/></svg>`,
  grid: `<svg class="ui-min-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>`,
  bolt: `<svg class="ui-min-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  layers: `<svg class="ui-min-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 12 12 17 22 12"/><polyline points="2 17 12 22 22 17"/></svg>`,
  compass: `<svg class="ui-min-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polygon points="15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5 15.5 8.5"/></svg>`,
  target: `<svg class="ui-min-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></svg>`,
  clock: `<svg class="ui-min-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>`,
  globe: `<svg class="ui-min-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><line x1="3" y1="12" x2="21" y2="12"/><path d="M12 3a14.5 14.5 0 0 0 0 18 14.5 14.5 0 0 0 0-18"/></svg>`,
  pin: `<svg class="ui-min-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/></svg>`,
  refresh: `<svg class="ui-min-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/></svg>`,
  calendar: `<svg class="ui-min-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  star: `<svg class="ui-min-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2.5 14.9 8.4 21.4 9.3 16.7 13.9 17.8 20.4 12 17.3 6.2 20.4 7.3 13.9 2.6 9.3 9.1 8.4 12 2.5"/></svg>`,
  alert: `<svg class="ui-min-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  check: `<svg class="ui-min-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`,
  link: `<svg class="ui-min-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  download: `<svg class="ui-min-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  settings: `<svg class="ui-min-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  lock: `<svg class="ui-min-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`,
  key: `<svg class="ui-min-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3L21 2"/><path d="M17 6l3 3"/></svg>`,
  logout: `<svg class="ui-min-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  home: `<svg class="ui-min-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.2V20h14V9.2"/></svg>`,
  crown: `<svg class="ui-min-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18h18l-2-11-5 4-2-6-2 6-5-4-2 11z"/></svg>`,
  fire: `<svg class="ui-min-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.5c2.5 3.5 5.5 6.2 5.5 10.5a5.5 5.5 0 0 1-11 0c0-2.6 1.5-4.8 3-6.5.4 1.8 1.6 2.8 2.5 3 0-2.5 0-4.8 0-7z"/></svg>`,
  earth: `<svg class="ui-min-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`,
  air: `<svg class="ui-min-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.59 4.59A2 2 0 1 1 11 8H2"/><path d="M12.59 19.41A2 2 0 1 0 14 16H2"/><path d="M17.73 7.73A2.5 2.5 0 1 1 19.5 12H2"/></svg>`,
  water: `<svg class="ui-min-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`,
  bookmark: `<svg class="ui-min-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`
};

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
  private authDraftEmail = '';
  private isPasswordVisible = false;
  private authFeedback: { type: 'error' | 'success'; message: string } | null = null;
  private chart!: ChartCalculationResult;
  private wheelCanvas: NatalWheelCanvas | null = null;
  private liveSkyCanvas: LiveSkyWheelCanvas | null = null;
  private liveSkySelectedBodyId: BodyId | null = null;
  private electionalCategoryId: ElectionalCategoryId = 'career';
  private electionalQueryText =
    'Yeni iş başlangıcı ve kariyer adımı için en uygun gün hangisi?';
  private electionalResult!: ElectionalForecastResult;
  private selectedElectionalDayIso = '';
  private isOptimalAccordionOpen = false;
  private isCautionAccordionOpen = false;
  private isCalendarAccordionOpen = true;
  private isNatalPlanetsAccordionOpen = false;
  private isLiveSkyPlanetsAccordionOpen = false;
  private isActiveTransitsMatchesAccordionOpen = false;
  private isTransitEphemerisAccordionOpen = false;
  private isPreviewingFutureDate = false;
  private selection: WheelSelection = null;
  private activeTab: ActiveTab = null;
  private personalityPageIndex = 0;
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
    this.initNativeAppFeelGuards();
    this.initIntroSplashVideo();
    this.initPwaInstallListener();
    this.registerServiceWorker();
    this.renderShell();
    void this.initAsyncProfileRecovery();
  }

  private initNativeAppFeelGuards(): void {
    const isEditableField = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        target.isContentEditable ||
        Boolean(target.closest('input, textarea, [contenteditable="true"]'))
      );
    };

    // Prevent double-tap / double-click page zoom
    document.addEventListener(
      'dblclick',
      (e) => {
        e.preventDefault();
      },
      { passive: false }
    );

    // Prevent iOS Safari / WebKit page-level pinch-zoom gesture outside interactive canvas
    ['gesturestart', 'gesturechange', 'gestureend'].forEach((evtName) => {
      document.addEventListener(
        evtName,
        (e) => {
          if (
            e.target instanceof HTMLElement &&
            e.target.closest('#natal-wheel-canvas')
          ) {
            return;
          }
          e.preventDefault();
        },
        { passive: false }
      );
    });

    // Prevent long-press text selection and context menu / copy callouts outside inputs
    document.addEventListener('selectstart', (e) => {
      if (!isEditableField(e.target)) {
        e.preventDefault();
      }
    });

    document.addEventListener('contextmenu', (e) => {
      if (!isEditableField(e.target)) {
        e.preventDefault();
      }
    });

    document.addEventListener('dragstart', (e) => {
      e.preventDefault();
    });
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
      this.liveSkySelectedBodyId &&
      !this.chart.transitPlanets.some((p) => p.id === this.liveSkySelectedBodyId)
    ) {
      this.liveSkySelectedBodyId = null;
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
        installBtn.innerHTML = `${UI_ICONS.download} <span>Uygulamayı Yükle (Hazır)</span>`;
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
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });

      window.addEventListener('load', () => {
        // Purge any legacy workbox-precache or stale zenith-pwa caches
        if ('caches' in window) {
          caches
            .keys()
            .then((keys) => {
              keys.forEach((k) => {
                if (
                  k.startsWith('workbox-precache') ||
                  (k.startsWith('zenith-pwa-') && k !== 'zenith-pwa-v2.5.0')
                ) {
                  void caches.delete(k);
                }
              });
            })
            .catch(() => {});
        }

        navigator.serviceWorker
          .getRegistrations()
          .then((regs) => {
            regs.forEach((r) => {
              void r.update();
            });
          })
          .catch(() => {});

        navigator.serviceWorker
          .register('/zenith/sw.js', { scope: '/zenith', updateViaCache: 'none' })
          .then((reg) => {
            void reg.update();
          })
          .catch(() => {
            navigator.serviceWorker
              .register('/zenith/sw.js', { scope: '/zenith/', updateViaCache: 'none' })
              .then((reg) => {
                void reg.update();
              })
              .catch(() => {});
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
    const isLiveSkyView = this.activeMainView === 'live-sky';
    const isCosmicCalendarView = this.activeMainView === 'cosmic-calendar';
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
        <!-- TOP NAVBAR: BRAND + PROFILE BUTTON -->
        <header class="top-navbar">
          <div class="brand-group" id="brand-replay-intro-btn" style="cursor:pointer;" title="Zenith Ana Sayfa">
            <img src="/zenith/logo.png" onerror="this.onerror=null;this.src='./logo.png';" alt="Zenith Logo" class="brand-logo" width="40" height="40" />
            <div>
              <div class="brand-title">ZENITH</div>
              <div class="brand-subtitle">İnteraktif Natal &amp; Transit Astroloji Motoru</div>
            </div>
          </div>

          <nav class="header-actions" aria-label="Profil Gezinmesi">
            <button
              type="button"
              id="nav-profile-view-btn"
              class="btn ${isProfileView ? 'btn-primary' : this.authState.currentUser ? 'btn-account' : ''}"
              aria-current="${isProfileView ? 'page' : 'false'}"
            >
              ${UI_ICONS.user}
              <span>Profil (${this.authState.currentUser ? this.authState.currentUser.fullName.split(' ')[0] : input.fullName ? input.fullName.split(' ')[0] : 'Hesabım'})</span>
            </button>
          </nav>
        </header>

        ${
          isChartView
            ? `
          <!-- ANA SAYFA (ORTA SEKME): DOĞUM HARİTASI & 4 ANA RAPOR MODÜLÜ -->
          <section class="tabs-section" aria-label="Detaylı Astrolojik Rapor Sekmeleri">
            <nav class="tab-nav" role="tablist">
              <button type="button" role="tab" data-tab="big-three" class="tab-btn ${this.activeTab === 'big-three' ? 'active' : ''}" aria-selected="${this.activeTab === 'big-three'}">
                ${UI_ICONS.sparkle}
                <span>Büyük Üçlü</span>
              </button>
              <button type="button" role="tab" data-tab="planet-table" class="tab-btn ${this.activeTab === 'planet-table' ? 'active' : ''}" aria-selected="${this.activeTab === 'planet-table'}">
                ${UI_ICONS.grid}
                <span>Gezegen Tablosu</span>
              </button>
              <button type="button" role="tab" data-tab="active-transits" class="tab-btn ${this.activeTab === 'active-transits' ? 'active' : ''}" aria-selected="${this.activeTab === 'active-transits'}">
                ${UI_ICONS.bolt}
                <span>Transitler (${activeTransits.length})</span>
              </button>
              <button type="button" role="tab" data-tab="personality-synthesis" class="tab-btn ${this.activeTab === 'personality-synthesis' ? 'active' : ''}" aria-selected="${this.activeTab === 'personality-synthesis'}">
                ${UI_ICONS.layers}
                <span>Kişilik Analizi</span>
              </button>
            </nav>

            <div class="tab-content-area" id="tab-panel-content"></div>
          </section>

          <!-- DOĞUM HARİTASI (İNTERAKTİF VEKTÖR ÇARK + GEZEGEN & EKSEN DİZİLİMİ + 4 KATMANLI SENTEZ DENETÇİSİ) -->
          <main class="workspace-grid">
            <section class="wheel-panel" aria-label="İnteraktif Doğum Haritası Çarkı">
              <div class="wheel-toolbar">
                <div class="wheel-legend">
                  <span class="legend-item"><span class="legend-dot" style="background:var(--el-fire)"></span>Ateş</span>
                  <span class="legend-item"><span class="legend-dot" style="background:var(--el-earth)"></span>Toprak</span>
                  <span class="legend-item"><span class="legend-dot" style="background:var(--el-air)"></span>Hava</span>
                  <span class="legend-item"><span class="legend-dot" style="background:var(--el-water)"></span>Su</span>
                  <span class="legend-item"><span class="legend-dot" style="background:#9A6B22"></span>ASC-DSC</span>
                  <span class="legend-item"><span class="legend-dot" style="background:#3B6D11"></span>MC-IC</span>
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

              <details id="natal-planets-accordion" class="electional-accordion calendar-accordion" style="inline-size:100%;" ${this.isNatalPlanetsAccordionOpen ? 'open' : ''}>
                <summary class="electional-accordion-summary calendar-summary">
                  <span class="electional-summary-left">${UI_ICONS.planet} <span>Doğum Haritası Gezegen &amp; Eksen Dizilimi (11 Gök Cismi)</span></span>
                  <span class="electional-summary-hint">Listeyi Aç / Kapat ▾</span>
                </summary>
                <div class="electional-accordion-body">
                  <div class="live-sky-planet-grid" id="wheel-quick-pills" role="toolbar" aria-label="Hızlı Gezegen ve Eksen Seçici"></div>
                </div>
              </details>
            </section>

            <!-- RIGHT: 4-LAYER PERSONALIZED SYNTHESIS INSPECTOR -->
            <aside class="inspector-panel" id="inspector-container" aria-live="polite"></aside>
          </main>
        `
            : isLiveSkyView
              ? `
          <!-- SOL ALT MENÜ SAYFASI: CANLI GÖKYÜZÜ (GÖKSEL HARİTA + ANLIK GÖKYÜZÜ GEZEGEN DİZİLİMİ + CANLI GÖKYÜZÜ EŞLEŞTİRİCİ TABLOSU) -->
          <section class="live-sky-module" aria-label="Canlı Gökyüzü Eşleştirici Göksel Temsili Harita Modülü">
            <div class="live-sky-header">
              <details class="live-sky-meta-dropdown" open>
                <summary class="live-sky-meta-summary">
                  <span class="live-pulse-dot" aria-hidden="true"></span>
                  <h2 class="live-sky-title">${UI_ICONS.compass} <span>Canlı Gökyüzü Eşleştirici (UTC / Yerel Göksel Harita)</span></h2>
                  <span class="live-sky-dropdown-chevron" aria-hidden="true">▾</span>
                </summary>
                <ul class="live-sky-meta-list">
                  <li>
                    <span class="badge" style="color:#27500A; border-color:#C0DD97; background:#EAF3DE;">
                      ${UI_ICONS.target} <span>±2.0° Dar Orb • ${activeTransits.length} Aktif Transit</span>
                    </span>
                  </li>
                  <li>${UI_ICONS.clock} <strong>Yerel:</strong> ${transitDateStr} • ${transitTimeStr}</li>
                  <li>${UI_ICONS.globe} <strong>UTC:</strong> ${utcDateStr} • ${utcTimeStr} UTC</li>
                  <li>${UI_ICONS.pin} <strong>Referans Ufuk:</strong> ${input.location.name} (ASC ${this.chart.angles.asc.sign.glyph} ${this.chart.angles.asc.degreeFormatted})</li>
                </ul>
              </details>

              <div class="live-sky-controls">
                <button type="button" id="live-sky-rot-left-btn" class="btn btn-icon" aria-label="Göksel Haritayı Sola Döndür" title="Sola Döndür">⟲</button>
                <button type="button" id="live-sky-rot-right-btn" class="btn btn-icon" aria-label="Göksel Haritayı Sağa Döndür" title="Sağa Döndür">⟳</button>
                <button type="button" id="live-sky-reset-btn" class="btn btn-icon" aria-label="Göksel Harita Yönünü Sıfırla" title="Sıfırla">↺</button>
                <button type="button" id="refresh-transit-btn" class="btn btn-icon active">
                  ${this.isPreviewingFutureDate ? `${UI_ICONS.clock} <span>Şu Anki Canlı Gökyüzüne Dön</span>` : `${UI_ICONS.refresh} <span>Anlık Gökyüzünü Yenile</span>`}
                </button>
              </div>
            </div>

            <div class="live-sky-workspace">
              <!-- 1. GÖKSEL HARİTA ÇARKI -->
              <div class="live-sky-wheel-card">
                <div class="wheel-legend" style="justify-content:center;">
                  <span class="legend-item"><span class="legend-dot" style="background:#3B6D11"></span>Anlık Gökyüzü (Transit)</span>
                  <span class="legend-item"><span class="legend-dot" style="background:#9A6B22"></span>Natal Referans</span>
                  <span class="legend-item"><span class="legend-dot" style="background:#2B5B6C"></span>Uyumlu Açı</span>
                  <span class="legend-item"><span class="legend-dot" style="background:#B84322"></span>Dinamik Açı</span>
                </div>

                <div class="live-sky-canvas-stage">
                  <canvas id="live-sky-wheel-canvas" aria-label="Canlı Gökyüzü Eşleştirici Göksel Temsili Harita Çarkı"></canvas>
                </div>

                <p class="live-sky-wheel-caption">
                  Çark üzerindeki <strong>dış göksel madalyonlar</strong> gezegenlerin şu anki gerçek zamanlı Zodyak konumlarını, <strong>iç halka</strong> ise doğum haritanızla olan rezonans ışınlarını gösterir.
                </p>
              </div>

              <!-- 2. ANLIK GÖKYÜZÜ GEZEGEN DİZİLİMİ & CANLI GÖKYÜZÜ EŞLEŞTİRİCİ TABLOSU -->
              <div class="live-sky-inspector-col">
                <div id="live-sky-selected-detail" class="live-sky-detail-card" aria-live="polite"></div>

                <details id="live-sky-planets-accordion" class="electional-accordion ephemeris-accordion" ${this.isLiveSkyPlanetsAccordionOpen ? 'open' : ''}>
                  <summary class="electional-accordion-summary ephemeris-summary">
                    <span class="electional-summary-left">${UI_ICONS.planet} <span>Anlık Gökyüzü Gezegen Dizilimi (11 Gök Cismi)</span></span>
                    <span class="electional-summary-hint">Tabloyu Aç / Kapat ▾</span>
                  </summary>
                  <div class="electional-accordion-body">
                    <div id="live-sky-planet-grid" class="live-sky-planet-grid" role="toolbar" aria-label="Canlı Gökyüzü Gezegen Seçici"></div>
                  </div>
                </details>

                <div id="live-sky-active-chips" class="live-sky-active-chips"></div>
              </div>
            </div>
          </section>
        `
              : isCosmicCalendarView
                ? `
          <!-- SAĞ ALT MENÜ SAYFASI: KOZMİK TAKVİM -->
          <section class="electional-planner-module" id="electional-planner-container" aria-label="30 Günlük Kozmik Zamanlama Takvimi"></section>
        `
                : `
          <!-- PROFİL SAYFASI: HESABIM VE HARİTA BİLGİLERİ -->
          <main class="profile-page-view" aria-label="Profil Sayfası: Hesabım ve Harita Bilgileri">
            <!-- AKTİF PROFİL ÖZET BARI -->
            <section class="profile-page-banner" aria-label="Aktif Doğum Haritası Özeti">
              <div class="profile-summary-info">
                <span class="profile-name-badge">${UI_ICONS.sparkle} <span>${input.fullName || 'İsimsiz Harita'}</span></span>
                <span class="profile-meta-chip">${input.birthDate} • ${input.birthTime}</span>
                <span class="profile-meta-chip">${UI_ICONS.pin} <span>${input.location.name} (${input.location.latitude.toFixed(2)}°K, ${input.location.longitude.toFixed(2)}°D)</span></span>
                <span class="profile-tz-chip">${input.location.timezone} (${utcOffsetFormatted})</span>
                ${
                  this.authState.currentUser
                    ? `<span class="profile-tz-chip" style="color:#27500A; border-color:#C0DD97; background:#EAF3DE;">${UI_ICONS.check} <span>Hesap: ${this.authState.currentUser.email}</span></span>`
                    : `<span class="profile-tz-chip" style="color:#27500A; border-color:#C0DD97; background:#EAF3DE;">${UI_ICONS.check} <span>Cihazda Kalıcı Kayıtlı</span></span>`
                }
              </div>
              <div class="profile-banner-actions">
                <button type="button" id="profile-copy-link-btn" class="btn btn-icon" style="color:#8C5A14;">
                  ${UI_ICONS.link} <span>Harita Bağlantımı Kopyala</span>
                </button>
                ${
                  isStandaloneOrNative
                    ? ''
                    : `<button type="button" id="pwa-install-btn" class="btn btn-pwa">
                        ${UI_ICONS.download} <span>Ana Ekrana Ekle</span>
                      </button>`
                }
                <button type="button" id="back-to-chart-btn" class="btn btn-primary">
                  ${UI_ICONS.planet} <span>Doğum Haritasına Dön</span>
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
                    <h2 id="birth-modal-title" style="font-size:1.1rem; font-weight:700; display:flex; align-items:center; gap:0.45rem;">${UI_ICONS.settings} <span>Harita Bilgileri &amp; Konum Parametreleri</span></h2>
                    <p style="font-size:0.77rem; color:var(--text-secondary);">Jeosentrik Tropikal Zodyak, Placidus Ev Sistemi ve IANA Otomatik Saat Dilimi</p>
                  </div>
                </div>

                ${
                  this.profileState.savedProfiles.length > 0
                    ? `
                  <div style="background:#EAF3DE; border:1px solid #C0DD97; border-radius:12px; padding:0.75rem;">
                    <div style="font-size:0.75rem; font-weight:700; color:#27500A; margin-bottom:0.45rem; display:flex; align-items:center; gap:0.35rem;">
                      ${UI_ICONS.bookmark} <span>Cihazda Kalıcı Kayıtlı Haritalarım (Ana Ekran PWA Dahil):</span>
                    </div>
                    <div style="display:flex; gap:0.4rem; flex-wrap:wrap; align-items:center;">
                      ${this.profileState.savedProfiles
                        .map(
                          (sp, idx) => `
                        <div style="display:inline-flex; align-items:center; gap:0.2rem; background:#FFFCFA; border:1px solid #C0DD97; border-radius:999px; padding:0.15rem 0.45rem;">
                          <button type="button" class="btn btn-icon saved-profile-select-btn" data-saved-idx="${idx}" style="border:none; background:transparent; padding:0.2rem 0.35rem; font-size:0.76rem; color:#2C2C1A;">
                            ${sp.fullName} (${sp.birthDate})
                          </button>
                          <button type="button" class="btn btn-icon saved-profile-delete-btn" data-delete-idx="${idx}" title="Bu kaydı sil" style="border:none; background:transparent; color:#B84322; padding:0.15rem 0.3rem; font-size:0.72rem;">✕</button>
                        </div>
                      `
                        )
                        .join('')}
                    </div>
                  </div>
                `
                    : ''
                }

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
                        ${UI_ICONS.alert} <span>Lütfen geçerli bir doğum tarihi giriniz.</span>
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
                        ${UI_ICONS.alert} <span>Lütfen doğum saatini (SS:DD) giriniz.</span>
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
                        ${UI_ICONS.alert} <span>Lütfen bir doğum şehri/ilçesi seçiniz.</span>
                      </div>

                      <div id="selected-location-Readout" style="margin-top:0.35rem; font-family:var(--font-mono); font-size:0.75rem; color:#27500A;">
                        Seçili Konum: <strong>${this.selectedModalLocation.name} (${this.selectedModalLocation.country})</strong> •
                        ${this.selectedModalLocation.latitude.toFixed(4)}°K, ${this.selectedModalLocation.longitude.toFixed(4)}°D •
                        IANA: ${this.selectedModalLocation.timezone}
                      </div>

                      <ul class="location-results-list" id="location-results-ul" role="listbox" aria-label="Şehir ve İlçe Sonuçları"></ul>
                    </div>
                  </div>

                  <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.6rem; margin-top:1.15rem;">
                    <span style="font-size:0.74rem; color:#27500A; display:inline-flex; align-items:center; gap:0.35rem;">
                      ${UI_ICONS.lock} <span>Bilgileriniz bu cihazda ve Ana Ekran (PWA) uygulamasında kalıcı olarak saklanır.</span>
                    </span>
                    <div style="display:flex; gap:0.6rem;">
                      <button type="submit" class="btn btn-primary">${UI_ICONS.check} <span>Kalıcı Kaydet &amp; Haritayı Çiz</span></button>
                    </div>
                  </div>
                </form>
              </section>
            </div>
          </main>
        `
        }

        <!-- BOTTOM NAVIGATION MENU: CANLI GÖKYÜZÜ | DOĞUM HARİTASI (ORTA - ANA SAYFA) | KOZMİK TAKVİM -->
        <nav class="bottom-nav-bar" aria-label="Alt Ana Menü">
          <div class="bottom-nav-inner">
            <button
              type="button"
              class="bottom-nav-item ${isLiveSkyView ? 'active' : ''}"
              data-bottom-nav="live-sky"
              aria-current="${isLiveSkyView ? 'page' : 'false'}"
            >
              <span class="bottom-nav-icon">${UI_ICONS.compass}</span>
              <span class="bottom-nav-label">Canlı Gökyüzü</span>
            </button>

            <button
              type="button"
              class="bottom-nav-item center-home ${isChartView ? 'active' : ''}"
              data-bottom-nav="chart"
              aria-current="${isChartView ? 'page' : 'false'}"
            >
              <span class="bottom-nav-icon">${UI_ICONS.planet}</span>
              <span class="bottom-nav-label">Doğum Haritası</span>
            </button>

            <button
              type="button"
              class="bottom-nav-item ${isCosmicCalendarView ? 'active' : ''}"
              data-bottom-nav="cosmic-calendar"
              aria-current="${isCosmicCalendarView ? 'page' : 'false'}"
            >
              <span class="bottom-nav-icon">${UI_ICONS.calendar}</span>
              <span class="bottom-nav-label">Kozmik Takvim</span>
            </button>
          </div>
        </nav>
      </div>

      <!-- PWA INSTALL INFO DIALOG -->
      <dialog id="pwa-info-modal" class="zenith-dialog" closedby="any" aria-labelledby="pwa-modal-title">
        <div class="dialog-inner">
          <div class="dialog-header">
            <h2 id="pwa-modal-title" style="font-size:1.05rem; font-weight:700; display:flex; align-items:center; gap:0.45rem;">${UI_ICONS.download} <span>Zenith PWA — Ana Ekrana Ekle</span></h2>
            <button type="button" id="close-pwa-modal-btn" class="btn btn-icon" aria-label="Kapat">✕</button>
          </div>
          <p style="font-size:0.86rem; color:var(--text-primary);">
            <strong>Zenith</strong>, kişisel doğum bilgilerinizi <strong>5 katmanlı kalıcı hafıza</strong> (IndexedDB, Service Worker Cache, 10 Yıllık Çerez, LocalStorage ve Kişisel URL) ile korur; uygulamayı ana ekrana eklediğinizde veya kapattığınızda bilgileriniz silinmez.
          </p>
          <ul style="font-size:0.83rem; color:var(--text-secondary); padding-inline-start:1.2rem; display:flex; flex-direction:column; gap:0.45rem;">
            <li><strong>1. Adım:</strong> Önce <em>"Profil"</em> sayfasından kendi doğum bilgilerinizi kaydedin.</li>
            <li><strong>2. Adım (iOS / Safari):</strong> Alt bardaki <em>Paylaş</em> simgesine dokunun ve <strong>"Ana Ekrana Ekle"</strong> seçeneğini seçin (aktif profiliniz otomatik olarak ana ekran simgesine gömülür).</li>
            <li><strong>2. Adım (Android / Chrome):</strong> Tarayıcı menüsünden (⋮) <strong>"Uygulamayı Yükle"</strong> veya <strong>"Ana Ekrana Ekle"</strong> seçeneğine dokunun.</li>
          </ul>
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
            <button type="button" id="copy-profile-link-btn" class="btn btn-icon" style="color:#8C5A14;">
              ${UI_ICONS.link} <span>Kişisel Harita Bağlantımı Kopyala</span>
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
          if (this.activeTab === 'active-transits') {
            this.renderTabContent();
          }
        }
      );
    } else {
      this.liveSkyCanvas = null;
    }

    if (isChartView) {
      this.renderQuickPills();
      this.renderInspector();
      this.renderTabContent();
    } else if (isLiveSkyView) {
      this.renderLiveSkyMatcher();
    } else if (isCosmicCalendarView) {
      this.renderElectionalPlanner();
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
    const orderedCatIds: ElectionalCategoryId[] = [
      'career',
      'meeting',
      'education',
      'finance',
      'relationship',
      'family'
    ];
    const catList = orderedCatIds.map((id) => ELECTIONAL_CATEGORIES[id]);
    const selectedDay =
      res.allDays.find((d) => d.dateIso === this.selectedElectionalDayIso) ||
      res.topOptimalDays[0] ||
      res.allDays[0];

    const TR_MONTHS_LONG = [
      'Ocak',
      'Şubat',
      'Mart',
      'Nisan',
      'Mayıs',
      'Haziran',
      'Temmuz',
      'Ağustos',
      'Eylül',
      'Ekim',
      'Kasım',
      'Aralık'
    ];
    const TR_MONTHS_SHORT = [
      'Oca',
      'Şub',
      'Mar',
      'Nis',
      'May',
      'Haz',
      'Tem',
      'Ağu',
      'Eyl',
      'Eki',
      'Kas',
      'Ara'
    ];

    const parseIsoLocal = (iso: string) => {
      const [y, m, d] = iso.split('-').map(Number);
      return { y, m, d, dateObj: new Date(y, m - 1, d) };
    };

    const firstParsed = parseIsoLocal(res.allDays[0].dateIso);
    const lastParsed = parseIsoLocal(res.allDays[res.allDays.length - 1].dateIso);
    const calendarMonthTitle =
      firstParsed.m === lastParsed.m && firstParsed.y === lastParsed.y
        ? `${TR_MONTHS_LONG[firstParsed.m - 1]} ${firstParsed.y}`
        : firstParsed.y === lastParsed.y
          ? `${TR_MONTHS_LONG[firstParsed.m - 1]} — ${TR_MONTHS_LONG[lastParsed.m - 1]} ${firstParsed.y}`
          : `${TR_MONTHS_LONG[firstParsed.m - 1]} ${firstParsed.y} — ${TR_MONTHS_LONG[lastParsed.m - 1]} ${lastParsed.y}`;

    // Monday-based day of week index (0 = Pzt ... 6 = Paz)
    const leadingEmptyCount = (firstParsed.dateObj.getDay() + 6) % 7;
    const totalCellsUsed = leadingEmptyCount + res.allDays.length;
    const trailingEmptyCount = (7 - (totalCellsUsed % 7)) % 7;

    const leadingEmptyHtml = Array.from({ length: leadingEmptyCount })
      .map(() => `<div class="monthly-cal-cell empty" aria-hidden="true"></div>`)
      .join('');
    const trailingEmptyHtml = Array.from({ length: trailingEmptyCount })
      .map(() => `<div class="monthly-cal-cell empty" aria-hidden="true"></div>`)
      .join('');

    container.innerHTML = `
      <!-- 1. 30 GÜNLÜK KOZMİK ZAMANLAMA TAKVİMİ -->
      <div class="electional-header">
        <div class="electional-title-block">
          <div class="live-sky-title-row">
            <span class="live-pulse-dot" style="background:#9A6B22;" aria-hidden="true"></span>
            <h2 class="live-sky-title">${UI_ICONS.calendar} <span>30 Günlük Kozmik Zamanlama Takvimi</span></h2>
            <span class="badge" style="color:#8C5A14; border-color:#DFC79C; background:#F7EFE0;">
              %100 Gerçek Astronomik Veri (VSOP87 / JPL)
            </span>
          </div>
          <p class="electional-subtitle">
            Seçtiğiniz kategoriyle ilgili doğum haritası evlerinizi, kişisel ev yöneticilerinizi ve natal gezegen derecelerinizi önümüzdeki 30 günün (<strong>${res.startDateFormatted} — ${res.endDateFormatted}</strong>) gerçek gökyüzü boylamlarıyla gün gün karşılaştırır.
          </p>
        </div>
      </div>

      <!-- KATEGORİ SEÇİM BAR -->
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
                <span class="elec-cat-icon">${cat.icon}</span>
                <span>${cat.shortLabel}</span>
              </button>
            `;
          })
          .join('')}
      </div>

      <!-- 2. KİŞİSEL HARİTA REFERANSLARINIZ -->
      <div class="electional-methodology-bar">
        <div class="electional-methodology-head">
          <strong class="electional-methodology-title">${UI_ICONS.grid} <span>Kişisel Harita Referanslarınız (${res.category.title})</span></strong>
          <p class="electional-methodology-desc">${res.category.methodologyText}</p>
        </div>
        <div class="electional-rulers-grid">
          ${res.natalFocusSummary.personalHouseRulers
            .map(
              (r) => `
              <div class="electional-ruler-card">
                <div class="electional-ruler-card-top">
                  <span class="electional-ruler-house">${r.house}. Eviniz</span>
                  <span class="electional-ruler-cusp">${r.cuspSign} (${r.cuspDegree})</span>
                </div>
                <div class="electional-ruler-card-bottom">
                  <span class="electional-ruler-label">Yöneticisi:</span>
                  <span class="electional-ruler-body">${renderBodyGlyph(r.rulerGlyph)} <strong>${r.rulerName}</strong></span>
                  <span class="electional-ruler-natal">Natal ${r.rulerNatalSign} • ${r.rulerNatalHouse}. Ev</span>
                </div>
              </div>
            `
            )
            .join('')}
        </div>
      </div>

      <!-- 3. 30 GÜNLÜK TAM EPHEMERİS TAKVİMİ (NORMAL AYLIK TAKVİM GÖRÜNÜMÜ) -->
      <details id="calendar-strip-accordion" class="electional-accordion calendar-accordion" ${this.isCalendarAccordionOpen ? 'open' : ''}>
        <summary class="electional-accordion-summary calendar-summary">
          <span class="electional-summary-left">
            ${UI_ICONS.calendar}
            <span>30 Günlük Tam Ephemeris Takvimi (${res.allDays.length} Gün — Aylık Takvim Görünümü)</span>
          </span>
          <span class="electional-summary-hint">Takvimi Aç / Kapat ▾</span>
        </summary>
        <div class="electional-accordion-body">
          <div class="monthly-calendar-wrapper">
            <div class="monthly-calendar-topbar">
              <div class="monthly-calendar-month-title">
                ${UI_ICONS.calendar}
                <span>${calendarMonthTitle}</span>
              </div>
              <div class="monthly-calendar-legend">
                <span class="mcal-legend-item"><i class="mcal-dot optimal"></i> En Uygun</span>
                <span class="mcal-legend-item"><i class="mcal-dot supportive"></i> Destekleyici</span>
                <span class="mcal-legend-item"><i class="mcal-dot caution"></i> Dikkat</span>
              </div>
            </div>

            <div class="monthly-weekdays-row" aria-hidden="true">
              <span>Pzt</span>
              <span>Sal</span>
              <span>Çar</span>
              <span>Per</span>
              <span>Cum</span>
              <span>Cmt</span>
              <span>Paz</span>
            </div>

            <div class="monthly-calendar-grid" role="listbox" aria-label="30 Günlük Aylık Astrolojik Takvim">
              ${leadingEmptyHtml}
              ${res.allDays
                .map((d, idx) => {
                  const isSel = d.dateIso === selectedDay.dateIso;
                  const parsed = parseIsoLocal(d.dateIso);
                  const showMonthLabel = parsed.d === 1 || idx === 0;
                  const dayLabel = showMonthLabel
                    ? `${parsed.d} ${TR_MONTHS_SHORT[parsed.m - 1]}`
                    : `${parsed.d}`;
                  return `
                    <button
                      type="button"
                      role="option"
                      aria-selected="${isSel}"
                      class="monthly-cal-cell ${d.verdict} ${isSel ? 'selected' : ''}"
                      data-open-elec-day="${d.dateIso}"
                    >
                      <div class="mcal-cell-top">
                        <span class="mcal-day-num ${showMonthLabel ? 'has-month' : ''}">${dayLabel}</span>
                        <span class="mcal-day-score">${d.netScore >= 0 ? '+' : ''}${d.netScore}</span>
                      </div>
                      <div class="mcal-cell-bottom">
                        <span class="mcal-day-moon">${d.moonSignGlyph} ${d.moonSignName.slice(0, 3)}</span>
                      </div>
                    </button>
                  `;
                })
                .join('')}
              ${trailingEmptyHtml}
            </div>
          </div>
        </div>
      </details>

      <!-- 4. DİKKAT EDİLMESİ / ESNEK OLUNMASI ÖNERİLEN GÜNLER -->
      <details id="caution-days-accordion" class="electional-accordion caution-accordion" ${this.isCautionAccordionOpen ? 'open' : ''}>
        <summary class="electional-accordion-summary caution-summary">
          <span class="electional-summary-left">
            ${UI_ICONS.alert}
            <span>Dikkat Edilmesi / Esnek Olunması Önerilen Günler (${res.cautionDays.length} Gün — Sert Kare/Karşıt Açılar)</span>
          </span>
          <span class="electional-summary-hint">Listeyi Aç / Kapat ▾</span>
        </summary>
        <div class="electional-accordion-body">
          ${
            res.cautionDays.length > 0
              ? `
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
                          <span class="electional-rank-badge caution-badge">Yüksek Gerilim Açısı</span>
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
                              — <span style="color:#9C3A1C; font-family:var(--font-mono); font-weight:600;">Orb: ${topChal.orbFormatted}</span>
                            </div>`
                          : ''
                      }
                    </div>
                  `;
                })
                .join('')}
            </div>
          `
              : `<div class="balance-card">Seçili kategoride önümüzdeki 30 gün boyunca yüksek gerilimli sert açı baskısı taşıyan kritik gün bulunmuyor.</div>`
          }
        </div>
      </details>

      <!-- 5. ÖNÜMÜZDEKİ 30 GÜNDE EN UYGUN OLAN GÜNLER -->
      <details id="optimal-days-accordion" class="electional-accordion" ${this.isOptimalAccordionOpen ? 'open' : ''}>
        <summary class="electional-accordion-summary">
          <span class="electional-summary-left">
            ${UI_ICONS.star}
            <span>Önümüzdeki 30 Günde En Uygun Günler (${res.topOptimalDays.length} Gün — Gerçek Açı &amp; Orb Kanıtlı)</span>
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
                      <span class="badge" style="color:#27500A; border-color:#C0DD97; background:#EAF3DE;">
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
                            — <span style="color:#27500A; font-family:var(--font-mono); font-weight:600;">Orb: ${topEv.orbFormatted}</span>
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

      <!-- SEÇİLEN GÜNÜN AÇILIR PENCERE (MODAL DIALOG) DETAYI (modern-web-guidance: light-dismiss-a-dialog) -->
      <dialog id="electional-day-modal" closedby="any" class="zenith-dialog" aria-labelledby="electional-modal-title">
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

    const calAcc = document.getElementById('calendar-strip-accordion') as HTMLDetailsElement | null;
    calAcc?.addEventListener('toggle', () => {
      this.isCalendarAccordionOpen = calAcc.open;
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
          <div class="electional-inspector-badge">${res.category.icon} <span>${res.category.shortLabel} • ${selectedDay.verdictLabel}</span></div>
          <h2 id="electional-modal-title" style="font-size:1.05rem; font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:0.4rem;">
            ${UI_ICONS.calendar} <span>${selectedDay.dateFormatted} (Saat 12:00 Yerel Ephemeris)</span>
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
          <div class="electional-evidence-title" style="color:#2B5B6C; display:flex; align-items:center; gap:0.35rem;">
            ${UI_ICONS.planet} <span>O Gün Hedef Evlerinizden (${res.natalFocusSummary.targetHousesLabel}) Geçen Gezegenler:</span>
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
        <div class="electional-evidence-title" style="color:#27500A; display:flex; align-items:center; gap:0.35rem;">
          ${UI_ICONS.check} <span>Destekleyici Gerçek Gökyüzü Açıları (${selectedDay.supportiveEvidences.length} Açı):</span>
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
                      <span class="orb-pill" style="color:#27500A; border-color:#C0DD97; background:#EAF3DE;">Kesin Orb: ${ev.orbFormatted}</span>
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
        <div class="electional-evidence-title" style="color:#9C3A1C; display:flex; align-items:center; gap:0.35rem;">
          ${UI_ICONS.bolt} <span>Zorlayıcı / Dikkat Gerektiren Gerçek Gökyüzü Açıları (${selectedDay.challengingEvidences.length} Açı):</span>
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
                      <span class="orb-pill" style="color:#9C3A1C; border-color:#E5C4B0; background:#F9EBE5;">Kesin Orb: ${ev.orbFormatted}</span>
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
          ${UI_ICONS.compass} <span>Bu Günün Gökyüzünü Haritada Gör</span>
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
      this.activeMainView = 'live-sky';
      this.renderShell();
      window.scrollTo({ top: 0, behavior: 'smooth' });
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

    const tp = this.liveSkySelectedBodyId
      ? this.chart.transitPlanets.find((p) => p.id === this.liveSkySelectedBodyId) || null
      : null;

    if (chipsEl) {
      const transits = this.chart.activeTransits;
      const formatCompactTargetName = (name: string): string => {
        if (name.includes('Zenith') || name.includes('MC')) return 'Tepe Noktası (MC)';
        if (name.includes('Ascendant') || name.includes('ASC')) return 'Yükselen (ASC)';
        return name;
      };

      if (transits.length === 0) {
        chipsEl.innerHTML = `
          <div class="live-sky-matches-box">
            <div class="live-sky-matches-head">
              <div class="live-sky-matches-title">
                ${UI_ICONS.bolt}
                <span>Aktif ±2.0° Eşleşmeler</span>
                <span class="live-sky-matches-count">0</span>
              </div>
            </div>
            <div style="padding:0.75rem; font-size:0.8rem; color:var(--text-secondary);">
              Şu anda ±2.0° dar orb içinde kesin açı yapan transit bulunmuyor. Aşağıdaki göksel haritadan veya gezegen diziliminden anlık gezegenleri seçerek ev geçişlerini inceleyebilirsiniz.
            </div>
          </div>
        `;
      } else {
        chipsEl.innerHTML = `
          <div class="live-sky-matches-box">
            <div class="live-sky-matches-head">
              <div class="live-sky-matches-title">
                ${UI_ICONS.bolt}
                <span>Aktif ±2.0° Eşleşmeler</span>
                <span class="live-sky-matches-count">${transits.length}</span>
              </div>
            </div>

            <div class="live-sky-matches-col-head" aria-hidden="true">
              <span>TRANSİT GÖK CİSMİ</span>
              <span style="text-align:center;">AÇI</span>
              <span>NATAL HEDEF</span>
              <span style="text-align:end;">ORB</span>
            </div>

            <div class="live-sky-matches-list" role="list">
              ${transits
                .map((at) => {
                  const isAct = tp?.id === at.transitBody.id;
                  const toneColor =
                    at.nature === 'harmonious'
                      ? '#3B6D11'
                      : at.nature === 'challenging'
                        ? '#B84322'
                        : '#9A6B22';
                  const targetLabel = formatCompactTargetName(at.natalTarget.name);
                  const targetGlyph =
                    at.natalTarget.id === 'asc'
                      ? UI_ICONS.compass
                      : at.natalTarget.id === 'mc'
                        ? UI_ICONS.compass
                        : renderBodyGlyph(at.natalTarget.glyph);

                  return `
                    <button
                      type="button"
                      role="listitem"
                      class="live-sky-match-row-btn ${isAct ? 'selected' : ''}"
                      data-live-chip-body="${at.transitBody.id}"
                      aria-pressed="${isAct}"
                    >
                      <span class="lsm-cell lsm-transit">
                        <span class="lsm-glyph">${renderBodyGlyph(at.transitBody.glyph)}</span>
                        <span class="lsm-name">${at.transitBody.name}</span>
                      </span>

                      <span class="lsm-aspect-badge" style="color:${toneColor}; border-color:${toneColor}55; background:${toneColor}14;" title="${at.typeName}">
                        ${at.glyph}
                      </span>

                      <span class="lsm-cell lsm-target">
                        <span class="lsm-glyph">${targetGlyph}</span>
                        <span class="lsm-name">${targetLabel}</span>
                      </span>

                      <span class="lsm-orb" style="color:${toneColor}; border-color:${toneColor}44;">
                        ${at.orb.toFixed(2)}°
                      </span>
                    </button>
                  `;
                })
                .join('')}
            </div>
          </div>
        `;

        chipsEl.querySelectorAll('[data-live-chip-body]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-live-chip-body') as BodyId | null;
            if (id) {
              const isSame = this.liveSkySelectedBodyId === id;
              this.liveSkySelectedBodyId = isSame ? null : id;
              this.liveSkyCanvas?.setSelectedBody(this.liveSkySelectedBodyId, false);
              this.renderLiveSkyMatcher();
            }
          });
        });
      }
    }

    if (!tp) {
      detailEl.style.display = 'none';
      detailEl.innerHTML = '';
    } else {
      detailEl.style.display = '';
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
          <div class="inspector-glyph-box" style="color:${elColor}; border-color:${elColor}; box-shadow: 0 4px 12px ${elGlow};">
            ${renderBodyGlyph(tp.glyph)}
          </div>
          <div class="inspector-title-group">
            <div class="inspector-title">
              <span>Anlık ${tp.name} — ${tp.sign.glyph} ${tp.sign.name}</span>
              <span class="profile-meta-chip">${tp.degreeFormatted}</span>
              <span class="badge" style="color:#27500A; border-color:#C0DD97; background:#EAF3DE;">Natal ${tp.house}. Evinizde</span>
              ${tp.isRetrograde ? `<span class="badge badge-retro">℞ Retro</span>` : `<span class="badge" style="color:#27500A; border-color:#C0DD97; background:#EAF3DE;">İleri Hareket</span>`}
            </div>
            <div class="inspector-subtitle">
              ${tp.sign.elementName} Elementi • ${tp.sign.modalityName} Nitelik • Günlük Hız: ${tp.speed >= 0 ? '+' : ''}${tp.speed.toFixed(2)}°/gün
            </div>
          </div>
        </div>

        <div class="live-sky-resonance-box">
          <div class="live-sky-resonance-house">
            <strong>Haritanızdaki Konum (${tp.house}. Ev — ${houseMeta.shortArena}):</strong>
            Gökyüzünde şu an <strong>${tp.sign.name} (${tp.degreeFormatted})</strong> derecesinde ilerleyen <strong>${tp.name}</strong>, doğum haritanızın <em>${houseMeta.transitActionDomain}</em> temalarını temsil eden <strong>${tp.house}. Ev</strong> alanından geçiyor.
          </div>

          ${
            matchingTransits.length > 0
              ? `<div class="live-sky-resonance-matches">
                  ${matchingTransits
                    .map((tr) => {
                      const toneColor =
                        tr.nature === 'harmonious'
                          ? '#3B6D11'
                          : tr.nature === 'challenging'
                            ? '#B84322'
                            : '#9A6B22';
                      return `
                        <div class="live-sky-match-item" style="border-inline-start: 3px solid ${toneColor};">
                          <div class="live-sky-match-head">
                            <strong>${formatMarkdownBold(tr.headline)}</strong>
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
                  <span><strong>Dar Orb (±2.0°) Durumu:</strong> Anlık ${tp.name} şu an ±2.0° dar orb içinde kesin bir majör açı yapmıyor; ${tp.house}. Ev konularını arka planda çalıştırıyor.</span>
                  ${closestNatalInfo ? `<small>En yakın açısal yaklaşım: ${closestNatalInfo}</small>` : ''}
                </div>`
          }
        </div>
      `;
    }

    gridEl.innerHTML = this.chart.transitPlanets
      .map((p) => {
        const isSel = tp?.id === p.id;
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
              <span class="live-sky-p-name" style="color:${isSel ? '#27500A' : pColor};">
                ${renderBodyGlyph(p.glyph)}
                <span>${p.name}</span>
              </span>
              ${
                tightCount > 0
                  ? `<span class="live-sky-tight-dot" title="${tightCount} Aktif Dar Orb Transit">${tightCount} Açı</span>`
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
          const isSame = this.liveSkySelectedBodyId === id;
          this.liveSkySelectedBodyId = isSame ? null : id;
          this.liveSkyCanvas?.setSelectedBody(this.liveSkySelectedBodyId, false);
          this.renderLiveSkyMatcher();
          if (this.activeTab === 'active-transits') {
            this.renderTabContent();
          }
        }
      });
    });
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
              <span class="live-sky-p-name" style="color:${isSel ? '#27500A' : pColor};">
                ${renderBodyGlyph(p.glyph)}
                <span>${p.name}</span>
              </span>
              <span style="display:inline-flex; align-items:center; gap:0.2rem;">
                ${p.isRetrograde ? `<span class="live-sky-retro-tag" title="Retro Hareket">℞</span>` : ''}
                ${aspectCount > 0 ? `<span class="live-sky-tight-dot" title="${aspectCount} Majör Açı">${aspectCount} Açı</span>` : ''}
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
              <span class="live-sky-p-name" style="color:${isSel ? '#27500A' : aColor};">
                ${UI_ICONS.compass}
                <span>${ang.shortLabel} (${meta.tag})</span>
              </span>
              ${aspectCount > 0 ? `<span class="live-sky-tight-dot" title="${aspectCount} Majör Açı">${aspectCount} Açı</span>` : ''}
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
          const isAlreadySelected =
            this.selection?.kind === 'planet' && this.selection.id === (id as BodyId);
          this.selection = isAlreadySelected ? null : { kind: 'planet', id: id as BodyId };
        } else if (kind === 'angle' && id) {
          const isAlreadySelected =
            this.selection?.kind === 'angle' && this.selection.id === (id as AngleId);
          this.selection = isAlreadySelected ? null : { kind: 'angle', id: id as AngleId };
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

    const workspaceGrid = document.querySelector('.workspace-grid');
    const sel = this.selection;

    if (!sel) {
      container.hidden = true;
      container.innerHTML = '';
      workspaceGrid?.classList.add('inspector-hidden');
      return;
    }

    container.hidden = false;
    workspaceGrid?.classList.remove('inspector-hidden');

    if (sel.kind === 'planet') {
      const syn = this.chart.syntheses[sel.id];
      const p = syn.planet;
      const elColor = ELEMENT_COLORS[p.sign.element].primary;

      container.innerHTML = `
        <div class="inspector-header">
          <div style="display:flex; gap:0.9rem; align-items:center;">
            <div class="inspector-glyph-box" style="color:${elColor}; border-color:${elColor}; box-shadow: 0 4px 14px ${ELEMENT_COLORS[p.sign.element].glow};">
              ${renderBodyGlyph(p.glyph)}
            </div>
            <div class="inspector-title-group">
              <div class="inspector-title">
                <span>${p.name} — ${p.sign.glyph} ${p.sign.name}</span>
                <span class="profile-meta-chip">${p.degreeFormatted}</span>
                <span class="badge" style="color:${elColor}; border-color:${elColor};">${p.house}. Ev</span>
                ${p.isRetrograde ? `<span class="badge badge-retro">℞ Retro</span>` : ''}
                ${p.dignity && p.dignity !== 'Peregrin' ? `<span class="badge badge-dignity">${p.dignity}</span>` : ''}
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
              <span class="layer-title">${UI_ICONS.planet} <span>${syn.layer1Location.title}</span></span>
              <span class="badge">${syn.layer1Location.signTheme}</span>
            </div>
            <div class="layer-body">
              ${formatMarkdownBold(syn.layer1Location.narrative)}
            </div>
          </div>

          <!-- LAYER 2: ASPECT MODULATION -->
          <div class="layer-card layer-2">
            <div class="layer-header">
              <span class="layer-title">${UI_ICONS.grid} <span>${syn.layer2AspectModulation.title}</span></span>
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
              <span class="layer-title">${UI_ICONS.crown} <span>${syn.layer3Dispositor.title}</span></span>
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
              <span class="layer-title">${UI_ICONS.bolt} <span>${syn.layer4TransitSummary.title}</span></span>
              <span class="badge" style="color:#27500A; border-color:#C0DD97; background:#EAF3DE;">
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
              <span class="layer-title">${UI_ICONS.compass} <span>Ana Eksen Mimarisi</span></span>
            </div>
            <div class="layer-body">
              <strong>${ang.name}</strong>, doğum anınızda ufuk ve meridyen düzleminin zodyak kuşağıyla kesiştiği en kritik kardinal kapıdır. <strong>${ang.fullFormatted}</strong> derecesindeki bu yerleşim, ${houseMeta.arenaDescription} alanında <strong>${ang.sign.keywords.join(', ')}</strong> ilkeleriyle hareket ettiğinizi gösterir.
            </div>
          </div>
          <div class="layer-card layer-3">
            <div class="layer-header">
              <span class="layer-title">${UI_ICONS.crown} <span>Eksen Yöneticisi Bağlantısı</span></span>
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
              <span class="layer-title">${UI_ICONS.home} <span>Yaşam Alanı &amp; Burç Sentezi</span></span>
            </div>
            <div class="layer-body">
              Haritanızda <strong>${cusp.house}. Ev</strong> başlangıcı <strong>${cusp.sign.name}</strong> burcunun ${cusp.degreeFormatted} derecesiyle açılıyor. Yaşamınızda ${houseMeta.arenaDescription} süreçlerini ${cusp.sign.name} burcunun <strong>${cusp.sign.keywords.join(', ')}</strong> doğasıyla yönetirsiniz.
            </div>
          </div>

          <div class="layer-card layer-2">
            <div class="layer-header">
              <span class="layer-title">${UI_ICONS.planet} <span>Bu Evdeki Natal Gezegenler (${natalInHouse.length})</span></span>
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
              <span class="layer-title">${UI_ICONS.bolt} <span>Anlık Gökyüzü Transit Geçişleri (${transitInHouse.length})</span></span>
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

    if (!this.activeTab) {
      container.hidden = true;
      container.innerHTML = '';
      return;
    }

    container.hidden = false;

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
            <p style="font-size:0.84rem; color:var(--text-secondary);">
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
            <p style="font-size:0.84rem; color:var(--text-secondary);">
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
            <p style="font-size:0.84rem; color:var(--text-secondary);">
              Dış dünyayla kurduğunuz ilk temas ve yaşama başlangıç motivasyonunuz <strong>${asc.sign.name}</strong> burcunun ${asc.sign.keywords.join(', ').toLocaleLowerCase('tr-TR')} filtresinden geçer. Harita yöneticiniz <strong>${renderBodyGlyph(ruler.glyph)} ${ruler.name}</strong>, <strong>${ruler.sign.name}</strong> burcunda ve <strong>${ruler.house}. Evde</strong> konumlanarak yaşam enerjinizi bu alana odaklar.
            </p>
          </article>

          <article class="archetype-card">
            <div class="archetype-card-top">
              <span class="archetype-role" style="color:var(--accent-emerald);">MC Zenith — Kariyer Zirvesi &amp; İtibar</span>
              <span class="archetype-degree-mono">${mc.degreeFormatted} • 10. Ev Zirvesi</span>
            </div>
            <div class="archetype-sign-headline">
              <span style="color:${ELEMENT_COLORS[mc.sign.element].primary}">${mc.sign.glyph}</span>
              <span>${mc.sign.name}</span>
            </div>
            <p style="font-size:0.84rem; color:var(--text-secondary);">
              Toplumsal statü, kariyer zirvesi (Zenith) ve profesyonel miras ekseniniz <strong>${mc.fullFormatted}</strong> derecesindedir. Kamusal alanda <strong>${mc.sign.keywords.join(', ')}</strong> nitelikleriyle tanınır ve otorite inşa edersiniz.
            </p>
          </article>
        </div>

        <div class="element-balance-grid">
          ${(['fire', 'earth', 'air', 'water'] as const)
            .map((elKey) => {
              const info = this.chart.elementCounts[elKey];
              const names = {
                fire: `${UI_ICONS.fire} <span>Ateş Elementi (İrade &amp; Vizyon)</span>`,
                earth: `${UI_ICONS.earth} <span>Toprak Elementi (Somutluk &amp; İstikrar)</span>`,
                air: `${UI_ICONS.air} <span>Hava Elementi (Analiz &amp; İletişim)</span>`,
                water: `${UI_ICONS.water} <span>Su Elementi (Sezgi &amp; Derinlik)</span>`
              };
              const col = ELEMENT_COLORS[elKey].primary;
              return `
                <div class="balance-card">
                  <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; font-weight:700;">
                    <span style="display:inline-flex; align-items:center; gap:0.35rem; color:${col};">${names[elKey]}</span>
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
                            : `<span style="color:#27500A; font-weight:600;">Düz (+${p.speed.toFixed(2)}°/g)</span>`
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
                <span style="font-family:var(--font-mono); font-size:0.8rem; color:${ELEMENT_COLORS[h.sign.element].primary}; font-weight:600;">
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
      const formatCompactTargetName = (name: string): string => {
        if (name.includes('Zenith') || name.includes('MC')) return 'Tepe Noktası (MC)';
        if (name.includes('Ascendant') || name.includes('ASC')) return 'Yükselen (ASC)';
        return name;
      };

      const activeMatchesTableHtml =
        transits.length > 0
          ? `
          <div class="live-sky-matches-box" style="margin-bottom:0.85rem;">
            <div class="live-sky-matches-head">
              <div class="live-sky-matches-title">
                ${UI_ICONS.bolt}
                <span>Aktif ±2.0° Eşleşmeler</span>
                <span class="live-sky-matches-count">${transits.length}</span>
              </div>
            </div>

            <div class="live-sky-matches-col-head" aria-hidden="true">
              <span>TRANSİT GÖK CİSMİ</span>
              <span style="text-align:center;">AÇI</span>
              <span>NATAL HEDEF</span>
              <span style="text-align:end;">ORB</span>
            </div>

            <div class="live-sky-matches-list" role="list">
              ${transits
                .map((at) => {
                  const isAct = this.liveSkySelectedBodyId === at.transitBody.id;
                  const toneColor =
                    at.nature === 'harmonious'
                      ? '#3B6D11'
                      : at.nature === 'challenging'
                        ? '#B84322'
                        : '#9A6B22';
                  const targetLabel = formatCompactTargetName(at.natalTarget.name);
                  const targetGlyph =
                    at.natalTarget.id === 'asc'
                      ? UI_ICONS.compass
                      : at.natalTarget.id === 'mc'
                        ? UI_ICONS.compass
                        : renderBodyGlyph(at.natalTarget.glyph);

                  return `
                    <button
                      type="button"
                      role="listitem"
                      class="live-sky-match-row-btn ${isAct ? 'selected' : ''}"
                      data-live-chip-body="${at.transitBody.id}"
                      aria-pressed="${isAct}"
                    >
                      <span class="lsm-cell lsm-transit">
                        <span class="lsm-glyph">${renderBodyGlyph(at.transitBody.glyph)}</span>
                        <span class="lsm-name">${at.transitBody.name}</span>
                      </span>

                      <span class="lsm-aspect-badge" style="color:${toneColor}; border-color:${toneColor}55; background:${toneColor}14;" title="${at.typeName}">
                        ${at.glyph}
                      </span>

                      <span class="lsm-cell lsm-target">
                        <span class="lsm-glyph">${targetGlyph}</span>
                        <span class="lsm-name">${targetLabel}</span>
                      </span>

                      <span class="lsm-orb" style="color:${toneColor}; border-color:${toneColor}44;">
                        ${at.orb.toFixed(2)}°
                      </span>
                    </button>
                  `;
                })
                .join('')}
            </div>
          </div>
        `
          : '';

      container.innerHTML = `
        ${activeMatchesTableHtml}

        <details class="electional-accordion calendar-accordion" id="active-transits-matches-accordion" ${this.isActiveTransitsMatchesAccordionOpen ? 'open' : ''}>
          <summary class="electional-accordion-summary calendar-summary">
            <span class="electional-summary-left">${UI_ICONS.bolt} <span>Bugünün Gökyüzü Etkisi — Aktif Dar Orblu (±2.0°) Transit Eşleşmeleri (${transits.length} Aktif Transit)</span></span>
            <span class="electional-summary-hint">Listeyi Aç / Kapat ▾</span>
          </summary>
          <div class="electional-accordion-body">
            <p style="font-size:0.82rem; color:var(--text-secondary); margin-bottom:0.85rem;">
              Anlık UTC gökyüzü koordinatları ile doğum haritanız arasındaki en keskin açı temasları:
            </p>
            ${
              transits.length > 0
                ? `<div class="transit-grid">
                    ${transits
                      .map(
                        (tr) => `
                      <article class="transit-card ${tr.nature}">
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
                          <span class="badge" style="font-family:var(--font-mono); color:#8C5A14; border-color:#DFC79C; background:#F7EFE0;">
                            ${renderBodyGlyph(tr.transitBody.glyph)} ${tr.glyph} ${renderBodyGlyph(tr.natalTarget.glyph)} • Orb: ${tr.orb.toFixed(2)}°
                          </span>
                          <span class="badge">
                            ${tr.isApplying ? 'Yaklaşan (Güçlenen)' : 'Uzaklaşan'} • Yoğunluk %${tr.intensityScore}
                          </span>
                        </div>
                        <h4 style="font-size:0.95rem; font-weight:700; color:var(--text-primary);">
                          ${tr.headline}
                        </h4>
                        <p style="font-size:0.84rem; color:var(--text-secondary);">
                          ${tr.summary}
                        </p>
                        <div class="transit-advice-box">
                          <strong>Aksiyon Önerisi:</strong> ${tr.actionAdvice}
                        </div>
                      </article>
                    `
                      )
                      .join('')}
                  </div>`
                : `<div class="balance-card">
                    Şu anda ±2.0° dar orb içinde tam açı yapan bir transit bulunmuyor. Aşağıdan tüm anlık gökyüzü gezegenlerinin hangi Placidus evinizden geçtiğini inceleyebilirsiniz.
                  </div>`
            }
          </div>
        </details>

        <details class="electional-accordion ephemeris-accordion" id="transit-ephemeris-accordion" style="margin-top:0.85rem;" ${this.isTransitEphemerisAccordionOpen ? 'open' : ''}>
          <summary class="electional-accordion-summary ephemeris-summary">
            <span class="electional-summary-left">${UI_ICONS.planet} <span>Anlık Gökyüzü Ephemeris Konumları ve Haritanızda Geçtikleri Evler (${this.chart.transitPlanets.length} Gök Cismi)</span></span>
            <span class="electional-summary-hint">Listeyi Aç / Kapat ▾</span>
          </summary>
          <div class="electional-accordion-body">
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap:0.75rem;">
              ${this.chart.transitPlanets
                .map(
                  (tp) => `
                  <div class="balance-card" style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                      <div style="font-weight:700; font-size:0.85rem;">${renderBodyGlyph(tp.glyph)} Transit ${tp.name} ${tp.isRetrograde ? '<span style="color:#B84322;">℞</span>' : ''}</div>
                      <div style="font-size:0.75rem; color:var(--text-secondary);">Natal <strong>${tp.house}. Evinizde</strong> ilerlemekte</div>
                    </div>
                    <div style="font-family:var(--font-mono); font-size:0.8rem; color:${ELEMENT_COLORS[tp.sign.element].primary}; text-align:right; font-weight:600;">
                      ${tp.sign.glyph} ${tp.degreeFormatted}<br/>${tp.sign.name}
                    </div>
                  </div>
                `
                )
                .join('')}
            </div>
          </div>
        </details>
      `;

      container.querySelectorAll('[data-live-chip-body]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-live-chip-body') as BodyId | null;
          if (id) {
            const isSame = this.liveSkySelectedBodyId === id;
            this.liveSkySelectedBodyId = isSame ? null : id;
            this.liveSkyCanvas?.setSelectedBody(this.liveSkySelectedBodyId, false);
            this.renderLiveSkyMatcher();
            this.renderTabContent();
          }
        });
      });

      const matchesAcc = document.getElementById(
        'active-transits-matches-accordion'
      ) as HTMLDetailsElement | null;
      matchesAcc?.addEventListener('toggle', () => {
        this.isActiveTransitsMatchesAccordionOpen = matchesAcc.open;
      });

      const ephAcc = document.getElementById('transit-ephemeris-accordion') as HTMLDetailsElement | null;
      ephAcc?.addEventListener('toggle', () => {
        this.isTransitEphemerisAccordionOpen = ephAcc.open;
      });
      return;
    }

    if (this.activeTab === 'personality-synthesis') {
      const planets = this.chart.planets;
      const totalPages = planets.length;
      if (this.personalityPageIndex >= totalPages) {
        this.personalityPageIndex = 0;
      }

      container.innerHTML = `
        <div class="synthesis-pager-header">
          <div>
            <div class="synthesis-pager-title-row">
              <h3 style="font-size:1.12rem; font-weight:700; font-family:var(--font-display);">
                Bütünsel 4 Katmanlı Kişilik Analizi
              </h3>
              <span id="synthesis-page-counter" class="badge" style="color:#27500A; border-color:#C0DD97; background:#EAF3DE; font-family:var(--font-mono);">
                Sayfa ${this.personalityPageIndex + 1} / ${totalPages}
              </span>
            </div>
            <p class="synthesis-pager-hint">
              Sonraki sayfaya geçmek için kartı <strong>sola kaydırın</strong> veya üstteki gezegen sekmelerine dokunun.
            </p>
          </div>

          <div class="synthesis-pager-arrows">
            <button type="button" id="syn-prev-btn" class="btn btn-icon" aria-label="Önceki Sayfa" ${this.personalityPageIndex === 0 ? 'disabled' : ''}>
              ‹ Önceki
            </button>
            <button type="button" id="syn-next-btn" class="btn btn-icon active" aria-label="Sonraki Sayfa" ${this.personalityPageIndex === totalPages - 1 ? 'disabled' : ''}>
              Sonraki ›
            </button>
          </div>
        </div>

        <!-- MANDATORY navigation landmark for scroll-snap-state-sync -->
        <nav class="synthesis-pager-nav" aria-label="Kişilik Analizi Sayfaları">
          <ul class="synthesis-pager-dots">
            ${planets
              .map((p, idx) => {
                const isAct = idx === this.personalityPageIndex;
                return `
                  <li>
                    <button
                      type="button"
                      class="synthesis-dot-btn ${isAct ? 'active' : ''}"
                      data-syn-page="${idx}"
                      ${isAct ? 'aria-current="true"' : ''}
                    >
                      <span class="syn-dot-num">${idx + 1}.</span>
                      ${renderBodyGlyph(p.glyph)}
                      <span>${p.name}</span>
                    </button>
                  </li>
                `;
              })
              .join('')}
          </ul>
        </nav>

        <!-- HORIZONTAL SWIPEABLE SINGLE-PAGE TRACK -->
        <div class="synthesis-pager-track" id="synthesis-pager-track" role="region" aria-roledescription="carousel" aria-label="Kişilik Analizi Sayfaları">
          ${planets
            .map((p, idx) => {
              const syn = this.chart.syntheses[p.id];
              const elColor = ELEMENT_COLORS[p.sign.element].primary;
              const prevPlanet = idx > 0 ? planets[idx - 1] : null;
              const nextPlanet = idx < totalPages - 1 ? planets[idx + 1] : null;
              return `
                <article
                  class="synthesis-slide balance-card"
                  id="synthesis-slide-${idx}"
                  data-syn-slide-idx="${idx}"
                  role="group"
                  aria-roledescription="slide"
                  aria-label="Sayfa ${idx + 1} / ${totalPages}: ${p.name}"
                  style="border-inline-start: 4px solid ${elColor};"
                >
                  <div class="synthesis-slide-top">
                    <div style="display:flex; align-items:center; gap:0.55rem; flex-wrap:wrap;">
                      <span class="synthesis-slide-step-badge">Sayfa ${idx + 1} / ${totalPages}</span>
                      <h4 style="font-size:1.05rem; font-weight:700; color:var(--text-primary); display:inline-flex; align-items:center; gap:0.35rem;">
                        <span style="color:${elColor};">${renderBodyGlyph(p.glyph)}</span>
                        <span>${p.name} — ${p.sign.glyph} ${p.fullFormatted} (${p.house}. Ev)</span>
                      </h4>
                    </div>
                    <span class="badge">${syn.layer2AspectModulation.dominantTone}</span>
                  </div>

                  <div class="synthesis-slide-layers">
                    <div class="synthesis-layer-box">
                      <strong style="color:var(--accent-gold); display:block; margin-bottom:0.25rem;">1. Konum (Burç &amp; Ev):</strong>
                      <div>${formatMarkdownBold(syn.layer1Location.narrative)}</div>
                    </div>
                    <div class="synthesis-layer-box">
                      <strong style="color:var(--accent-blue); display:block; margin-bottom:0.25rem;">2. Açı Modülasyonu:</strong>
                      <div>${formatMarkdownBold(syn.layer2AspectModulation.synthesisText)}</div>
                    </div>
                    <div class="synthesis-layer-box">
                      <strong style="color:var(--accent-emerald); display:block; margin-bottom:0.25rem;">3. Yöneticilik (Dispozitör):</strong>
                      <div>${formatMarkdownBold(syn.layer3Dispositor.chainNarrative)}</div>
                    </div>
                    <div class="synthesis-layer-box">
                      <strong style="color:var(--accent-cyan); display:block; margin-bottom:0.25rem;">4. Günlük Transit Özeti:</strong>
                      <div>${formatMarkdownBold(syn.layer4TransitSummary.bulletinText)}</div>
                    </div>
                  </div>

                  <div class="synthesis-slide-footer">
                    ${
                      prevPlanet
                        ? `<button type="button" class="btn btn-icon" data-syn-goto="${idx - 1}">
                            ← Önceki: ${prevPlanet.name}
                          </button>`
                        : `<span></span>`
                    }
                    <span class="synthesis-swipe-cue">Sola kaydırarak ilerleyin →</span>
                    ${
                      nextPlanet
                        ? `<button type="button" class="btn btn-icon active" data-syn-goto="${idx + 1}">
                            Sonraki: ${nextPlanet.name} →
                          </button>`
                        : `<button type="button" class="btn btn-icon" data-syn-goto="0">
                            ↺ İlk Sayfaya Dön
                          </button>`
                    }
                  </div>
                </article>
              `;
            })
            .join('')}
        </div>
      `;

      const track = document.getElementById('synthesis-pager-track');
      const counterEl = document.getElementById('synthesis-page-counter');
      const prevBtn = document.getElementById('syn-prev-btn') as HTMLButtonElement | null;
      const nextBtn = document.getElementById('syn-next-btn') as HTMLButtonElement | null;
      const slides = Array.from(container.querySelectorAll<HTMLElement>('.synthesis-slide'));
      const dotBtns = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-syn-page]'));

      const syncActivePageUI = (pageIdx: number) => {
        if (pageIdx < 0 || pageIdx >= totalPages) return;
        this.personalityPageIndex = pageIdx;
        if (counterEl) {
          counterEl.textContent = `Sayfa ${pageIdx + 1} / ${totalPages}`;
        }
        if (prevBtn) prevBtn.disabled = pageIdx === 0;
        if (nextBtn) nextBtn.disabled = pageIdx === totalPages - 1;

        dotBtns.forEach((btn, i) => {
          const isAct = i === pageIdx;
          btn.classList.toggle('active', isAct);
          if (isAct) {
            btn.setAttribute('aria-current', 'true');
            btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          } else {
            btn.removeAttribute('aria-current');
          }
        });
      };

      const scrollToPage = (pageIdx: number, smooth = true) => {
        const clamped = Math.max(0, Math.min(totalPages - 1, pageIdx));
        const targetSlide = slides[clamped];
        if (track && targetSlide) {
          track.scrollTo({
            left: targetSlide.offsetLeft - track.offsetLeft,
            behavior: smooth ? 'smooth' : 'instant'
          });
          syncActivePageUI(clamped);
        }
      };

      // Initial scroll alignment if personalityPageIndex > 0
      if (this.personalityPageIndex > 0) {
        requestAnimationFrame(() => {
          scrollToPage(this.personalityPageIndex, false);
        });
      }

      prevBtn?.addEventListener('click', () => {
        scrollToPage(this.personalityPageIndex - 1);
      });
      nextBtn?.addEventListener('click', () => {
        scrollToPage(this.personalityPageIndex + 1);
      });

      dotBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const targetIdx = Number(btn.getAttribute('data-syn-page') || 0);
          scrollToPage(targetIdx);
        });
      });

      container.querySelectorAll<HTMLElement>('[data-syn-goto]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const targetIdx = Number(btn.getAttribute('data-syn-goto') || 0);
          scrollToPage(targetIdx);
        });
      });

      // Scroll Snap State Sync (modern-web-guidance: scroll-snap-state-sync)
      if (track) {
        if ('onscrollsnapchange' in HTMLElement.prototype) {
          track.addEventListener('scrollsnapchange', (event: Event) => {
            const snapEvent = event as Event & { snapTargetInline?: HTMLElement | null };
            const snappedSlide = snapEvent.snapTargetInline;
            if (snappedSlide) {
              const idxAttr = snappedSlide.getAttribute('data-syn-slide-idx');
              if (idxAttr !== null) {
                syncActivePageUI(Number(idxAttr));
              }
            }
          });
        } else {
          // Fallback for Safari/iOS and Firefox using IntersectionObserver
          const observer = new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
                  const idxAttr = entry.target.getAttribute('data-syn-slide-idx');
                  if (idxAttr !== null) {
                    syncActivePageUI(Number(idxAttr));
                  }
                }
              }
            },
            { root: track, threshold: 0.6 }
          );
          slides.forEach((slide) => observer.observe(slide));
        }
      }
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
            <span style="display:inline-flex; align-items:center; gap:0.35rem;">${UI_ICONS.pin} <span><strong>${loc.name}</strong> <small style="color:var(--text-secondary);">(${loc.country})</small></span></span>
            <span style="font-family:var(--font-mono); font-size:0.72rem; color:var(--accent-gold); font-weight:600;">
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
            <h2 id="auth-modal-title" style="font-size:1.1rem; font-weight:700; display:flex; align-items:center; gap:0.45rem;">${UI_ICONS.user} <span>Hesabım (${user.fullName})</span></h2>
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
              <div style="font-size:1.05rem; font-weight:700; color:var(--text-primary);">${user.fullName}</div>
              <div style="font-size:0.8rem; color:#27500A; font-family:var(--font-mono); font-weight:600;">${user.email}</div>
            </div>
            <span class="badge badge-dignity">Kayıt: ${createdDateStr}</span>
          </div>

          <div style="font-size:0.8rem; color:var(--text-secondary); border-block-start:1px solid var(--border-subtle); padding-block-start:0.55rem;">
            <strong>Ana Doğum Haritası:</strong> ${user.primaryChart.fullName} —
            ${user.primaryChart.birthDate} • ${user.primaryChart.birthTime} •
            ${user.primaryChart.location.name} (${user.primaryChart.location.timezone})
          </div>
        </div>

        <div style="background:var(--bg-elevated); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:0.85rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.4rem; margin-bottom:0.55rem;">
            <span style="font-size:0.8rem; font-weight:700; color:#8C5A14; display:inline-flex; align-items:center; gap:0.35rem;">
              ${UI_ICONS.planet} <span>Hesabıma Kayıtlı Haritalar (${user.savedCharts.length})</span>
            </span>
            <button type="button" id="account-edit-birth-btn" class="btn btn-icon" style="color:var(--accent-emerald);">
              ${UI_ICONS.settings} <span>Harita Bilgilerini Düzenle</span>
            </button>
          </div>
          <div style="display:flex; flex-direction:column; gap:0.4rem;">
            ${user.savedCharts
              .map(
                (chart, idx) => `
              <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; padding:0.45rem 0.65rem; background:var(--bg-card); border:1px solid var(--border-subtle); border-radius:8px;">
                <div style="font-size:0.8rem; color:var(--text-primary);">
                  <strong>${chart.fullName}</strong>
                  <span style="color:var(--text-secondary); font-size:0.75rem; margin-inline-start:0.35rem;">
                    ${chart.birthDate} ${chart.birthTime} • ${chart.location.name}
                  </span>
                </div>
                <button type="button" class="btn btn-icon account-load-chart-btn" data-chart-idx="${idx}" style="color:#27500A; border-color:#C0DD97; background:#EAF3DE;">
                  Haritayı Aç
                </button>
              </div>
            `
              )
              .join('')}
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.6rem; margin-top:0.25rem;">
          <button type="button" id="signout-account-btn" class="btn" style="color:#9C3A1C; border-color:#E5C4B0; background:#F9EBE5;">
            ${UI_ICONS.logout} <span>Hesaptan Çıkış Yap</span>
          </button>
          <button type="button" id="done-auth-modal-btn" class="btn btn-primary">${UI_ICONS.planet} <span>Doğum Haritasına Geç</span></button>
        </div>
      `;

      this.bindAuthModalInnerEvents();
      return;
    }

    // 2. GUEST VIEW: SIGN IN / SIGN UP / PASSWORD RESET
    const isSignIn = this.authViewMode === 'signin';
    const isSignUp = this.authViewMode === 'signup';
    const isReset = this.authViewMode === 'reset';
    const passInputType = this.isPasswordVisible ? 'text' : 'password';
    const passToggleLabel = this.isPasswordVisible ? 'Gizle' : 'Göster';

    inner.innerHTML = `
      <div class="dialog-header">
        <div>
          <h2 id="auth-modal-title" style="font-size:1.1rem; font-weight:700; display:flex; align-items:center; gap:0.45rem;">
            ${
              isSignUp
                ? `${UI_ICONS.user} <span>Hesabım — Yeni Hesap Oluştur</span>`
                : isReset
                  ? `${UI_ICONS.lock} <span>Hesabım — Şifremi Unuttum / Sıfırla</span>`
                  : `${UI_ICONS.key} <span>Hesabım — Giriş Yap / Kayıt Ol</span>`
            }
          </h2>
          <p style="font-size:0.77rem; color:var(--text-secondary);">
            Doğum haritanızı ve kişisel transit tercihlerinizi hesabınızla kalıcı olarak eşleştirin
          </p>
        </div>
      </div>

      <div class="auth-mode-tabs" role="tablist" aria-label="Giriş, Kayıt veya Şifre Sıfırlama Seçimi">
        <button type="button" role="tab" class="auth-tab-btn ${isSignIn ? 'active' : ''}" data-auth-mode="signin" aria-selected="${isSignIn}">
          ${UI_ICONS.key} <span>Giriş Yap</span>
        </button>
        <button type="button" role="tab" class="auth-tab-btn ${isSignUp ? 'active' : ''}" data-auth-mode="signup" aria-selected="${isSignUp}">
          ${UI_ICONS.user} <span>Kayıt Ol</span>
        </button>
        <button type="button" role="tab" class="auth-tab-btn ${isReset ? 'active' : ''}" data-auth-mode="reset" aria-selected="${isReset}">
          ${UI_ICONS.lock} <span>Şifremi Unuttum</span>
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
                value="${this.authDraftEmail}"
                autocomplete="username"
                spellcheck="false"
                enterkeyhint="next"
                placeholder="ornek@eposta.com"
                required
                aria-describedby="signin-email-hint"
                aria-errormessage="signin-email-error"
              />
              <div id="signin-email-error" class="error-msg">
                ${UI_ICONS.alert} <span>Lütfen geçerli bir e-posta adresi giriniz.</span>
              </div>
            </div>

            <div class="field full-span">
              <label for="current-password">Şifre</label>
              <span id="signin-pass-hint" class="hint">Hesap şifrenizi giriniz</span>
              <div class="password-input-wrap">
                <input
                  type="${passInputType}"
                  id="current-password"
                  name="current-password"
                  class="auth-password-input"
                  autocomplete="current-password"
                  enterkeyhint="done"
                  placeholder="••••••••"
                  required
                  aria-describedby="signin-pass-hint"
                  aria-errormessage="signin-pass-error"
                />
                <button type="button" class="password-toggle-btn" data-toggle-pass="current-password" aria-label="Şifreyi göster veya gizle" aria-pressed="${this.isPasswordVisible}">
                  ${passToggleLabel}
                </button>
              </div>
              <div id="signin-pass-error" class="error-msg">
                ${UI_ICONS.alert} <span>Lütfen şifrenizi giriniz.</span>
              </div>

              <div class="password-options-row">
                <label class="show-pass-checkbox-label" for="signin-show-pass-check">
                  <input
                    type="checkbox"
                    id="signin-show-pass-check"
                    class="show-pass-checkbox"
                    data-toggle-pass-check="current-password"
                    ${this.isPasswordVisible ? 'checked' : ''}
                  />
                  <span>Şifreyi göster</span>
                </label>

                <button type="button" class="forgot-pass-link-btn" data-auth-mode="reset">
                  ${UI_ICONS.lock} <span>Şifremi Unuttum</span>
                </button>
              </div>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-top:0.95rem;">
            <button type="button" class="btn btn-icon" data-auth-mode="signup" style="font-size:0.76rem;">
              ${UI_ICONS.user} <span>Hesabınız yok mu? Kayıt Olun</span>
            </button>
            <button type="submit" class="btn btn-primary">${UI_ICONS.key} <span>Giriş Yap</span></button>
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
                ${UI_ICONS.alert} <span>Lütfen adınızı ve soyadınızı giriniz.</span>
              </div>
            </div>

            <div class="field full-span">
              <label for="signup-email">E-posta Adresi</label>
              <span id="signup-email-hint" class="hint">Giriş yaparken kullanacağınız e-posta adresiniz</span>
              <input
                type="email"
                id="signup-email"
                name="email"
                value="${this.authDraftEmail}"
                autocomplete="username"
                spellcheck="false"
                enterkeyhint="next"
                placeholder="ornek@eposta.com"
                required
                aria-describedby="signup-email-hint"
                aria-errormessage="signup-email-error"
              />
              <div id="signup-email-error" class="error-msg">
                ${UI_ICONS.alert} <span>Lütfen geçerli bir e-posta adresi giriniz.</span>
              </div>
            </div>

            <div class="field full-span">
              <label for="new-password">Şifre Oluştur</label>
              <span id="signup-pass-hint" class="hint">En az 6 karakter uzunluğunda bir şifre belirleyin</span>
              <div class="password-input-wrap">
                <input
                  type="${passInputType}"
                  id="new-password"
                  name="new-password"
                  class="auth-password-input"
                  autocomplete="new-password"
                  minlength="6"
                  enterkeyhint="next"
                  placeholder="En az 6 karakter"
                  required
                  aria-describedby="signup-pass-hint"
                  aria-errormessage="signup-pass-error"
                />
                <button type="button" class="password-toggle-btn" data-toggle-pass="new-password" aria-label="Şifreyi göster veya gizle" aria-pressed="${this.isPasswordVisible}">
                  ${passToggleLabel}
                </button>
              </div>
              <div id="signup-pass-error" class="error-msg">
                ${UI_ICONS.alert} <span>Şifreniz en az 6 karakter olmalıdır.</span>
              </div>

              <div class="password-options-row">
                <label class="show-pass-checkbox-label" for="signup-show-pass-check">
                  <input
                    type="checkbox"
                    id="signup-show-pass-check"
                    class="show-pass-checkbox"
                    data-toggle-pass-check="new-password"
                    ${this.isPasswordVisible ? 'checked' : ''}
                  />
                  <span>Şifreyi göster</span>
                </label>

                <button type="button" class="forgot-pass-link-btn" data-auth-mode="reset">
                  ${UI_ICONS.lock} <span>Şifremi Unuttum</span>
                </button>
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
              <div id="signup-location-readout" style="margin-top:0.25rem; font-family:var(--font-mono); font-size:0.74rem; color:#27500A;">
                Seçili Konum: <strong>${this.selectedModalLocation.name} (${this.selectedModalLocation.country})</strong> •
                IANA: ${this.selectedModalLocation.timezone}
              </div>
              <ul class="location-results-list" id="signup-location-results-ul" role="listbox" aria-label="Kayıt Doğum Yeri Sonuçları" style="max-block-size:125px;"></ul>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.6rem; margin-top:1rem;">
            <span style="font-size:0.74rem; color:#27500A; display:inline-flex; align-items:center; gap:0.35rem;">
              ${UI_ICONS.lock} <span>Hesabınız ve haritanız 5 katmanlı kalıcı hafızaya kaydedilir.</span>
            </span>
            <button type="submit" class="btn btn-primary">${UI_ICONS.check} <span>Hesap Oluştur ve Kayıt Ol</span></button>
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
              <span id="reset-email-hint" class="hint">Şifresini sıfırlamak istediğiniz e-posta adresinizi giriniz</span>
              <input
                type="email"
                id="reset-email"
                name="email"
                value="${this.authDraftEmail}"
                autocomplete="username"
                spellcheck="false"
                enterkeyhint="next"
                placeholder="ornek@eposta.com"
                required
                aria-describedby="reset-email-hint"
                aria-errormessage="reset-email-error"
              />
              <div id="reset-email-error" class="error-msg">
                ${UI_ICONS.alert} <span>Lütfen geçerli bir e-posta adresi giriniz.</span>
              </div>
            </div>

            <div class="field full-span">
              <label for="reset-new-password">Yeni Şifreniz (En az 6 karakter)</label>
              <span id="reset-pass-hint" class="hint">Hesabınız için yeni bir şifre belirleyin</span>
              <div class="password-input-wrap">
                <input
                  type="${passInputType}"
                  id="reset-new-password"
                  name="new-password"
                  class="auth-password-input"
                  autocomplete="new-password"
                  minlength="6"
                  placeholder="En az 6 karakter"
                  enterkeyhint="next"
                  required
                  aria-describedby="reset-pass-hint"
                  aria-errormessage="reset-pass-error"
                />
                <button type="button" class="password-toggle-btn" data-toggle-pass="reset-new-password" aria-label="Şifreyi göster veya gizle" aria-pressed="${this.isPasswordVisible}">
                  ${passToggleLabel}
                </button>
              </div>
              <div id="reset-pass-error" class="error-msg">
                ${UI_ICONS.alert} <span>Yeni şifreniz en az 6 karakter olmalıdır.</span>
              </div>
            </div>

            <div class="field full-span">
              <label for="reset-confirm-password">Yeni Şifreniz (Tekrar)</label>
              <span id="reset-confirm-hint" class="hint">Yeni şifrenizi doğrulamak için tekrar yazınız</span>
              <div class="password-input-wrap">
                <input
                  type="${passInputType}"
                  id="reset-confirm-password"
                  name="confirm-password"
                  class="auth-password-input"
                  autocomplete="new-password"
                  minlength="6"
                  placeholder="Yeni şifrenizi tekrar giriniz"
                  enterkeyhint="done"
                  required
                  aria-describedby="reset-confirm-hint"
                />
                <button type="button" class="password-toggle-btn" data-toggle-pass="reset-confirm-password" aria-label="Şifreyi göster veya gizle" aria-pressed="${this.isPasswordVisible}">
                  ${passToggleLabel}
                </button>
              </div>

              <div class="password-options-row">
                <label class="show-pass-checkbox-label" for="reset-show-pass-check">
                  <input
                    type="checkbox"
                    id="reset-show-pass-check"
                    class="show-pass-checkbox"
                    data-toggle-pass-check="reset-new-password"
                    ${this.isPasswordVisible ? 'checked' : ''}
                  />
                  <span>Şifreyi göster</span>
                </label>
              </div>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-top:0.95rem;">
            <button type="button" class="btn btn-icon" data-auth-mode="signin">← Giriş Ekranına Dön</button>
            <button type="submit" class="btn btn-primary">${UI_ICONS.lock} <span>Şifremi Güncelle ve Giriş Yap</span></button>
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
            <span style="display:inline-flex; align-items:center; gap:0.35rem;">${UI_ICONS.pin} <span><strong>${loc.name}</strong> <small style="color:var(--text-secondary);">(${loc.country})</small></span></span>
            <span style="font-family:var(--font-mono); font-size:0.72rem; color:var(--accent-gold); font-weight:600;">
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

    // Keep draft email synced as user types in any email field
    ['signin-email', 'signup-email', 'reset-email'].forEach((id) => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      el?.addEventListener('input', () => {
        this.authDraftEmail = el.value.trim();
      });
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

    const syncPasswordVisibilityDOM = (visible: boolean) => {
      this.isPasswordVisible = visible;
      document.querySelectorAll<HTMLInputElement>('.auth-password-input').forEach((inp) => {
        inp.type = visible ? 'text' : 'password';
      });
      document.querySelectorAll<HTMLElement>('[data-toggle-pass]').forEach((btn) => {
        btn.textContent = visible ? 'Gizle' : 'Göster';
        btn.setAttribute('aria-pressed', String(visible));
      });
      document.querySelectorAll<HTMLInputElement>('.show-pass-checkbox').forEach((chk) => {
        chk.checked = visible;
      });
    };

    // Show / Hide password inline buttons
    document.querySelectorAll('[data-toggle-pass]').forEach((btn) => {
      btn.addEventListener('click', () => {
        syncPasswordVisibilityDOM(!this.isPasswordVisible);
      });
    });

    // Show / Hide password checkboxes ("Şifreyi göster" kutucuğu)
    document.querySelectorAll<HTMLInputElement>('.show-pass-checkbox').forEach((chk) => {
      chk.addEventListener('change', () => {
        syncPasswordVisibilityDOM(chk.checked);
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
      const email = (document.getElementById('signin-email') as HTMLInputElement)?.value.trim() || '';
      const password = (document.getElementById('current-password') as HTMLInputElement)?.value || '';
      this.authDraftEmail = email;

      if (!email || !email.includes('@')) {
        this.authFeedback = { type: 'error', message: 'Lütfen geçerli bir e-posta adresi giriniz.' };
        this.renderAuthModalContent();
        document.getElementById('signin-email')?.focus();
        return;
      }
      if (!password) {
        this.authFeedback = { type: 'error', message: 'Lütfen hesap şifrenizi giriniz.' };
        this.renderAuthModalContent();
        document.getElementById('current-password')?.focus();
        return;
      }

      const res = await signInUserAccount({
        email,
        password,
        existingState: this.authState
      });

      this.authState = res.state;
      if (!res.ok) {
        this.authFeedback = { type: 'error', message: res.error || 'Giriş yapılamadı.' };
        this.renderAuthModalContent();
        return;
      }

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
      const fullName = (document.getElementById('signup-name') as HTMLInputElement)?.value.trim() || '';
      const email = (document.getElementById('signup-email') as HTMLInputElement)?.value.trim() || '';
      const password = (document.getElementById('new-password') as HTMLInputElement)?.value || '';
      const birthDate = (document.getElementById('signup-birthdate') as HTMLInputElement)?.value || this.birthInput.birthDate;
      const birthTime = (document.getElementById('signup-birthtime') as HTMLInputElement)?.value || this.birthInput.birthTime;
      this.authDraftEmail = email;

      if (!fullName) {
        this.authFeedback = { type: 'error', message: 'Lütfen adınızı ve soyadınızı giriniz.' };
        this.renderAuthModalContent();
        document.getElementById('signup-name')?.focus();
        return;
      }
      if (!email || !email.includes('@')) {
        this.authFeedback = { type: 'error', message: 'Lütfen geçerli bir e-posta adresi giriniz.' };
        this.renderAuthModalContent();
        document.getElementById('signup-email')?.focus();
        return;
      }
      if (!password || password.length < 6) {
        this.authFeedback = { type: 'error', message: 'Şifreniz en az 6 karakter uzunluğunda olmalıdır.' };
        this.renderAuthModalContent();
        document.getElementById('new-password')?.focus();
        return;
      }

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
      const email = (document.getElementById('reset-email') as HTMLInputElement)?.value.trim() || '';
      const newPassword = (document.getElementById('reset-new-password') as HTMLInputElement)?.value || '';
      const confirmPassword = (document.getElementById('reset-confirm-password') as HTMLInputElement)?.value || '';
      this.authDraftEmail = email;

      if (!email || !email.includes('@')) {
        this.authFeedback = { type: 'error', message: 'Lütfen kayıtlı e-posta adresinizi giriniz.' };
        this.renderAuthModalContent();
        document.getElementById('reset-email')?.focus();
        return;
      }
      if (!newPassword || newPassword.length < 6) {
        this.authFeedback = { type: 'error', message: 'Yeni şifreniz en az 6 karakter olmalıdır.' };
        this.renderAuthModalContent();
        document.getElementById('reset-new-password')?.focus();
        return;
      }
      if (newPassword !== confirmPassword) {
        this.authFeedback = { type: 'error', message: 'Girdiğiniz yeni şifreler birbiriyle eşleşmiyor.' };
        this.renderAuthModalContent();
        document.getElementById('reset-confirm-password')?.focus();
        return;
      }

      const res = await resetUserPassword({
        email,
        newPassword,
        fallbackChart: this.birthInput,
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
        await this.saveProfile(this.birthInput);
      }
      this.authFeedback = {
        type: 'success',
        message: 'Şifreniz başarıyla güncellendi ve hesabınıza giriş yapıldı.'
      };
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
    // 1. Main View Navigation (Bottom Menu: Canlı Gökyüzü | Doğum Haritası | Kozmik Takvim + Header: Profil Sayfası)
    document.querySelectorAll('.bottom-nav-item[data-bottom-nav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetView = btn.getAttribute('data-bottom-nav') as MainViewMode | null;
        if (targetView && this.activeMainView !== targetView) {
          this.activeMainView = targetView;
          this.renderShell();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (targetView) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });

    document.getElementById('nav-chart-view-btn')?.addEventListener('click', () => {
      if (this.activeMainView !== 'chart') {
        this.activeMainView = 'chart';
        this.renderShell();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    document.getElementById('back-to-chart-btn')?.addEventListener('click', () => {
      this.activeMainView = 'chart';
      this.renderShell();
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
        if (btnEl) btnEl.innerHTML = `${UI_ICONS.check} <span>Kişisel Bağlantı Kopyalandı!</span>`;
      } catch {
        if (btnEl) btnEl.innerHTML = `${UI_ICONS.link} <span>Adres Çubuğundaki URL Hazır</span>`;
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

    const natalPlanetsAcc = document.getElementById(
      'natal-planets-accordion'
    ) as HTMLDetailsElement | null;
    natalPlanetsAcc?.addEventListener('toggle', () => {
      this.isNatalPlanetsAccordionOpen = natalPlanetsAcc.open;
    });

    const liveSkyPlanetsAcc = document.getElementById(
      'live-sky-planets-accordion'
    ) as HTMLDetailsElement | null;
    liveSkyPlanetsAcc?.addEventListener('toggle', () => {
      this.isLiveSkyPlanetsAccordionOpen = liveSkyPlanetsAcc.open;
    });

    document.getElementById('refresh-transit-btn')?.addEventListener('click', () => {
      this.isPreviewingFutureDate = false;
      this.recalculateChart(new Date());
      this.renderShell();
    });

    document.getElementById('brand-replay-intro-btn')?.addEventListener('click', () => {
      this.replayIntroVideo();
    });

    // 7. Top Tab Switching (Toggle open/close on click)
    document.querySelectorAll('.tab-btn[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab') as Exclude<ActiveTab, null>;
        if (targetTab) {
          this.activeTab = this.activeTab === targetTab ? null : targetTab;
          document.querySelectorAll('.tab-btn[data-tab]').forEach((b) => {
            const isAct = b.getAttribute('data-tab') === this.activeTab;
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
