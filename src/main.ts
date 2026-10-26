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
  CosmicNotificationsBundle,
  ELECTIONAL_CATEGORIES,
  ElectionalCategoryId,
  ElectionalForecastResult,
  FullMoonNatalReport,
  evaluateFullMoonAnalysis,
  evaluateThirtyDayElectionalForecast,
  generateCosmicNotifications
} from './engine/electional';
import { ELEMENT_COLORS, NatalWheelCanvas } from './components/NatalWheelCanvas';
import { LiveSkyWheelCanvas } from './components/LiveSkyWheelCanvas';
import {
  StoredProfilePayload,
  loadProfileSync,
  recoverProfileAsync,
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

const VENUS_SVG = `<span class="astro-body-glyph" aria-hidden="true"><svg class="astro-glyph-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8.5" r="4.8"/><line x1="12" y1="13.3" x2="12" y2="20.5"/><line x1="8.5" y1="17" x2="15.5" y2="17"/></svg></span>`;
const MARS_SVG = `<span class="astro-body-glyph" aria-hidden="true"><svg class="astro-glyph-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9.8" cy="14.2" r="4.8"/><line x1="13.2" y1="10.8" x2="19.2" y2="4.8"/><polyline points="14.2 4.8 19.2 4.8 19.2 9.8"/></svg></span>`;

const UI_ICONS = {
  natalWheel: `<svg class="ui-min-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="4.8"/><line x1="12" y1="2.5" x2="12" y2="7.2"/><line x1="12" y1="16.8" x2="12" y2="21.5"/><line x1="2.5" y1="12" x2="7.2" y2="12"/><line x1="16.8" y1="12" x2="21.5" y2="12"/><line x1="5.28" y1="5.28" x2="8.6" y2="8.6"/><line x1="15.4" y1="15.4" x2="18.72" y2="18.72"/><line x1="18.72" y1="5.28" x2="15.4" y2="8.6"/><line x1="8.6" y1="15.4" x2="5.28" y2="18.72"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/></svg>`,
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
  bookmark: `<svg class="ui-min-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
  book: `<svg class="ui-min-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
  bell: `<svg class="ui-min-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  fullMoon: `<svg class="full-moon-svg" viewBox="0 0 28 28" fill="none" aria-hidden="true"><circle cx="14" cy="14" r="11.5" fill="url(#zenithFullMoonGrad)" stroke="#9A6B22" stroke-width="1.5"/><circle cx="10.2" cy="10.5" r="2.1" fill="#D5B87A" opacity="0.55"/><circle cx="17.4" cy="12.8" r="2.8" fill="#D5B87A" opacity="0.45"/><circle cx="13.2" cy="17.8" r="1.7" fill="#D5B87A" opacity="0.5"/><defs><radialGradient id="zenithFullMoonGrad" cx="35%" cy="30%" r="70%"><stop offset="0%" stop-color="#FFFDF7"/><stop offset="55%" stop-color="#F7E5B4"/><stop offset="100%" stop-color="#D9AE5F"/></radialGradient></defs></svg>`,
  rotateLeft: `<svg class="wheel-ctrl-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><polyline points="3 3 3 8 8 8"/></svg>`,
  rotateRight: `<svg class="wheel-ctrl-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><polyline points="21 3 21 8 16 8"/></svg>`,
  resetView: `<svg class="wheel-ctrl-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><polyline points="21 3 21 8 16 8"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><polyline points="3 21 3 16 8 16"/></svg>`,
  zoomIn: `<svg class="wheel-ctrl-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  zoomOut: `<svg class="wheel-ctrl-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  mail: `<svg class="ui-min-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`
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
  private electionalMonthOffset = 0;
  private electionalResult!: ElectionalForecastResult;
  private notificationsBundle!: CosmicNotificationsBundle;
  private fullMoonReport!: FullMoonNatalReport;
  private activeNotificationTab: 'daily' | 'weekly' = 'daily';
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

  private getElectionalBaseDate(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + this.electionalMonthOffset, 15, 12, 0, 0);
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
      this.getElectionalBaseDate()
    );
    this.notificationsBundle = generateCosmicNotifications(this.chart);
    this.fullMoonReport = evaluateFullMoonAnalysis(this.chart, transitDate);
    if (
      !this.selectedElectionalDayIso ||
      !this.electionalResult.allDays.some((d) => d.dateIso === this.selectedElectionalDayIso)
    ) {
      this.selectedElectionalDayIso =
        this.electionalResult.topOptimalDays[0]?.dateIso ||
        this.electionalResult.allDays[0].dateIso;
    }
  }

  private isNotificationsUnread(): boolean {
    try {
      const seenDate = window.localStorage.getItem('zenith_notif_seen_date');
      return seenDate !== this.notificationsBundle.unreadKey;
    } catch {
      return false;
    }
  }

  private markNotificationsSeen(): void {
    try {
      window.localStorage.setItem(
        'zenith_notif_seen_date',
        this.notificationsBundle.unreadKey
      );
    } catch {
      // Ignore storage error
    }
    const badgeEl = document.getElementById('header-notif-badge');
    const bellBtn = document.getElementById('open-notifications-btn');
    badgeEl?.classList.remove('unread');
    bellBtn?.classList.remove('has-unread');
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
                  (k.startsWith('zenith-pwa-') && k !== 'zenith-pwa-v4.8.5')
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
            <img src="/zenith/zenith-logo-v3.png" onerror="this.onerror=null;this.src='./zenith-logo-v3.png';" alt="Zenith Logo" class="brand-logo" width="40" height="40" />
            <div>
              <div class="brand-title">ZENITH</div>
              <div class="brand-subtitle">İnteraktif Natal &amp; Transit Astroloji Motoru</div>
            </div>
          </div>

          <nav class="header-actions" aria-label="Profil ve Uygulama Kullanma Rehberi">
            <button
              type="button"
              id="nav-profile-view-btn"
              class="btn header-action-btn ${isProfileView ? 'btn-primary' : this.authState.currentUser ? 'btn-account' : ''}"
              aria-current="${isProfileView ? 'page' : 'false'}"
            >
              ${UI_ICONS.user}
              <span>Profil</span>
            </button>

            <button
              type="button"
              id="open-app-guide-btn"
              class="btn header-action-btn btn-guide"
              aria-haspopup="dialog"
            >
              ${UI_ICONS.book}
              <span>Kullanım Rehberi</span>
            </button>
          </nav>

          <button
            type="button"
            id="open-notifications-btn"
            class="btn btn-icon btn-notification-bell ${this.isNotificationsUnread() ? 'has-unread' : ''}"
            aria-label="Günlük ve Haftalık Kozmik Bildirimler (${this.notificationsBundle.totalCount})"
            aria-haspopup="dialog"
            title="Günlük ve Haftalık Kozmik Bildirimler"
          >
            ${UI_ICONS.bell}
            <span id="header-notif-badge" class="notif-count-badge ${this.isNotificationsUnread() ? 'unread' : ''}">
              ${this.notificationsBundle.totalCount}
            </span>
          </button>
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

          ${this.renderConditionalRoyalStarsSection()}

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
                  <button type="button" id="rotate-left-btn" class="btn btn-icon btn-wheel-ctrl" aria-label="Sola Döndür" title="Sola Döndür">${UI_ICONS.rotateLeft}</button>
                  <button type="button" id="rotate-right-btn" class="btn btn-icon btn-wheel-ctrl" aria-label="Sağa Döndür" title="Sağa Döndür">${UI_ICONS.rotateRight}</button>
                  <button type="button" id="zoom-in-btn" class="btn btn-icon btn-wheel-ctrl" aria-label="Yakınlaştır" title="Yakınlaştır">${UI_ICONS.zoomIn}</button>
                  <button type="button" id="zoom-out-btn" class="btn btn-icon btn-wheel-ctrl" aria-label="Uzaklaştır" title="Uzaklaştır">${UI_ICONS.zoomOut}</button>
                  <button type="button" id="reset-wheel-btn" class="btn btn-icon btn-wheel-ctrl" aria-label="Görünümü Sıfırla" title="Görünümü Sıfırla">${UI_ICONS.resetView}</button>
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
                  <h2 class="live-sky-title">${UI_ICONS.compass} <span>Canlı Gökyüzü Eşleştirici (Göksel Harita)</span></h2>
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
                <button type="button" id="live-sky-rot-left-btn" class="btn btn-icon btn-wheel-ctrl" aria-label="Göksel Haritayı Sola Döndür" title="Sola Döndür">${UI_ICONS.rotateLeft}</button>
                <button type="button" id="live-sky-rot-right-btn" class="btn btn-icon btn-wheel-ctrl" aria-label="Göksel Haritayı Sağa Döndür" title="Sağa Döndür">${UI_ICONS.rotateRight}</button>
                <button type="button" id="live-sky-reset-btn" class="btn btn-icon btn-wheel-ctrl" aria-label="Göksel Harita Yönünü Sıfırla" title="Sıfırla">${UI_ICONS.resetView}</button>
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

                <!-- ANLIK GÖKYÜZÜ TRANSİT YAZISININ ALTINDA YANIP SÖNEN KOMPAKT TIKLANABİLİR DOLUNAY ROZETİ -->
                <div class="full-moon-beacon-row">
                  <button
                    type="button"
                    id="open-full-moon-modal-btn"
                    class="full-moon-beacon-btn ${this.fullMoonReport.isCurrentlyActiveWindow ? 'active-window' : ''}"
                    aria-haspopup="dialog"
                    aria-label="Dolunay Zamanı ve Doğum Haritanızla İlişkisini Anlatan Zenith Mesajını Aç"
                  >
                    <span class="full-moon-pulsing-symbol" aria-hidden="true">
                      ${UI_ICONS.fullMoon}
                    </span>
                    <span class="full-moon-beacon-compact-label">
                      <strong>Dolunay:</strong> ${this.fullMoonReport.shortDateFormatted} • ${this.fullMoonReport.fullMoonSignGlyph} ${this.fullMoonReport.fullMoonSignName} (${this.fullMoonReport.fullMoonNatalHouse}. Ev)
                    </span>
                    <span class="full-moon-beacon-cta">Mesajı ›</span>
                  </button>
                </div>

                <div class="live-sky-canvas-stage">
                  <canvas id="live-sky-wheel-canvas" aria-label="Canlı Gökyüzü Eşleştirici Göksel Temsili Harita Çarkı"></canvas>
                </div>

                <p class="live-sky-wheel-caption">
                  Çark üzerindeki <strong>dış göksel madalyonlar</strong> gezegenlerin şu anki gerçek zamanlı Zodyak konumlarını, <strong>iç halka</strong> ise doğum haritanızla olan rezonans ışınlarını gösterir.
                </p>
              </div>

              <!-- 2. AKTİF ±2.0° EŞLEŞMELER TABLOSU (ANLIK GÖKYÜZÜ HARİTASININ ALTINDA) & GEZEGEN DİZİLİMİ -->
              <div class="live-sky-inspector-col">
                <div id="live-sky-selected-detail" class="live-sky-detail-card" aria-live="polite"></div>

                <div id="live-sky-active-chips" class="live-sky-active-chips"></div>

                <details id="live-sky-planets-accordion" class="electional-accordion ephemeris-accordion" ${this.isLiveSkyPlanetsAccordionOpen ? 'open' : ''}>
                  <summary class="electional-accordion-summary ephemeris-summary">
                    <span class="electional-summary-left">${UI_ICONS.planet} <span>Anlık Gökyüzü Gezegen Dizilimi (11 Gök Cismi)</span></span>
                    <span class="electional-summary-hint">Tabloyu Aç / Kapat ▾</span>
                  </summary>
                  <div class="electional-accordion-body">
                    <div id="live-sky-planet-grid" class="live-sky-planet-grid" role="toolbar" aria-label="Canlı Gökyüzü Gezegen Seçici"></div>
                  </div>
                </details>
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
          <!-- PROFİL SAYFASI: HESABIM VE İLETİŞİM -->
          <main class="profile-page-view" aria-label="Profil Sayfası: Hesabım ve İletişim">
            <!-- AKTİF PROFİL ÖZET BARI -->
            <section class="profile-page-banner" aria-label="Aktif Doğum Haritası Özeti">
              <div class="profile-summary-info">
                <span class="profile-meta-chip">${input.birthDate} • ${input.birthTime}</span>
                <span class="profile-meta-chip">${UI_ICONS.pin} <span>${input.location.name} (${input.location.latitude.toFixed(2)}°K, ${input.location.longitude.toFixed(2)}°D)</span></span>
                <span class="profile-tz-chip">${input.location.timezone} (${utcOffsetFormatted})</span>
                ${
                  this.authState.currentUser
                    ? `<span class="profile-tz-chip" style="color:#27500A; border-color:#C0DD97; background:#EAF3DE;">${UI_ICONS.check} <span>Hesap: ${this.authState.currentUser.email}</span></span>`
                    : `<span class="profile-tz-chip" style="color:#27500A; border-color:#C0DD97; background:#EAF3DE;">${UI_ICONS.check} <span>Cihazda Kalıcı Kayıtlı</span></span>`
                }
              </div>
              ${
                isStandaloneOrNative
                  ? ''
                  : `<div class="profile-banner-actions">
                      <button type="button" id="pwa-install-btn" class="btn btn-pwa">
                        ${UI_ICONS.download} <span>Ana Ekrana Ekle</span>
                      </button>
                    </div>`
              }
            </section>

            <!-- 1. HESABIM PANELİ -->
            <div class="profile-sections-grid single-col">
              <section class="profile-section-card" id="auth-modal-inner" aria-label="Hesabım ve Giriş/Kayıt Paneli"></section>
            </div>

            <!-- 2. İLETİŞİM & DESTEK KUTUCUĞU (hi@usecomus.com) -->
            <section class="profile-section-card contact-support-card" id="contact-support-card" aria-labelledby="contact-card-title">
              <div class="dialog-header">
                <div>
                  <h2 id="contact-card-title" style="font-size:1.1rem; font-weight:700; display:flex; align-items:center; gap:0.45rem;">
                    ${UI_ICONS.mail} <span>İletişim &amp; Destek</span>
                  </h2>
                  <p style="font-size:0.78rem; color:var(--text-secondary);">
                    Soru, öneri, geri bildirim veya hesap talepleriniz için doğrudan <strong>hi@usecomus.com</strong> adresine e-posta gönderebilirsiniz.
                  </p>
                </div>
                <div style="display:flex; align-items:center; flex-wrap:wrap; gap:0.45rem;">
                  <a href="mailto:hi@usecomus.com" class="badge" style="text-decoration:none; color:#6B440A; background:#F6EBCD; font-family:var(--font-mono); font-size:0.76rem; padding:0.28rem 0.65rem;">
                    ✉ hi@usecomus.com
                  </a>
                  <button type="button" id="copy-support-email-btn" class="btn btn-icon" style="font-size:0.74rem; padding:0.28rem 0.6rem;">
                    ${UI_ICONS.link} <span>Adresi Kopyala</span>
                  </button>
                </div>
              </div>

              <div id="contact-feedback-box" class="auth-alert success" role="status" hidden></div>

              <form id="contact-support-form" novalidate>
                <div class="form-grid">
                  <div class="field">
                    <label for="contact-sender-name">Adınız &amp; Soyadınız</label>
                    <span id="contact-name-hint" class="hint">Mesajınızda görünecek adınız</span>
                    <input
                      type="text"
                      id="contact-sender-name"
                      name="senderName"
                      value="${this.authState.currentUser ? this.authState.currentUser.fullName : this.birthInput.fullName}"
                      placeholder="Adınız Soyadınız"
                      autocomplete="name"
                      required
                      aria-describedby="contact-name-hint"
                    />
                  </div>

                  <div class="field">
                    <label for="contact-sender-email">E-posta Adresiniz</label>
                    <span id="contact-email-hint" class="hint">Size geri dönüş yapabileceğimiz e-posta adresiniz</span>
                    <input
                      type="email"
                      id="contact-sender-email"
                      name="senderEmail"
                      value="${this.authState.currentUser ? this.authState.currentUser.email : this.authDraftEmail}"
                      placeholder="ornek@eposta.com"
                      autocomplete="email"
                      required
                      aria-describedby="contact-email-hint"
                    />
                  </div>

                  <div class="field full-span">
                    <label for="contact-subject">Konu</label>
                    <span id="contact-subject-hint" class="hint">Mesajınızın konusunu seçin veya yazın</span>
                    <input
                      type="text"
                      id="contact-subject"
                      name="subject"
                      value="Zenith — Destek & Geri Bildirim"
                      placeholder="Örn: Destek, Öneri, Harita Yorumu..."
                      required
                      aria-describedby="contact-subject-hint"
                    />
                  </div>

                  <div class="field full-span">
                    <label for="contact-message">Mesajınız</label>
                    <span id="contact-message-hint" class="hint">hi@usecomus.com adresine iletilecek mesajınızı buraya yazınız</span>
                    <textarea
                      id="contact-message"
                      name="message"
                      rows="4"
                      class="contact-textarea"
                      placeholder="Merhaba Zenith ekibi, size şu konuda yazıyorum..."
                      required
                      aria-describedby="contact-message-hint"
                    ></textarea>
                  </div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.65rem; margin-top:0.95rem;">
                  <span style="font-size:0.75rem; color:var(--text-secondary);">
                    Alıcı: <strong style="color:#6B440A; font-family:var(--font-mono);">hi@usecomus.com</strong>
                  </span>
                  <div style="display:flex; align-items:center; flex-wrap:wrap; gap:0.5rem;">
                    <a
                      href="mailto:hi@usecomus.com?subject=Zenith%20%E2%80%94%20%C4%B0leti%C5%9Fim"
                      id="direct-mailto-link"
                      class="btn btn-icon"
                      style="text-decoration:none; font-size:0.78rem;"
                    >
                      ${UI_ICONS.mail} <span>Doğrudan Mail Uygulamasını Aç</span>
                    </a>
                    <button type="submit" id="contact-submit-btn" class="btn btn-primary">
                      ${UI_ICONS.mail} <span>hi@usecomus.com Adresine Gönder</span>
                    </button>
                  </div>
                </div>
              </form>
            </section>
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
              <span class="bottom-nav-icon">
                <img src="/zenith/nav-live-sky.png" alt="" class="bottom-nav-custom-img" aria-hidden="true" />
              </span>
              <span class="bottom-nav-label">Canlı Gökyüzü</span>
            </button>

            <button
              type="button"
              class="bottom-nav-item center-home ${isChartView ? 'active' : ''}"
              data-bottom-nav="chart"
              aria-current="${isChartView ? 'page' : 'false'}"
            >
              <span class="bottom-nav-icon">
                <img src="/zenith/nav-birth-chart.png" alt="" class="bottom-nav-custom-img" aria-hidden="true" />
              </span>
              <span class="bottom-nav-label">Doğum Haritası</span>
            </button>

            <button
              type="button"
              class="bottom-nav-item ${isCosmicCalendarView ? 'active' : ''}"
              data-bottom-nav="cosmic-calendar"
              aria-current="${isCosmicCalendarView ? 'page' : 'false'}"
            >
              <span class="bottom-nav-icon">
                <img src="/zenith/nav-cosmic-calendar.png" alt="" class="bottom-nav-custom-img" aria-hidden="true" />
              </span>
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

      <!-- APP USAGE GUIDE DIALOG (UYGULAMA KULLANMA REHBERİ) -->
      <dialog id="app-guide-modal" class="zenith-dialog" closedby="any" aria-labelledby="app-guide-modal-title">
        <div class="dialog-inner">
          <div class="dialog-header">
            <h2 id="app-guide-modal-title" style="font-size:1.08rem; font-weight:700; display:flex; align-items:center; gap:0.45rem;">
              ${UI_ICONS.book} <span>Zenith Uygulama Kullanma Rehberi</span>
            </h2>
            <button type="button" id="close-app-guide-modal-btn" class="btn btn-icon" aria-label="Rehberi Kapat">✕</button>
          </div>

          <p style="font-size:0.83rem; color:var(--text-secondary);">
            Zenith, gerçek astronomik ephemeris (VSOP87 / JPL) verileriyle doğum haritanızı, canlı gökyüzü transitlerini ve aylık kozmik takviminizi hesaplar. Uygulamayı en verimli şekilde kullanmak için aşağıdaki adımları izleyebilirsiniz:
          </p>

          <div class="guide-sections-list">
            <div class="guide-step-card">
              <div class="guide-step-head">
                <span class="guide-step-badge">1</span>
                <strong>${UI_ICONS.user} Profil &amp; Doğum Bilgileri</strong>
              </div>
              <p>
                Üst bardaki <strong>Profil</strong> butonuna dokunarak adınızı, doğum tarihinizi, <strong>doğum saatinizi</strong> (Yükselen burç ve Placidus ev girişleri için kritiktir) ve doğum şehrinizi kaydedin. Bilgileriniz 5 katmanlı kalıcı hafızaya kaydedilir; ayrıca <em>Hesabım</em> bölümünden birden fazla harita saklayabilirsiniz.
              </p>
            </div>

            <div class="guide-step-card">
              <div class="guide-step-head">
                <span class="guide-step-badge">2</span>
                <strong>${UI_ICONS.natalWheel} Doğum Haritası (Orta Alt Menü — Ana Sayfa)</strong>
              </div>
              <p>
                Uygulamanın ana sayfasıdır. Üstteki <strong>4 ana rapor butonuna</strong> dokunarak detaylı analizleri açabilirsiniz:
              </p>
              <ul class="guide-bullet-list">
                <li><strong>Büyük Üçlü:</strong> Güneş (Öz Kimlik), Ay (Duygusal Merkez) ve Yükselen (Maske &amp; Rota) senteziniz ile Element/Nitelik dengeniz.</li>
                <li><strong>Gezegen Tablosu:</strong> 11 gök cisminin burç, derece, Placidus evi, hız (Retro/Düz) ve asalet tablosu.</li>
                <li><strong>Transitler:</strong> Aktif ±2.0° dar orblu gökyüzü eşleşmeleri ve aksiyon önerileri.</li>
                <li><strong>Kişilik Analizi:</strong> Kartı <strong>sola kaydırarak (swipe)</strong> sayfa sayfa ilerleyebileceğiniz 4 katmanlı gezegen sentezleri.</li>
              </ul>
              <p style="margin-top:0.3rem;">
                Harita çarkı üzerindeki herhangi bir gezegene veya <em>Doğum Haritası Gezegen &amp; Eksen Dizilimi</em> tablosuna dokunarak o gezegenin detaylı inceleyicisini açabilirsiniz.
              </p>
            </div>

            <div class="guide-step-card">
              <div class="guide-step-head">
                <span class="guide-step-badge">3</span>
                <strong>${UI_ICONS.compass} Canlı Gökyüzü (Sol Alt Menü)</strong>
              </div>
              <p>
                Şu anki gerçek zamanlı gökyüzü çarkını ve doğum haritanızla yaptığı rezonans açılarını gösterir. Çarkın hemen altındaki <strong>Aktif ±2.0° Eşleşmeler</strong> tablosundan veya <strong>Anlık Gökyüzü Gezegen Dizilimi</strong> listesinden bir gök cismine dokunarak haritanızın hangi evinden geçtiğini anında görebilirsiniz.
              </p>
            </div>

            <div class="guide-step-card">
              <div class="guide-step-head">
                <span class="guide-step-badge">4</span>
                <strong>${UI_ICONS.calendar} Kozmik Takvim (Sağ Alt Menü)</strong>
              </div>
              <p>
                6 yaşam kategorisinden (<em>İş &amp; Kariyer, Görüşme &amp; İmza, Eğitim &amp; Seyahat, Finans &amp; Yatırım, İlişki &amp; Duygusal, Aile &amp; Ev</em>) birini seçin. Takvim ayına göre (Ekim, Kasım vb.) yayınlanan <strong>7 sütunlu aylık takvimde</strong> herhangi bir güne dokunarak o günün tüm destekleyici/zorlayıcı açı kanıtlarını açabilir ve <strong>"Bu Günün Gökyüzünü Haritada Gör"</strong> butonuyla o tarihi göksel çarkta inceleyebilirsiniz.
              </p>
            </div>

            <div class="guide-step-card" style="border-color:var(--accent-gold-border); background:var(--accent-gold-soft);">
              <div class="guide-step-head">
                <span class="guide-step-badge" style="background:#8C5A14; color:#FFFCFA; border-color:#8C5A14;">5</span>
                <strong>${UI_ICONS.sparkle} Zenith Haritaları Nasıl Hesaplar ve Neye Göre Yorumlar?</strong>
              </div>
              <p>
                Zenith, genel burç yorumları yerine <strong>astronomi tabanlı matematiksel ephemeris</strong> ve <strong>klasik/modern Batı astrolojisi kurallarını</strong> birleştiren çok katmanlı bir motor kullanır:
              </p>
              <ul class="guide-bullet-list">
                <li><strong>Astronomik Harita Hesaplaması (VSOP87 / JPL):</strong> Doğum yerinizin enlem/boylam koordinatları ve IANA saat dilimi (tarihsel yaz/kış saati farkları dahil) kullanılarak yerel doğum saatiniz <em>Evrensel Zamana (UTC)</em> ve <em>Jülyen Gününe (Julian Day)</em> çevrilir. Güneş, Ay, 8 gezegen ve Kuzey Ay Düğümü'nün yer merkezli (jeosentrik) tropikal ekliptik boylamları ve günlük hızları (Düz / ℞ Retro) gerçek astronomik yörünge denklemleriyle hesaplanır.</li>
                <li><strong>Evler ve Ana Eksenler (Placidus Sistemi):</strong> Doğum anındaki <em>Yerel Yıldız Zamanı (LST)</em> ve ekliptik eğikliği (~23.44°) üzerinden <strong>Yükselen (ASC — 1. Ev)</strong>, <strong>Tepe Noktası (MC / Zenith — 10. Ev)</strong>, <strong>Alçalan (DSC — 7. Ev)</strong> ve <strong>Dip Nokta (IC — 4. Ev)</strong> eksenleri ile 12 Placidus ev girişi trigonometrik olarak belirlenir. Burçlar enerjinin <em>"nasıl"</em> çalıştığını, evler ise bu enerjinin <em>"hangi yaşam alanında"</em> (kariyer, ilişki, finans, aile vb.) somutlaştığını gösterir.</li>
                <li><strong>Açılar (Aspects) ve Orb Hassasiyeti:</strong> Gök cisimleri arasındaki açısal uzaklıklar taranarak 5 majör açı değerlendirilir: <strong>Kavuşum (0°)</strong> odaklanma ve birleşimi; <strong>Sekstil (60°)</strong> ve <strong>Üçgen (120°)</strong> uyumlu akış, yetenek ve fırsatları; <strong>Kare (90°)</strong> ve <strong>Karşıt (180°)</strong> ise gelişim tetikleyen dinamik gerilimleri ve sınavları temsil eder. Açıların gücü, tam açıya olan sapma payına (<em>orb</em>) ve açının <em>yaklaşan (güçlenen)</em> ya da <em>uzaklaşan</em> olmasına göre ağırlıklandırılır.</li>
                <li><strong>4 Katmanlı Doğum Haritası Sentezi:</strong> Her gezegen tek başına değil, 4 katmanın birleşimiyle yorumlanır: <strong>(1) Konum</strong> (Burç doğası + Ev sahnesi + Yöneticilik/Yücelim asaleti), <strong>(2) Açı Modülasyonu</strong> (diğer gezegenlerden aldığı destekleyici/zorlayıcı açılar), <strong>(3) Dispozitör Zinciri</strong> (gezegenin bulunduğu burcun yöneticisinin hangi ev ve burçta olduğu) ve <strong>(4) Transit Tetiklenmesi</strong>.</li>
                <li><strong>4 Kraliyet Yıldızı (Aldebaran, Regulus, Antares, Fomalhaut) Tespiti &amp; Yorumu:</strong> Sabit yıldızlar Zodyak kuşağında ekinoks presesyonu nedeniyle her ~71.6 yılda 1° (<em>+50.2888&quot;/yıl</em>) ilerler. Zenith, yıldızların J2000.0 astronomik katalog boylamlarına doğum tarihinizin Jülyen Günü farkını uygulayarak doğum anınızdaki kritik derecelerini (<em>Aldebaran ~09°47' İkizler, Regulus ~29°50' Aslan / 00° Başak, Antares ~09°46' Yay, Fomalhaut ~03°52' Balık</em>) hesaplar. Klasik sabit yıldız kuralına uygun olarak yalnızca kişisel/sosyal gezegenler (<em>Güneş, Ay, Merkür, Venüs, Mars, Jüpiter, Satürn</em>) ve ana eksenler (<em>ASC, MC</em>) ile <strong>≤1°00' dar orb içinde tam Kavuşum (0°)</strong> varsa, yalnızca haritasında Kraliyet Yıldızı bulunan kişilere bu özel Kraliyet Vaadi ve Etik Gölge Sınavı (Nemesis) bilgisi gösterilir.</li>
                <li><strong>Canlı Gökyüzü &amp; Doğum Haritası Eşleştirmesi:</strong> Anlık gökyüzü haritasındaki transit gezegenlerin şu an doğum haritanızın hangi Placidus evinden geçtiği ve natal gezegenlerinize yaptığı <strong>±2.0° dar orblu</strong> en keskin açılar gerçek zamanlı karşılaştırılır. Kozmik Takvim de aynı yöntemle ayın her günü için hedef yaşam kategorinizin evlerini, ev yöneticilerinizi ve natal gezegenlerinizi o günün gökyüzüyle eşleştirerek net puan ve kanıt üretir.</li>
              </ul>
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; align-items:center; gap:0.5rem; padding-block-start:0.35rem; border-block-start:1px solid var(--border-subtle);">
            <button type="button" id="ok-app-guide-modal-btn" class="btn btn-primary">Anladım, Keşfetmeye Başla</button>
          </div>
        </div>
      </dialog>

      <!-- COSMIC NOTIFICATIONS DIALOG (GÜNLÜK VE HAFTALIK KOZMİK BİLDİRİMLER) -->
      <dialog id="cosmic-notifications-modal" class="zenith-dialog" closedby="any" aria-labelledby="cosmic-notif-modal-title">
        <div class="dialog-inner" id="cosmic-notifications-modal-inner"></div>
      </dialog>

      <!-- FULL MOON & NATAL CHART RELATIONSHIP DIALOG (ZENITH DOLUNAY MESAJI) -->
      <dialog id="full-moon-modal" class="zenith-dialog" closedby="any" aria-labelledby="full-moon-modal-title">
        <div class="dialog-inner" id="full-moon-modal-inner"></div>
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

    const parseIsoLocal = (iso: string) => {
      const [y, m, d] = iso.split('-').map(Number);
      return { y, m, d, dateObj: new Date(y, m - 1, d) };
    };

    const firstParsed = parseIsoLocal(res.allDays[0].dateIso);
    const calendarMonthName = TR_MONTHS_LONG[firstParsed.m - 1];
    const calendarMonthTitle = `${calendarMonthName} ${firstParsed.y}`;
    const todayIso = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.birthInput.location.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());

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
      <!-- 1. AYLIK KOZMİK ZAMANLAMA TAKVİMİ -->
      <div class="electional-header">
        <div class="electional-title-block">
          <div class="live-sky-title-row">
            <h2 class="live-sky-title">${UI_ICONS.calendar} <span>Aylık Kozmik Zamanlama Takvimi (${calendarMonthTitle})</span></h2>
            <span class="badge" style="color:#8C5A14; border-color:#DFC79C; background:#F7EFE0;">
              %100 Gerçek Astronomik Veri (VSOP87 / JPL)
            </span>
          </div>
          <p class="electional-subtitle">
            Seçtiğiniz kategoriyle ilgili doğum haritası evlerinizi, kişisel ev yöneticilerinizi ve natal gezegen derecelerinizi <strong>${calendarMonthTitle}</strong> ayının (<strong>${res.startDateFormatted} — ${res.endDateFormatted}</strong>) gerçek gökyüzü boylamlarıyla gün gün karşılaştırır.
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

      <!-- 3. TAM EPHEMERİS AYLIK TAKVİMİ (TAKViM AYINA GÖRE AY AY YAYINLANIR) -->
      <details id="calendar-strip-accordion" class="electional-accordion calendar-accordion" ${this.isCalendarAccordionOpen ? 'open' : ''}>
        <summary class="electional-accordion-summary calendar-summary">
          <span class="electional-summary-left">
            ${UI_ICONS.calendar}
            <span>${calendarMonthTitle} Tam Ephemeris Takvimi (${res.allDays.length} Gün — Aylık Takvim)</span>
          </span>
          <span class="electional-summary-hint">Takvimi Aç / Kapat ▾</span>
        </summary>
        <div class="electional-accordion-body">
          <div class="monthly-calendar-wrapper">
            <div class="monthly-calendar-topbar">
              <div class="monthly-calendar-header-row">
                <button type="button" id="cal-prev-month-btn" class="btn btn-icon mcal-arrow-btn" aria-label="Önceki Ay" title="Önceki Ay">
                  ‹
                </button>

                <div class="monthly-calendar-month-title">
                  ${UI_ICONS.calendar}
                  <span>${calendarMonthTitle}</span>
                  ${
                    this.electionalMonthOffset !== 0
                      ? `<button type="button" id="cal-reset-month-btn" class="mcal-reset-pill" aria-label="Geçerli aya dön">Bugün</button>`
                      : ''
                  }
                </div>

                <button type="button" id="cal-next-month-btn" class="btn btn-icon mcal-arrow-btn" aria-label="Sonraki Ay" title="Sonraki Ay">
                  ›
                </button>
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

            <div class="monthly-calendar-grid" role="listbox" aria-label="${calendarMonthTitle} Aylık Astrolojik Takvim">
              ${leadingEmptyHtml}
              ${res.allDays
                .map((d) => {
                  const isSel = d.dateIso === selectedDay.dateIso;
                  const isToday = d.dateIso === todayIso;
                  const parsed = parseIsoLocal(d.dateIso);
                  return `
                    <button
                      type="button"
                      role="option"
                      aria-selected="${isSel}"
                      class="monthly-cal-cell ${d.verdict} ${isSel ? 'selected' : ''} ${isToday ? 'today' : ''}"
                      data-open-elec-day="${d.dateIso}"
                    >
                      <div class="mcal-cell-top">
                        <span class="mcal-day-num">${parsed.d}</span>
                        <span class="mcal-day-score">${d.netScore >= 0 ? '+' : ''}${d.netScore}</span>
                      </div>
                      <div class="mcal-cell-bottom">
                        <span class="mcal-day-moon" title="Ay Burcu: ${d.moonSignName}">${d.moonSignGlyph}</span>
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
            <span>${calendarMonthName} Ayında Dikkat Edilmesi / Esnek Olunması Önerilen Günler (${res.cautionDays.length} Gün)</span>
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
                          <span class="electional-rank-badge caution-badge">${res.category.shortLabel} • Dikkat &amp; Esneklik</span>
                          <strong class="electional-date-title">${day.dateFormatted}</strong>
                        </div>
                        <span class="badge badge-retro">
                          Net Açı Puanı: ${day.netScore}
                        </span>
                      </div>

                      <div class="electional-day-meta">
                        <span>☽ Ay: <strong>${day.moonSignGlyph} ${day.moonSignName} ${day.moonDegreeFormatted}</strong> (Natal ${day.moonNatalHouse}. Evinizde)</span>
                        <span>•</span>
                        <span>${day.lunarPhaseName}</span>
                      </div>

                      <p class="electional-day-narrative">
                        ${formatMarkdownBold(day.daySummaryNarrative)}
                      </p>

                      <div class="electional-day-topics-box caution-topics-box">
                        <div class="electional-topics-heading caution-heading">
                          ${UI_ICONS.alert} <span>Hangi Konularda Dikkatli / Esnek Olunmalı?</span>
                        </div>
                        <ul class="electional-topics-list">
                          ${day.cautionTopics.map((t) => `<li>${formatMarkdownBold(t)}</li>`).join('')}
                        </ul>
                      </div>

                      <div class="electional-day-advice-box caution-advice-box">
                        <strong>Günün Kişisel Tavsiyesi:</strong> ${formatMarkdownBold(day.personalAdvice)}
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
              : `<div class="balance-card">Seçili kategoride ${calendarMonthTitle} ayı boyunca yüksek gerilimli sert açı baskısı taşıyan kritik gün bulunmuyor.</div>`
          }
        </div>
      </details>

      <!-- 5. EN UYGUN OLAN GÜNLER -->
      <details id="optimal-days-accordion" class="electional-accordion" ${this.isOptimalAccordionOpen ? 'open' : ''}>
        <summary class="electional-accordion-summary">
          <span class="electional-summary-left">
            ${UI_ICONS.star}
            <span>${calendarMonthName} Ayında En Uygun Günler (${res.topOptimalDays.length} Gün — Özel Yorum &amp; Tavsiyeli)</span>
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
                        <span class="electional-rank-badge">#${idx + 1} En Uygun Gün • ${res.category.shortLabel}</span>
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

                    <p class="electional-day-narrative">
                      ${formatMarkdownBold(day.daySummaryNarrative)}
                    </p>

                    <div class="electional-day-topics-box optimal-topics-box">
                      <div class="electional-topics-heading optimal-heading">
                        ${UI_ICONS.check} <span>Bugün Hangi Konularda Adım Atmak İçin Uygun?</span>
                      </div>
                      <ul class="electional-topics-list">
                        ${day.favorableTopics.map((t) => `<li>${formatMarkdownBold(t)}</li>`).join('')}
                      </ul>
                    </div>

                    <div class="electional-day-advice-box optimal-advice-box">
                      <strong>Günün Kişisel Tavsiyesi:</strong> ${formatMarkdownBold(day.personalAdvice)}
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

    const updateElectionalMonth = (nextOffset: number) => {
      this.electionalMonthOffset = nextOffset;
      this.electionalResult = evaluateThirtyDayElectionalForecast(
        this.chart,
        this.electionalQueryText,
        this.electionalCategoryId,
        this.getElectionalBaseDate()
      );
      this.selectedElectionalDayIso =
        this.electionalResult.topOptimalDays[0]?.dateIso ||
        this.electionalResult.allDays[0].dateIso;
      this.renderElectionalPlanner();
    };

    document.getElementById('cal-prev-month-btn')?.addEventListener('click', () => {
      updateElectionalMonth(this.electionalMonthOffset - 1);
    });
    document.getElementById('cal-next-month-btn')?.addEventListener('click', () => {
      updateElectionalMonth(this.electionalMonthOffset + 1);
    });
    document.getElementById('cal-reset-month-btn')?.addEventListener('click', () => {
      updateElectionalMonth(0);
    });

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
            this.getElectionalBaseDate()
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
          <div class="electional-inspector-badge"><span>${res.category.shortLabel} • ${selectedDay.verdictLabel}</span></div>
          <h2 id="electional-modal-title" style="font-size:1.05rem; font-weight:700; color:var(--text-primary);">
            <span>${selectedDay.dateFormatted} (Saat 12:00 Yerel Ephemeris)</span>
          </h2>
        </div>
      </div>

      <div class="electional-inspector-chips">
        <span class="profile-meta-chip">☽ Ay Konumu: ${selectedDay.moonSignGlyph} ${selectedDay.moonSignName} ${selectedDay.moonDegreeFormatted} (${selectedDay.moonNatalHouse}. Ev)</span>
        <span class="profile-meta-chip">${selectedDay.lunarPhaseName} (${selectedDay.lunarElongationDeg.toFixed(1)}°)</span>
        <span class="profile-meta-chip">Astronomik Net Skor: ${selectedDay.netScore >= 0 ? '+' : ''}${selectedDay.netScore}</span>
      </div>

      <!-- GÜNÜN ÖZEL ANLATIMI & KİŞİSEL TAVSİYE REHBERİ -->
      <div class="electional-modal-guidance-card ${selectedDay.verdict}">
        <div class="electional-modal-guidance-title">
          ${selectedDay.verdict === 'caution' ? UI_ICONS.alert : UI_ICONS.sparkle}
          <span>Günün Özel Yorumu &amp; ${res.category.shortLabel} Rehberi</span>
        </div>
        <p class="electional-day-narrative">
          ${formatMarkdownBold(selectedDay.daySummaryNarrative)}
        </p>

        <div class="electional-modal-topics-grid">
          <div class="electional-day-topics-box optimal-topics-box">
            <div class="electional-topics-heading optimal-heading">
              ${UI_ICONS.check} <span>Bugün Uygun Olan &amp; Desteklenen Konular:</span>
            </div>
            <ul class="electional-topics-list">
              ${selectedDay.favorableTopics.map((t) => `<li>${formatMarkdownBold(t)}</li>`).join('')}
            </ul>
          </div>

          <div class="electional-day-topics-box caution-topics-box">
            <div class="electional-topics-heading caution-heading">
              ${UI_ICONS.alert} <span>Dikkat Edilmesi / Esnek Olunması Gereken Konular:</span>
            </div>
            <ul class="electional-topics-list">
              ${selectedDay.cautionTopics.map((t) => `<li>${formatMarkdownBold(t)}</li>`).join('')}
            </ul>
          </div>
        </div>

        <div class="electional-day-advice-box ${selectedDay.verdict === 'caution' ? 'caution-advice-box' : 'optimal-advice-box'}">
          <strong>Zenith Kişisel Eylem Tavsiyesi:</strong> ${formatMarkdownBold(selectedDay.personalAdvice)}
        </div>
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
      const royalConjs = this.chart.royalStars.flatMap((rs) =>
        rs.conjunctions.filter((c) => c.targetId === p.id)
      );

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
                ${royalConjs.map((rc) => `<span class="badge" style="background:#F7EFE0; color:#8C5A14; border-color:#DFC79C;">★ ${rc.starName} ☌ (${rc.orbFormatted})</span>`).join('')}
              </div>
              <div class="inspector-subtitle">
                ${p.sign.elementName} Elementi • ${p.sign.modalityName} Nitelik • Günlük Hız: ${p.speed >= 0 ? '+' : ''}${p.speed.toFixed(2)}°/gün
              </div>
            </div>
          </div>
        </div>

        <div class="synthesis-layers">
          ${royalConjs
            .map(
              (rc) => `
            <div class="layer-card layer-1" style="background:linear-gradient(180deg, #FFFDF7 0%, #F7EDD6 100%); border-color:#DFC184;">
              <div class="layer-header">
                <span class="layer-title" style="color:#8C5A14;">${UI_ICONS.crown} <span>Kraliyet Yıldızı Kavuşumu: ★ ${rc.starName}</span></span>
                <span class="badge" style="background:#F6EBCD; color:#7A4D0E; border-color:#DFC184;">${rc.tierLabel} • Orb: ${rc.orbFormatted}</span>
              </div>
              <div class="layer-body">
                <p>${formatMarkdownBold(rc.promiseText)}</p>
                <p style="margin-top:0.4rem;">${formatMarkdownBold(rc.shadowTestText)}</p>
              </div>
            </div>
          `
            )
            .join('')}
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
      const angleRoyalConjs = this.chart.royalStars.flatMap((rs) =>
        rs.conjunctions.filter((c) => c.targetId === sel.id)
      );

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
                ${angleRoyalConjs.map((rc) => `<span class="badge" style="background:#F7EFE0; color:#8C5A14; border-color:#DFC79C;">★ ${rc.starName} ☌ (${rc.orbFormatted})</span>`).join('')}
              </div>
              <div class="inspector-subtitle">
                ${houseMeta.title} • Eksen Yöneticisi: ${renderBodyGlyph(rulerPlanet.glyph)} ${rulerPlanet.name} (${rulerPlanet.sign.name}, ${rulerPlanet.house}. Ev)
              </div>
            </div>
          </div>
        </div>

        <div class="synthesis-layers">
          ${angleRoyalConjs
            .map(
              (rc) => `
            <div class="layer-card layer-1" style="background:linear-gradient(180deg, #FFFDF7 0%, #F7EDD6 100%); border-color:#DFC184;">
              <div class="layer-header">
                <span class="layer-title" style="color:#8C5A14;">${UI_ICONS.crown} <span>Kraliyet Yıldızı Kavuşumu: ★ ${rc.starName}</span></span>
                <span class="badge" style="background:#F6EBCD; color:#7A4D0E; border-color:#DFC184;">${rc.tierLabel} • Orb: ${rc.orbFormatted}</span>
              </div>
              <div class="layer-body">
                <p>${formatMarkdownBold(rc.promiseText)}</p>
                <p style="margin-top:0.4rem;">${formatMarkdownBold(rc.shadowTestText)}</p>
              </div>
            </div>
          `
            )
            .join('')}
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
                  const pRoyalConj = this.chart.royalStars.flatMap((rs) =>
                    rs.conjunctions.filter((c) => c.targetId === p.id)
                  );
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
                      <td>
                        ${p.dignity || 'Peregrin'}
                        ${pRoyalConj.map((rc) => ` <span class="badge" style="background:#F7EFE0; color:#8C5A14; border-color:#DFC79C;">★ ${rc.starName} (${rc.orbFormatted})</span>`).join('')}
                      </td>
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
                        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
                          <span class="badge" style="font-family:var(--font-mono); color:#8C5A14; border-color:#DFC79C; background:#F7EFE0; white-space:nowrap; flex-shrink:0;">
                            ${renderBodyGlyph(tr.transitBody.glyph)} ${tr.glyph} ${renderBodyGlyph(tr.natalTarget.glyph)} • Orb: ${tr.orb.toFixed(2)}°
                          </span>
                          <span class="badge" style="white-space:nowrap; flex-shrink:0;">
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
      const layerDefs: Array<{
        layerIndex: number;
        shortLabel: string;
        fullTitle: string;
        accentColor: string;
        getText: (syn: ChartCalculationResult['syntheses'][BodyId]) => string;
      }> = [
        {
          layerIndex: 0,
          shortLabel: '1. Konum',
          fullTitle: '1. Konum (Burç & Ev)',
          accentColor: 'var(--accent-gold)',
          getText: (syn) => syn.layer1Location.narrative
        },
        {
          layerIndex: 1,
          shortLabel: '2. Açı',
          fullTitle: '2. Açı Modülasyonu',
          accentColor: 'var(--accent-blue)',
          getText: (syn) => syn.layer2AspectModulation.synthesisText
        },
        {
          layerIndex: 2,
          shortLabel: '3. Yöneticilik',
          fullTitle: '3. Yöneticilik (Dispozitör)',
          accentColor: 'var(--accent-emerald)',
          getText: (syn) => syn.layer3Dispositor.chainNarrative
        },
        {
          layerIndex: 3,
          shortLabel: '4. Transit',
          fullTitle: '4. Günlük Transit Özeti',
          accentColor: 'var(--accent-cyan)',
          getText: (syn) => syn.layer4TransitSummary.bulletinText
        }
      ];

      const slidesData = planets.flatMap((p, pIdx) => {
        const syn = this.chart.syntheses[p.id];
        return layerDefs.map((ld) => ({
          slideIdx: pIdx * 4 + ld.layerIndex,
          planetIdx: pIdx,
          planet: p,
          syn,
          layerIndex: ld.layerIndex,
          layerShortLabel: ld.shortLabel,
          layerFullTitle: ld.fullTitle,
          layerAccentColor: ld.accentColor,
          layerText: ld.getText(syn)
        }));
      });

      const totalPages = slidesData.length;
      if (this.personalityPageIndex >= totalPages || this.personalityPageIndex < 0) {
        this.personalityPageIndex = 0;
      }

      const initialSlide = slidesData[this.personalityPageIndex];

      container.innerHTML = `
        <div class="synthesis-compact-shell">
          <div class="synthesis-pager-header">
            <div class="synthesis-pager-title-block">
              <div class="synthesis-pager-title-row">
                <h3 class="synthesis-main-heading">
                  Bütünsel 4 Katmanlı Kişilik Analizi
                </h3>
                <span id="synthesis-page-counter" class="badge synthesis-counter-badge">
                  ${initialSlide.planet.name} • Katman ${initialSlide.layerIndex + 1}/4 (${this.personalityPageIndex + 1}/${totalPages})
                </span>
              </div>
              <p class="synthesis-pager-hint">
                Ekranı aşağı kaydırmadan, kartı <strong>sağa / sola kaydırarak</strong> tüm katmanları ve gezegenleri sırayla okuyabilirsiniz.
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

          <!-- GEZEGEN SEÇİM BARI (scroll-snap-state-sync) -->
          <nav class="synthesis-pager-nav" aria-label="Kişilik Analizi Gezegen Seçimi">
            <ul class="synthesis-pager-dots">
              ${planets
                .map((p, pIdx) => {
                  const isAct = pIdx === initialSlide.planetIdx;
                  return `
                    <li>
                      <button
                        type="button"
                        class="synthesis-dot-btn ${isAct ? 'active' : ''}"
                        data-syn-planet="${pIdx}"
                        ${isAct ? 'aria-current="true"' : ''}
                      >
                        <span class="syn-dot-num">${pIdx + 1}.</span>
                        ${renderBodyGlyph(p.glyph)}
                        <span>${p.name}</span>
                      </button>
                    </li>
                  `;
                })
                .join('')}
            </ul>
          </nav>

          <!-- AKTİF GEZEGENİN 4 KATMAN SEÇİCİSİ -->
          <div class="synthesis-layer-tabs" role="tablist" aria-label="4 Katman Seçimi">
            ${layerDefs
              .map((ld) => {
                const isLayerAct = ld.layerIndex === initialSlide.layerIndex;
                return `
                  <button
                    type="button"
                    role="tab"
                    class="synthesis-layer-tab-btn ${isLayerAct ? 'active' : ''}"
                    data-syn-layer="${ld.layerIndex}"
                    aria-selected="${isLayerAct}"
                  >
                    ${ld.shortLabel}
                  </button>
                `;
              })
              .join('')}
          </div>

          <!-- YATAY KAYDIRILABİLİR TEK EKRAN KARTLAR (DİKEY KAYDIRMA GEREKTİRMEZ) -->
          <div class="synthesis-pager-track" id="synthesis-pager-track" role="region" aria-roledescription="carousel" aria-label="Kişilik Analizi Sayfaları">
            ${slidesData
              .map((item) => {
                const p = item.planet;
                const elColor = ELEMENT_COLORS[p.sign.element].primary;
                const prevItem = item.slideIdx > 0 ? slidesData[item.slideIdx - 1] : null;
                const nextItem = item.slideIdx < totalPages - 1 ? slidesData[item.slideIdx + 1] : null;
                return `
                  <article
                    class="synthesis-slide balance-card"
                    id="synthesis-slide-${item.slideIdx}"
                    data-syn-slide-idx="${item.slideIdx}"
                    role="group"
                    aria-roledescription="slide"
                    aria-label="${p.name} - ${item.layerFullTitle} (${item.slideIdx + 1} / ${totalPages})"
                    style="border-inline-start: 4px solid ${elColor};"
                  >
                    <div class="synthesis-slide-top">
                      <div class="synthesis-slide-planet-meta">
                        <span class="synthesis-slide-step-badge">Katman ${item.layerIndex + 1} / 4</span>
                        <h4 class="synthesis-slide-planet-title">
                          <span style="color:${elColor};">${renderBodyGlyph(p.glyph)}</span>
                          <span>${p.name} — ${p.sign.glyph} ${p.fullFormatted} (${p.house}. Ev)</span>
                        </h4>
                      </div>
                      <span class="badge synthesis-tone-badge">${item.syn.layer2AspectModulation.dominantTone}</span>
                    </div>

                    <div class="synthesis-single-layer-card">
                      <div class="synthesis-single-layer-head">
                        <strong style="color:${item.layerAccentColor};">${item.layerFullTitle}</strong>
                        <span class="synthesis-single-layer-counter">Sayfa ${item.slideIdx + 1} / ${totalPages}</span>
                      </div>
                      <div class="synthesis-single-layer-body">
                        ${formatMarkdownBold(item.layerText)}
                      </div>
                    </div>

                    <div class="synthesis-slide-footer">
                      ${
                        prevItem
                          ? `<button type="button" class="btn btn-icon synthesis-footer-nav-btn" data-syn-goto="${item.slideIdx - 1}">
                              ← ${prevItem.planetIdx === item.planetIdx ? prevItem.layerShortLabel : prevItem.planet.name}
                            </button>`
                          : `<span></span>`
                      }
                      <span class="synthesis-swipe-cue">Kaydırarak Geçin ↔</span>
                      ${
                        nextItem
                          ? `<button type="button" class="btn btn-icon active synthesis-footer-nav-btn" data-syn-goto="${item.slideIdx + 1}">
                              ${nextItem.planetIdx === item.planetIdx ? nextItem.layerShortLabel : `${nextItem.planet.name} (1. Konum)`} →
                            </button>`
                          : `<button type="button" class="btn btn-icon synthesis-footer-nav-btn" data-syn-goto="0">
                              ↺ Başa Dön
                            </button>`
                      }
                    </div>
                  </article>
                `;
              })
              .join('')}
          </div>
        </div>
      `;

      const track = document.getElementById('synthesis-pager-track');
      const counterEl = document.getElementById('synthesis-page-counter');
      const prevBtn = document.getElementById('syn-prev-btn') as HTMLButtonElement | null;
      const nextBtn = document.getElementById('syn-next-btn') as HTMLButtonElement | null;
      const slides = Array.from(container.querySelectorAll<HTMLElement>('.synthesis-slide'));
      const planetBtns = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-syn-planet]'));
      const layerBtns = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-syn-layer]'));

      const syncActivePageUI = (pageIdx: number) => {
        if (pageIdx < 0 || pageIdx >= totalPages) return;
        this.personalityPageIndex = pageIdx;
        const activeItem = slidesData[pageIdx];

        if (counterEl && activeItem) {
          counterEl.textContent = `${activeItem.planet.name} • Katman ${activeItem.layerIndex + 1}/4 (${pageIdx + 1}/${totalPages})`;
        }
        if (prevBtn) prevBtn.disabled = pageIdx === 0;
        if (nextBtn) nextBtn.disabled = pageIdx === totalPages - 1;

        planetBtns.forEach((btn, pIdx) => {
          const isAct = pIdx === activeItem.planetIdx;
          btn.classList.toggle('active', isAct);
          if (isAct) {
            btn.setAttribute('aria-current', 'true');
            btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          } else {
            btn.removeAttribute('aria-current');
          }
        });

        layerBtns.forEach((btn, lIdx) => {
          const isLayerAct = lIdx === activeItem.layerIndex;
          btn.classList.toggle('active', isLayerAct);
          btn.setAttribute('aria-selected', String(isLayerAct));
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

      planetBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const targetPlanetIdx = Number(btn.getAttribute('data-syn-planet') || 0);
          scrollToPage(targetPlanetIdx * 4);
        });
      });

      layerBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const targetLayerIdx = Number(btn.getAttribute('data-syn-layer') || 0);
          const currentPlanetIdx = slidesData[this.personalityPageIndex]?.planetIdx ?? 0;
          scrollToPage(currentPlanetIdx * 4 + targetLayerIdx);
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
      return;
    }
  }

  /**
   * Renders the Royal Star (Aldebaran, Regulus, Antares, Fomalhaut) analysis card
   * ONLY if the user's birth chart genuinely has at least one <=1°00' critical-degree
   * conjunction with a personal/social planet (Sun..Saturn) or primary angle (ASC, MC).
   * Returns empty string when the user's chart has no Royal Star conjunction.
   */
  private renderConditionalRoyalStarsSection(): string {
    const matchedStars = this.chart.royalStars.filter((s) => s.conjunctions.length > 0);
    if (matchedStars.length === 0) {
      return '';
    }

    const birthYear = this.birthInput.birthDate.split('-')[0] || '2000';

    return `
      <section class="royal-stars-module" aria-label="Doğum Haritası Kraliyet Yıldızı Özel Analizi">
        <div class="royal-stars-grid">
          ${matchedStars
            .map((star) => {
              const elColor = ELEMENT_COLORS[star.sign.element].primary;
              return `
                <article class="royal-star-card has-conjunction">
                  <div class="royal-star-card-top">
                    <div>
                      <div class="royal-star-direction">
                        <span>★ DOĞUM HARİTANIZDA KRALİYET YILDIZI MÜHRÜ</span>
                        <span>•</span>
                        <span>${star.persianTitle} (${star.archangel})</span>
                      </div>
                      <h3 class="royal-star-title">
                        <span style="color:#8C5A14;">★</span>
                        <span>${star.name}</span>
                        <span class="royal-star-sub">${star.constellation}</span>
                      </h3>
                    </div>
                    <span class="badge" style="background:#F7EFE0; color:#8C5A14; border-color:#DFC79C;">
                      Doğum Yılı (${birthYear}) Presesyon Derecesi: ${star.sign.glyph} ${star.fullFormatted}
                    </span>
                  </div>

                  <div class="royal-star-meta-bar">
                    <span class="profile-meta-chip">
                      <strong>Hesaplanan Kritik Derece:</strong>
                      <span style="color:${elColor}; font-weight:700;">${star.sign.glyph} ${star.fullFormatted}</span> (J2000 + Presesyon)
                    </span>
                    <span class="profile-meta-chip">
                      <strong>Placidus Evi:</strong> ${star.house}. Ev
                    </span>
                    <span class="profile-meta-chip">
                      <strong>Karakter:</strong> ${star.planetaryNature}
                    </span>
                  </div>

                  <div class="royal-star-conjunctions-list">
                    ${star.conjunctions
                      .map(
                        (conj) => `
                      <div class="royal-conj-detail-box ${conj.tier}">
                        <div class="royal-conj-detail-head">
                          <strong class="royal-conj-planet">${UI_ICONS.crown} <span>${conj.headline}</span></strong>
                          <span class="badge" style="background:#EAF3DE; color:#27500A; border-color:#C0DD97;">
                            Kavuşum (0°) Orb: ${conj.orbFormatted} • ${conj.tierLabel}
                          </span>
                        </div>

                        <div class="royal-conj-section">
                          <strong>${UI_ICONS.check} Haritanızdaki Kraliyet Vaadi &amp; Yükseliş Potansiyeli:</strong>
                          <p>${formatMarkdownBold(conj.promiseText)}</p>
                        </div>

                        <div class="royal-conj-section shadow">
                          <strong>${UI_ICONS.alert} Kraliyet Sınavı (Gölge Tuzağı / Nemesis):</strong>
                          <p>${formatMarkdownBold(conj.shadowTestText)}</p>
                        </div>

                        <div class="royal-conj-advice">
                          <strong>Zenith Kraliyet Tavsiyesi:</strong> ${formatMarkdownBold(conj.actionAdvice)}
                        </div>
                      </div>
                    `
                      )
                      .join('')}
                  </div>
                </article>
              `;
            })
            .join('')}
        </div>
      </section>
    `;
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

        <div style="display:flex; justify-content:flex-start; align-items:center; flex-wrap:wrap; gap:0.6rem; margin-top:0.25rem;">
          <button type="button" id="signout-account-btn" class="btn" style="color:#9C3A1C; border-color:#E5C4B0; background:#F9EBE5;">
            ${UI_ICONS.logout} <span>Hesaptan Çıkış Yap</span>
          </button>
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

  private renderNotificationsModalContent(): void {
    const inner = document.getElementById('cosmic-notifications-modal-inner');
    const modalEl = document.getElementById(
      'cosmic-notifications-modal'
    ) as HTMLDialogElement | null;
    if (!inner || !modalEl) return;

    const bundle = this.notificationsBundle;
    const isDailyTab = this.activeNotificationTab === 'daily';
    const activeItems = isDailyTab
      ? bundle.dailyNotifications
      : bundle.weeklyNotifications;

    inner.innerHTML = `
      <div class="dialog-header">
        <div>
          <h2 id="cosmic-notif-modal-title" style="font-size:1.08rem; font-weight:700; display:flex; align-items:center; gap:0.45rem;">
            ${UI_ICONS.bell}
            <span>Günlük &amp; Haftalık Kozmik Bildirimler</span>
          </h2>
          <p style="font-size:0.78rem; color:var(--text-secondary);">
            <strong>${this.birthInput.fullName || 'Doğum Haritanız'}</strong> için gerçek zamanlı ephemeris ve natal ev/açı eşleştirmeleriyle üretilen kişisel gökyüzü bildirimleri
          </p>
        </div>
        <button type="button" id="close-notif-modal-btn" class="btn btn-icon" aria-label="Bildirimleri Kapat">✕</button>
      </div>

      <!-- GÜNLÜK / HAFTALIK SEKME SEÇİCİ -->
      <div class="notif-tabs-bar" role="tablist" aria-label="Günlük ve Haftalık Bildirim Sekmeleri">
        <button
          type="button"
          role="tab"
          class="notif-tab-btn ${isDailyTab ? 'active' : ''}"
          data-notif-tab="daily"
          aria-selected="${isDailyTab}"
        >
          ${UI_ICONS.sparkle}
          <span>Günlük Bildirimler (${bundle.dailyNotifications.length})</span>
        </button>
        <button
          type="button"
          role="tab"
          class="notif-tab-btn ${!isDailyTab ? 'active' : ''}"
          data-notif-tab="weekly"
          aria-selected="${!isDailyTab}"
        >
          ${UI_ICONS.calendar}
          <span>Haftalık Bildirimler &amp; 7 Gün (${bundle.weeklyNotifications.length})</span>
        </button>
      </div>

      <div class="notif-cards-list">
        ${activeItems
          .map((item) => {
            const toneClass =
              item.tone === 'caution'
                ? 'caution'
                : item.tone === 'optimal'
                  ? 'optimal'
                  : 'info';
            return `
              <article class="notif-message-card ${toneClass}">
                <div class="notif-card-top">
                  <span class="notif-badge ${toneClass}">
                    ${item.tone === 'caution' ? UI_ICONS.alert : item.tone === 'optimal' ? UI_ICONS.star : UI_ICONS.compass}
                    <span>${item.badgeLabel}</span>
                  </span>
                  <span class="notif-date-chip">${item.dateLabel}</span>
                </div>

                <h3 class="notif-card-title">${item.title}</h3>

                <p class="notif-card-narrative">
                  ${formatMarkdownBold(item.narrative)}
                </p>

                <div class="notif-highlights-grid">
                  ${
                    item.favorableHighlights.length > 0
                      ? `
                    <div class="electional-day-topics-box optimal-topics-box">
                      <div class="electional-topics-heading optimal-heading">
                        ${UI_ICONS.check} <span>Uygun &amp; Desteklenen Konular:</span>
                      </div>
                      <ul class="electional-topics-list">
                        ${item.favorableHighlights.map((h) => `<li>${formatMarkdownBold(h)}</li>`).join('')}
                      </ul>
                    </div>
                  `
                      : ''
                  }

                  ${
                    item.cautionHighlights.length > 0
                      ? `
                    <div class="electional-day-topics-box caution-topics-box">
                      <div class="electional-topics-heading caution-heading">
                        ${UI_ICONS.alert} <span>Dikkat / Esneklik Gerektiren Noktalar:</span>
                      </div>
                      <ul class="electional-topics-list">
                        ${item.cautionHighlights.map((h) => `<li>${formatMarkdownBold(h)}</li>`).join('')}
                      </ul>
                    </div>
                  `
                      : ''
                  }
                </div>

                <div class="electional-day-advice-box ${item.tone === 'caution' ? 'caution-advice-box' : 'optimal-advice-box'}">
                  <strong>Zenith Tavsiyesi:</strong> ${formatMarkdownBold(item.adviceText)}
                </div>

                ${
                  item.targetDateIso && item.targetCategoryId
                    ? `
                  <div class="notif-card-actions">
                    <button
                      type="button"
                      class="btn btn-icon active notif-jump-calendar-btn"
                      data-jump-cat="${item.targetCategoryId}"
                      data-jump-iso="${item.targetDateIso}"
                    >
                      ${UI_ICONS.calendar}
                      <span>Kozmik Takvimde Bu Günü &amp; Tavsiyeyi Aç →</span>
                    </button>
                  </div>
                `
                    : `
                  <div class="notif-card-actions">
                    <button
                      type="button"
                      class="btn btn-icon notif-jump-livesky-btn"
                    >
                      ${UI_ICONS.compass}
                      <span>Canlı Gökyüzü Haritasında İncele →</span>
                    </button>
                  </div>
                `
                }
              </article>
            `;
          })
          .join('')}

        ${
          !isDailyTab
            ? `
          <div class="notif-weekly-digest-section">
            <div class="notif-digest-head">
              <strong>${UI_ICONS.calendar} <span>Önümüzdeki 7 Günün Gün-Gün Kozmik Pusulası (${bundle.generatedWeekRangeFormatted})</span></strong>
              <p>Herhangi bir güne dokunarak o günün tüm açı kanıtlarını ve detaylı tavsiye ekranını açabilirsiniz:</p>
            </div>
            <div class="notif-digest-list">
              ${bundle.weeklyDayDigest
                .map((d) => {
                  return `
                    <div
                      class="notif-digest-row ${d.verdict}"
                      role="button"
                      tabindex="0"
                      data-jump-cat="${d.bestCategoryId}"
                      data-jump-iso="${d.dateIso}"
                    >
                      <div class="notif-digest-row-top">
                        <div>
                          <strong class="notif-digest-date">${d.dateFormatted}</strong>
                          <span class="notif-digest-moon">☽ ${d.moonSignGlyph} ${d.moonSignName} (${d.moonNatalHouse}. Ev) • ${d.lunarPhaseName}</span>
                        </div>
                        <span class="badge ${d.verdict === 'caution' ? 'badge-retro' : ''}" style="${d.verdict === 'optimal' || d.verdict === 'favorable' ? 'color:#27500A; border-color:#C0DD97; background:#EAF3DE;' : ''}">
                          ${d.verdictLabel}
                        </span>
                      </div>
                      <p class="notif-digest-summary">${formatMarkdownBold(d.summaryText)}</p>
                      <div class="notif-digest-advice">
                        <strong>Tavsiye:</strong> ${formatMarkdownBold(d.adviceText)}
                      </div>
                    </div>
                  `;
                })
                .join('')}
            </div>
          </div>
        `
            : ''
        }
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; padding-block-start:0.45rem; border-block-start:1px solid var(--border-subtle);">
        <span style="font-size:0.75rem; color:var(--text-secondary);">
          Bildirimler her gün anlık gökyüzü ve doğum haritanıza göre otomatik güncellenir.
        </span>
        <button type="button" id="ok-notif-modal-btn" class="btn btn-primary">Kapat</button>
      </div>
    `;

    document.getElementById('close-notif-modal-btn')?.addEventListener('click', () => {
      modalEl.close();
    });
    document.getElementById('ok-notif-modal-btn')?.addEventListener('click', () => {
      modalEl.close();
    });

    inner.querySelectorAll('[data-notif-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-notif-tab') as 'daily' | 'weekly' | null;
        if (tab && tab !== this.activeNotificationTab) {
          this.activeNotificationTab = tab;
          this.renderNotificationsModalContent();
        }
      });
    });

    inner.querySelectorAll('.notif-jump-livesky-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        modalEl.close();
        this.activeMainView = 'live-sky';
        this.renderShell();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    inner.querySelectorAll('[data-jump-iso]').forEach((el) => {
      el.addEventListener('click', () => {
        const iso = el.getAttribute('data-jump-iso');
        const catId = el.getAttribute('data-jump-cat') as ElectionalCategoryId | null;
        if (!iso) return;
        modalEl.close();

        if (catId && ELECTIONAL_CATEGORIES[catId]) {
          this.electionalCategoryId = catId;
          this.electionalQueryText = ELECTIONAL_CATEGORIES[catId].sampleQuestion;
        }

        // Compute month offset between now and target iso
        const now = new Date();
        const [ty, tm] = iso.split('-').map(Number);
        this.electionalMonthOffset =
          (ty - now.getFullYear()) * 12 + (tm - 1 - now.getMonth());

        this.electionalResult = evaluateThirtyDayElectionalForecast(
          this.chart,
          this.electionalQueryText,
          this.electionalCategoryId,
          this.getElectionalBaseDate()
        );
        this.selectedElectionalDayIso = iso;
        this.activeMainView = 'cosmic-calendar';
        this.renderShell();
        this.openElectionalDayModal(iso);
      });
    });
  }

  private renderFullMoonModalContent(): void {
    const inner = document.getElementById('full-moon-modal-inner');
    const modalEl = document.getElementById(
      'full-moon-modal'
    ) as HTMLDialogElement | null;
    if (!inner || !modalEl) return;

    const fm = this.fullMoonReport;
    const exactDate = new Date(fm.exactUtcIso);

    inner.innerHTML = `
      <div class="dialog-header full-moon-dialog-header">
        <div class="full-moon-modal-title-group">
          <div class="full-moon-modal-badge-row">
            <span class="full-moon-pulsing-symbol modal-size" aria-hidden="true">${UI_ICONS.fullMoon}</span>
            <span class="full-moon-modal-status-pill ${fm.isCurrentlyActiveWindow ? 'active-orb' : 'upcoming'}">${fm.timingStatusLabel}</span>
            <span class="full-moon-modal-date-pill">${fm.exactDateFormatted} • ${fm.exactTimeFormatted}</span>
          </div>
          <h2 id="full-moon-modal-title">${fm.zenithHeadline}</h2>
          <p class="dialog-subtitle">
            Dolunay Konumu: <strong>${fm.fullMoonSignGlyph} ${fm.fullMoonSignName} (${fm.fullMoonDegreeFormatted})</strong> (${fm.fullMoonNatalHouse}. Ev: ${fm.fullMoonHouseTitle}) &bull;
            Karşıt Güneş: <strong>${fm.sunSignGlyph} ${fm.sunSignName} (${fm.sunDegreeFormatted})</strong> (${fm.sunNatalHouse}. Ev: ${fm.sunHouseTitle})
          </p>
        </div>
        <button id="close-full-moon-modal-btn" class="btn btn-icon" type="button" aria-label="Kapat">✕</button>
      </div>

      <div class="full-moon-modal-body">
        <!-- 1. Zenith Dolunay Mesajı (Core Narrative) -->
        <div class="full-moon-zenith-message-card">
          <div class="full-moon-card-kicker">
            ${UI_ICONS.sparkle}
            <span>ZENITH KİŞİSEL DOLUNAY MESAJI</span>
          </div>
          <p class="full-moon-core-narrative">${formatMarkdownBold(fm.zenithCoreNarrative)}</p>
          <div class="full-moon-axis-box">
            <strong>Ev Aksı &amp; Yöneticisi Bağlantısı (${fm.fullMoonNatalHouse}. Ev – ${fm.sunNatalHouse}. Ev | Yöneticisi ${fm.rulerGlyph} ${fm.rulerName} Natal ${fm.rulerNatalHouse}. Evde):</strong>
            <p>${formatMarkdownBold(fm.zenithAxisNarrative)}</p>
          </div>
        </div>

        <!-- 2. Doğum Haritası Gezegenleriyle Dolunay Açıları -->
        <div class="full-moon-section-card">
          <div class="full-moon-section-head">
            <strong>${UI_ICONS.compass} Doğum Haritanızla Dolunay Etkileşimleri</strong>
            <span>Dolunay derecesinin (${fm.fullMoonSignName} ${fm.fullMoonDegreeFormatted}) natal gezegen ve akslarınızla kurduğu gerçek astronomik açılar</span>
          </div>
          <div class="full-moon-aspects-list">
            ${fm.personalAspects
              .map(
                (asp) => `
              <div class="full-moon-aspect-item ${asp.tone === 'supportive' ? 'harmonious' : 'challenging'}">
                <div class="full-moon-aspect-top">
                  <span class="aspect-glyph-badge">${asp.badge}</span>
                  <span class="full-moon-aspect-meta">Orb: ${asp.orbFormatted}</span>
                </div>
                <strong class="full-moon-aspect-heading">${asp.title}</strong>
                <p class="full-moon-aspect-desc">${formatMarkdownBold(asp.explanation)}</p>
              </div>
            `
              )
              .join('')}
          </div>
        </div>

        <!-- 3. Neler Görünür Oluyor & Nelere Dikkat Edilmeli -->
        <div class="full-moon-dual-grid">
          <div class="full-moon-topic-box light">
            <div class="full-moon-topic-head">
              ${UI_ICONS.check}
              <strong>Bu Dolunayda Neler Görünür Oluyor?</strong>
            </div>
            <ul class="full-moon-topic-list">
              ${fm.whatComesToLight.map((item) => `<li>${formatMarkdownBold(item)}</li>`).join('')}
            </ul>
          </div>

          <div class="full-moon-topic-box caution">
            <div class="full-moon-topic-head">
              ${UI_ICONS.alert}
              <strong>Duygusal &amp; Stratejik Dikkat Noktaları</strong>
            </div>
            <ul class="full-moon-topic-list">
              ${fm.cautionNotes.map((item) => `<li>${formatMarkdownBold(item)}</li>`).join('')}
            </ul>
          </div>
        </div>

        <!-- 4. Zenith'in Bu Dolunay İçin Tavsiyesi -->
        <div class="full-moon-advice-banner">
          <div class="full-moon-advice-head">
            ${UI_ICONS.bell}
            <strong>Zenith Dolunay Tavsiyesi</strong>
          </div>
          <p>${formatMarkdownBold(fm.zenithAdvice)}</p>
        </div>

        <!-- 5. Sonraki Dolunay Takvimi -->
        <div class="full-moon-next-bar">
          <span>${UI_ICONS.calendar} Sonraki Dolunay: <strong>${fm.nextFullMoonSummary.dateFormatted}</strong> • ${fm.nextFullMoonSummary.signGlyph} ${fm.nextFullMoonSummary.signName} (${fm.nextFullMoonSummary.degreeFormatted}) — Natal ${fm.nextFullMoonSummary.natalHouse}. Evinizde</span>
        </div>
      </div>

      <div class="dialog-actions full-moon-dialog-actions">
        <button id="preview-full-moon-on-wheel-btn" class="btn btn-secondary" type="button">
          ${UI_ICONS.globe} <span>Dolunay Anını Canlı Haritada Göster (${fm.shortDateFormatted})</span>
        </button>
        <button id="ok-full-moon-modal-btn" class="btn btn-primary" type="button">Anlaşıldı</button>
      </div>
    `;

    document
      .getElementById('close-full-moon-modal-btn')
      ?.addEventListener('click', () => modalEl.close());
    document
      .getElementById('ok-full-moon-modal-btn')
      ?.addEventListener('click', () => modalEl.close());
    document
      .getElementById('preview-full-moon-on-wheel-btn')
      ?.addEventListener('click', () => {
        modalEl.close();
        this.isPreviewingFutureDate = true;
        this.activeMainView = 'live-sky';
        this.recalculateChart(exactDate);
        this.renderShell();
        window.scrollTo({ top: 0, behavior: 'smooth' });
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

    if (pwaModal) {
      this.setupDialogLightDismissFallback(pwaModal);
      closePwaBtn?.addEventListener('click', () => pwaModal.close());
      okPwaBtn?.addEventListener('click', () => pwaModal.close());
    }

    const appGuideModal = document.getElementById(
      'app-guide-modal'
    ) as HTMLDialogElement | null;
    const openGuideBtn = document.getElementById('open-app-guide-btn');
    const closeGuideBtn = document.getElementById('close-app-guide-modal-btn');
    const okGuideBtn = document.getElementById('ok-app-guide-modal-btn');

    if (appGuideModal) {
      this.setupDialogLightDismissFallback(appGuideModal);
      openGuideBtn?.addEventListener('click', () => appGuideModal.showModal());
      closeGuideBtn?.addEventListener('click', () => appGuideModal.close());
      okGuideBtn?.addEventListener('click', () => appGuideModal.close());
    }

    const notifModal = document.getElementById(
      'cosmic-notifications-modal'
    ) as HTMLDialogElement | null;
    const openNotifBtn = document.getElementById('open-notifications-btn');

    if (notifModal) {
      this.setupDialogLightDismissFallback(notifModal);
      openNotifBtn?.addEventListener('click', () => {
        this.markNotificationsSeen();
        this.renderNotificationsModalContent();
        notifModal.showModal();
      });
    }

    const fullMoonModal = document.getElementById(
      'full-moon-modal'
    ) as HTMLDialogElement | null;
    const openFullMoonBtn = document.getElementById('open-full-moon-modal-btn');

    if (fullMoonModal) {
      this.setupDialogLightDismissFallback(fullMoonModal);
      openFullMoonBtn?.addEventListener('click', () => {
        this.renderFullMoonModalContent();
        fullMoonModal.showModal();
      });
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

    pwaInstallBtn?.addEventListener('click', async () => {
      await this.saveProfile(this.birthInput);
      if (this.deferredInstallPrompt) {
        await this.deferredInstallPrompt.prompt();
        this.deferredInstallPrompt = null;
      } else {
        pwaModal?.showModal();
      }
    });

    // 3. Contact & Support Box (hi@usecomus.com) Infrastructure
    const copySupportEmailBtn = document.getElementById('copy-support-email-btn');
    copySupportEmailBtn?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText('hi@usecomus.com');
        copySupportEmailBtn.innerHTML = `${UI_ICONS.check} <span>hi@usecomus.com Kopyalandı!</span>`;
      } catch {
        copySupportEmailBtn.innerHTML = `${UI_ICONS.mail} <span>hi@usecomus.com</span>`;
      }
    });

    const contactForm = document.getElementById('contact-support-form') as HTMLFormElement | null;
    const directMailtoLink = document.getElementById('direct-mailto-link') as HTMLAnchorElement | null;
    const contactFeedbackBox = document.getElementById('contact-feedback-box');

    const buildMailtoHref = (): { mailtoUrl: string; senderName: string; senderEmail: string; subject: string; message: string } => {
      const senderName =
        (document.getElementById('contact-sender-name') as HTMLInputElement | null)?.value.trim() ||
        this.birthInput.fullName ||
        'Zenith Kullanıcısı';
      const senderEmail =
        (document.getElementById('contact-sender-email') as HTMLInputElement | null)?.value.trim() ||
        this.authState.currentUser?.email ||
        '';
      const subject =
        (document.getElementById('contact-subject') as HTMLInputElement | null)?.value.trim() ||
        'Zenith — İletişim & Destek';
      const message =
        (document.getElementById('contact-message') as HTMLTextAreaElement | null)?.value.trim() ||
        '';

      const composedBody = [
        message || 'Merhaba Zenith Ekibi,',
        '',
        '---',
        `Gönderen: ${senderName}${senderEmail ? ` (${senderEmail})` : ''}`,
        `Aktif Harita: ${this.birthInput.fullName} • ${this.birthInput.birthDate} ${this.birthInput.birthTime} • ${this.birthInput.location.name}`
      ].join('\r\n');

      const mailtoUrl = `mailto:hi@usecomus.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(composedBody)}`;
      return { mailtoUrl, senderName, senderEmail, subject, message };
    };

    ['contact-sender-name', 'contact-sender-email', 'contact-subject', 'contact-message'].forEach((id) => {
      document.getElementById(id)?.addEventListener('input', () => {
        if (directMailtoLink) {
          directMailtoLink.href = buildMailtoHref().mailtoUrl;
        }
      });
    });

    contactForm?.addEventListener('submit', async (e: SubmitEvent) => {
      e.preventDefault();
      const { mailtoUrl, senderName, senderEmail, subject, message } = buildMailtoHref();

      if (!message) {
        if (contactFeedbackBox) {
          contactFeedbackBox.className = 'auth-alert error';
          contactFeedbackBox.innerHTML = `${UI_ICONS.alert} <span>Lütfen göndermek istediğiniz mesajı yazınız.</span>`;
          contactFeedbackBox.hidden = false;
        }
        document.getElementById('contact-message')?.focus();
        return;
      }

      const submitBtn = document.getElementById('contact-submit-btn') as HTMLButtonElement | null;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `${UI_ICONS.mail} <span>hi@usecomus.com Adresine İletiliyor...</span>`;
      }

      let relayDelivered = false;
      try {
        const res = await fetch('https://formsubmit.co/ajax/hi@usecomus.com', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify({
            name: senderName,
            email: senderEmail || 'kullanici@zenith.app',
            _subject: subject,
            message,
            birthChart: `${this.birthInput.fullName} (${this.birthInput.birthDate} ${this.birthInput.birthTime} - ${this.birthInput.location.name})`
          })
        });
        if (res.ok) {
          relayDelivered = true;
        }
      } catch {
        relayDelivered = false;
      }

      // Open default mail client addressed to hi@usecomus.com with pre-filled subject & body
      window.location.href = mailtoUrl;

      if (contactFeedbackBox) {
        contactFeedbackBox.className = 'auth-alert success';
        contactFeedbackBox.innerHTML = relayDelivered
          ? `${UI_ICONS.check} <span>Mesajınız <strong>hi@usecomus.com</strong> adresine başarıyla iletildi ve e-posta istemciniz hazırlandı.</span>`
          : `${UI_ICONS.check} <span>Mesajınız <strong>hi@usecomus.com</strong> alıcısıyla e-posta uygulamanızda gönderime hazır olarak açıldı.</span>`;
        contactFeedbackBox.hidden = false;
      }

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `${UI_ICONS.mail} <span>hi@usecomus.com Adresine Gönder</span>`;
      }
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
