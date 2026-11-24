import React, { useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Cloud,
  Eye,
  EyeOff,
  HardDrive,
  Lock,
  LogIn,
  Mail,
  Moon,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sun,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import { GlidingTabs, StatusButton } from './AnimateUI';
import { HeroCanvas } from './HeroCanvas';
import { LandingContent } from './LandingContent';
import {
  registerEmailPassword,
  signInEmailPassword,
  signInWithGooglePopup,
} from '../lib/firebase';
import {
  serverGetQuickAccounts,
  serverQuickLogin,
  serverRemoveQuickAccount,
  type ReplacedQuickAccountInfo,
} from '../lib/serverAuth';
import {
  MAX_QUICK_LOGIN_ACCOUNTS,
  mergeQuickAccounts,
  readDeviceGuestProfile,
  readGoogleQuickAccounts,
  removeGoogleQuickAccount,
} from '../lib/storage';
import type {
  DeviceGuestProfile,
  FinancialStatePayload,
  SavedQuickAccount,
  UserAccount,
} from '../types/finance';

const EDITORIAL_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const SYNAPSE_EASE: [number, number, number, number] = [0.23, 1, 0.32, 1];

const HERO_TICKER_ITEMS: ReadonlyArray<{
  label: string;
  value: string;
  tone: 'light' | 'emerald' | 'gold';
}> = [
  { label: 'TÀI SẢN RÒNG', value: 'NAV Thời gian thực', tone: 'emerald' },
  { label: 'ĐẦU TƯ', value: 'Chứng khoán VN & Crypto', tone: 'light' },
  { label: 'GIÁ VỐN', value: 'Bình quân theo từng lô', tone: 'gold' },
  { label: 'NGÂN SÁCH', value: 'Dự báo & Cảnh báo sớm', tone: 'light' },
  { label: 'ĐĂNG NHẬP NHANH', value: 'Tối đa 3 Tài khoản', tone: 'emerald' },
  { label: 'TÀI KHOẢN KHÁCH', value: 'Lưu riêng theo Thiết bị', tone: 'light' },
  { label: 'ĐỒNG BỘ', value: 'Cloud Firestore Riêng biệt', tone: 'gold' },
  { label: 'BÁO CÁO', value: 'Xuất CSV Chuẩn Excel', tone: 'light' },
];

export function AuthScreen({
  onServerAuthSuccess,
  onGuestMode,
  showToast,
  theme = 'light',
  onToggleTheme,
  reducedMotion = false,
  heroBackground,
}: {
  onServerAuthSuccess: (user: UserAccount, initialState: FinancialStatePayload | null) => void;
  onGuestMode: (mode?: 'CONTINUE' | 'CREATE_NEW') => void;
  showToast: (msg: string, type?: 'success' | 'warning' | 'error') => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  reducedMotion?: boolean;
  heroBackground?: React.ReactNode;
}) {
  // Landing modal & header scroll state
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [scrolledPastHero, setScrolledPastHero] = useState(false);

  // Quick-login & device-bound guest state
  const [quickAccounts, setQuickAccounts] = useState<SavedQuickAccount[]>([]);
  const [deviceGuest, setDeviceGuest] = useState<DeviceGuestProfile | null>(() =>
    readDeviceGuestProfile()
  );
  const [quickBusyUid, setQuickBusyUid] = useState<string | null>(null);
  const [confirmResetGuest, setConfirmResetGuest] = useState(false);

  // Auth form state
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [modeDir, setModeDir] = useState(1);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    displayName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [shakeTick, setShakeTick] = useState(0);

  const isDark = theme === 'dark';
  const isAnyAuthBusy = googleBusy || emailBusy || quickBusyUid !== null;

  const refreshQuickAccess = async () => {
    setDeviceGuest(readDeviceGuestProfile());
    const googleList = readGoogleQuickAccounts();
    const serverList = await serverGetQuickAccounts();
    setQuickAccounts(mergeQuickAccounts(serverList, googleList));
  };

  useEffect(() => {
    let active = true;
    setDeviceGuest(readDeviceGuestProfile());
    serverGetQuickAccounts().then((serverList) => {
      if (!active) return;
      setQuickAccounts(mergeQuickAccounts(serverList, readGoogleQuickAccounts()));
    });
    return () => {
      active = false;
    };
  }, [authModalOpen]);

  // Adapt top navigation surface once scrolled past the dark Galaxy hero
  useEffect(() => {
    const onScroll = () => {
      setScrolledPastHero(window.scrollY > Math.max(260, window.innerHeight * 0.62));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock body scroll & handle Escape key while Auth Modal is open
  useEffect(() => {
    if (!authModalOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isAnyAuthBusy) {
        setAuthModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [authModalOpen, isAnyAuthBusy]);

  const openAuthModal = (targetMode: 'LOGIN' | 'REGISTER') => {
    setMode(targetMode);
    setModeDir(targetMode === 'REGISTER' ? 1 : -1);
    setErrorMsg('');
    setFieldErrors({});
    setConfirmResetGuest(false);
    setAuthModalOpen(true);
    void refreshQuickAccess();
  };

  const closeAuthModal = () => {
    if (isAnyAuthBusy) return;
    setConfirmResetGuest(false);
    setAuthModalOpen(false);
  };

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (!el) return;
    el.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  };

  const triggerFieldError = (
    errorsObj: {
      displayName?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    },
    bannerMsg = ''
  ) => {
    setFieldErrors(errorsObj);
    setErrorMsg(bannerMsg);
    setShakeTick((t) => t + 1);
  };

  const handleModeChange = (nextMode: string) => {
    const typed = nextMode === 'REGISTER' ? 'REGISTER' : 'LOGIN';
    if (typed === mode) return;
    setModeDir(typed === 'REGISTER' ? 1 : -1);
    setMode(typed);
    setErrorMsg('');
    setFieldErrors({});
  };

  const mapGoogleError = (err: unknown): string => {
    const code = (err as { code?: string })?.code || '';
    switch (code) {
      case 'auth/popup-closed-by-user':
        return 'Cửa sổ đăng nhập Google đã được đóng trước khi hoàn tất.';
      case 'auth/popup-blocked':
        return 'Trình duyệt đang chặn cửa sổ bật lên. Vui lòng cho phép popup để đăng nhập Google.';
      case 'auth/network-request-failed':
        return 'Không thể kết nối máy chủ Google. Vui lòng kiểm tra kết nối mạng.';
      default:
        return err instanceof Error ? err.message : 'Không thể xác thực Google lúc này.';
    }
  };

  const enforceCombinedQuickCap = (
    serverAccounts: SavedQuickAccount[] | undefined,
    serverReplaced: ReplacedQuickAccountInfo | null | undefined,
    currentUid: string
  ): string | null => {
    let replacedLabel: string | null = serverReplaced
      ? serverReplaced.displayName || serverReplaced.email
      : null;

    const srvList = Array.isArray(serverAccounts) ? serverAccounts : [];
    const googleList = readGoogleQuickAccounts();
    const combinedMap = new Map<string, SavedQuickAccount>();
    [...srvList, ...googleList].forEach((acc) => {
      const prev = combinedMap.get(acc.uid);
      if (!prev || acc.lastUsedAt > prev.lastUsedAt) {
        combinedMap.set(acc.uid, acc);
      }
    });
    const combined = Array.from(combinedMap.values());
    if (combined.length > MAX_QUICK_LOGIN_ACCOUNTS) {
      const googleCandidates = combined
        .filter((acc) => acc.uid !== currentUid && acc.authProvider === 'google')
        .sort((a, b) => a.lastUsedAt - b.lastUsedAt);
      const overflow = combined.length - MAX_QUICK_LOGIN_ACCOUNTS;
      for (let i = 0; i < overflow && i < googleCandidates.length; i++) {
        const victim = googleCandidates[i];
        removeGoogleQuickAccount(victim.uid);
        if (!replacedLabel) {
          replacedLabel = victim.displayName || victim.email;
        }
      }
    }
    return replacedLabel;
  };

  const handleGoogleSignIn = async (loginHint?: string) => {
    setErrorMsg('');
    setFieldErrors({});
    setGoogleBusy(true);
    try {
      const user = await signInWithGooglePopup(loginHint);
      setAuthModalOpen(false);
      showToast(`Xin chào ${user.displayName || user.email || 'bạn'}, phiên làm việc đã sẵn sàng.`);
    } catch (err) {
      const msg = mapGoogleError(err);
      setErrorMsg(msg);
      setShakeTick((t) => t + 1);
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleQuickLogin = async (acc: SavedQuickAccount) => {
    setErrorMsg('');
    setFieldErrors({});
    setQuickBusyUid(acc.uid);
    try {
      if (acc.authProvider === 'google') {
        const user = await signInWithGooglePopup(acc.email);
        setAuthModalOpen(false);
        showToast(`Đã đăng nhập nhanh vào tài khoản ${user.displayName || acc.displayName}.`);
      } else {
        const result = await serverQuickLogin(acc.uid);
        setAuthModalOpen(false);
        onServerAuthSuccess(result.user, result.state);
        showToast(`Đã đăng nhập nhanh vào tài khoản ${result.user.displayName || acc.email}.`);
      }
    } catch (err) {
      const msg =
        acc.authProvider === 'google'
          ? mapGoogleError(err)
          : err instanceof Error
            ? err.message
            : 'Không thể đăng nhập nhanh tài khoản này. Vui lòng nhập email và mật khẩu.';
      setErrorMsg(msg);
      setShakeTick((t) => t + 1);
      void refreshQuickAccess();
    } finally {
      setQuickBusyUid(null);
    }
  };

  const handleRemoveQuickAccount = async (acc: SavedQuickAccount) => {
    if (isAnyAuthBusy) return;
    try {
      if (acc.authProvider === 'google') {
        const nextGoogle = removeGoogleQuickAccount(acc.uid);
        const srv = await serverGetQuickAccounts();
        setQuickAccounts(mergeQuickAccounts(srv, nextGoogle));
      } else {
        const nextSrv = await serverRemoveQuickAccount(acc.uid);
        setQuickAccounts(mergeQuickAccounts(nextSrv, readGoogleQuickAccounts()));
      }
      showToast(`Đã gỡ ${acc.displayName || acc.email} khỏi danh sách đăng nhập nhanh.`);
    } catch {
      showToast('Không thể gỡ tài khoản khỏi danh sách lúc này.', 'warning');
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setFieldErrors({});

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = displayName.trim();
    const nextErrs: {
      displayName?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    } = {};

    if (mode === 'REGISTER' && cleanName.length > 80) {
      nextErrs.displayName = 'Tên hiển thị tối đa 80 ký tự.';
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      nextErrs.email = 'Vui lòng nhập địa chỉ email hợp lệ.';
    }
    if (password.length < 6) {
      nextErrs.password = 'Mật khẩu cần tối thiểu 6 ký tự.';
    } else if (password.length > 128) {
      nextErrs.password = 'Mật khẩu tối đa 128 ký tự.';
    }
    if (mode === 'REGISTER' && password !== confirmPassword) {
      nextErrs.confirmPassword = 'Mật khẩu xác nhận chưa khớp.';
    }

    if (Object.keys(nextErrs).length > 0) {
      triggerFieldError(nextErrs, Object.values(nextErrs)[0]);
      return;
    }

    setEmailBusy(true);
    try {
  if (mode === 'REGISTER') {
    await registerEmailPassword(
      cleanEmail,
      password,
      cleanName || cleanEmail.split('@')[0]
    );
    setAuthModalOpen(false);
    showToast(
      `Đã tạo tài khoản ${cleanName || cleanEmail.split('@')[0]}! Dữ liệu của bạn được đồng bộ trực tiếp lên Cloud Firestore.`
    );
  } else {
    await signInEmailPassword(cleanEmail, password);
    setAuthModalOpen(false);
    showToast(`Đã đăng nhập vào tài khoản ${cleanEmail}.`);
  }
} catch (err) {
  const code = (err as { code?: string })?.code || '';
  let msg = err instanceof Error ? err.message : 'Không thể xác thực tài khoản lúc này.';
  if (code === 'auth/email-already-in-use') msg = 'Email này đã được đăng ký tài khoản.';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    msg = 'Email hoặc mật khẩu chưa chính xác.';
  }
  triggerFieldError({}, msg);
} finally {
  setEmailBusy(false);
}
  };

  const inputBase =
    'w-full pl-9 pr-3 py-2.5 rounded-lg border text-sm text-[#141413] dark:text-[#ECEBE6] bg-[#F6F5F1]/60 dark:bg-[#0D1117]/70 placeholder:text-[#8E8C84] dark:placeholder:text-[#667182] focus:outline-none focus:ring-2 transition-colors';
  const inputNormal =
    'border-[#E4E2DB] dark:border-[#262F3D] focus:border-[#0E5A4F] dark:focus:border-[#38B29A] focus:ring-[#0E5A4F]/15 dark:focus:ring-[#38B29A]/20 focus:bg-white dark:focus:bg-[#0D1117]';
  const inputErr =
    'border-[#BE123C] dark:border-[#FB7185] ring-2 ring-[#BE123C]/15 dark:ring-[#FB7185]/20 bg-[#FFF1F3]/40 dark:bg-[#2A141A]/40';

  return (
    <MotionConfig reducedMotion={reducedMotion ? 'always' : 'user'}>
      <div className="min-h-screen bg-[#F6F5F1] dark:bg-[#0D1117] text-[#141413] dark:text-[#ECEBE6] transition-colors duration-200">
        {/* Floating Centered Glass Navigation Pill (Synapse-Inspired 3-Zone Top Bar) */}
        <header
          className={`fixed top-4 sm:top-5 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-24px)] max-w-[780px] rounded-full border transition-[background-color,border-color,color,box-shadow] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${
            scrolledPastHero
              ? 'bg-[#F6F5F1]/92 dark:bg-[#0B0F16]/90 backdrop-blur-md border-[#E4E2DB] dark:border-white/12 text-[#141413] dark:text-[#ECEBE6] shadow-[0_12px_32px_-12px_rgba(14,20,28,0.16)] dark:shadow-[0_16px_40px_-14px_rgba(0,0,0,0.72)]'
              : 'bg-[#080B10]/88 border-white/12 text-[#ECEBE6] shadow-[0_14px_40px_-14px_rgba(56,178,154,0.28)]'
          }`}
        >
          <div className="px-4 sm:px-5 h-13 sm:h-14 flex items-center justify-between gap-4 sm:gap-6">
            {/* Zone 1: Single-line Brand Wordmark */}
            <button
              type="button"
              onClick={() => scrollToSection('hero')}
              className="font-display text-lg sm:text-xl font-semibold tracking-tight whitespace-nowrap shrink-0"
            >
              Fin
              <span
                className={
                  scrolledPastHero
                    ? 'text-[#0E5A4F] dark:text-[#38B29A]'
                    : 'text-[#38B29A]'
                }
              >
                Flow
              </span>
            </button>

            {/* Zone 2: Clean Single-Line Section Links */}
            <nav
              aria-label="Điều hướng trang giới thiệu"
              className="hidden md:flex items-center gap-6 text-xs font-medium"
            >
              {[
                { id: 'about', label: 'Giới thiệu' },
                { id: 'why-finflow', label: 'Vì sao chọn' },
                { id: 'applications', label: 'Tính năng' },
                { id: 'security', label: 'Bảo mật' },
              ].map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => scrollToSection(link.id)}
                  className={`whitespace-nowrap shrink-0 transition-colors duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${
                    scrolledPastHero
                      ? 'text-[#63625C] dark:text-[#8E98A8] hover:text-[#141413] dark:hover:text-[#ECEBE6]'
                      : 'text-[#A5B1C2] hover:text-white'
                  }`}
                >
                  {link.label}
                </button>
              ))}
            </nav>

            {/* Zone 3: Compact Theme + Login / Register Pill Actions */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {onToggleTheme && (
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className={`aui-btn w-8 h-8 rounded-full border flex items-center justify-center transition-colors shrink-0 ${
                    scrolledPastHero
                      ? 'bg-white dark:bg-[#151B23] border-[#E4E2DB] dark:border-white/12 text-[#141413] dark:text-[#ECEBE6] hover:border-[#0E5A4F]/60 dark:hover:border-[#38B29A]/60'
                      : 'bg-white/[0.04] border-white/12 text-[#ECEBE6] hover:border-white/25 hover:bg-white/[0.08]'
                  }`}
                  title={isDark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang chế độ Tối dịu mắt'}
                  aria-label={isDark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang chế độ Tối'}
                >
                  {isDark ? (
                    <Sun className="w-3.5 h-3.5 text-[#E2B05E]" />
                  ) : (
                    <Moon className="w-3.5 h-3.5 text-[#38B29A]" />
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => openAuthModal('LOGIN')}
                className={`aui-btn px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                  scrolledPastHero
                    ? 'text-[#141413] dark:text-[#ECEBE6] hover:bg-[#141413]/5 dark:hover:bg-white/8'
                    : 'text-[#D7DFE9] hover:text-white hover:bg-white/8'
                }`}
              >
                <LogIn className="w-3.5 h-3.5 hidden sm:block" />
                <span>Đăng nhập</span>
              </button>

              <button
                type="button"
                onClick={() => openAuthModal('REGISTER')}
                className={`aui-btn px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                  scrolledPastHero
                    ? 'bg-[#0E5A4F] hover:bg-[#0A463D] dark:bg-[#F6F5F1] dark:hover:bg-white text-white dark:text-[#05080D]'
                    : 'bg-[#F6F5F1] hover:bg-white text-[#05080D]'
                }`}
              >
                <span>Đăng ký</span>
              </button>
            </div>
          </div>
        </header>

        <main>
          {/* SECTION 1: VANTABLACK SYNAPSE EMERALD 3D ORB + FLOATING AMBIENT ORBS HERO */}
          <section
            id="hero"
            className="relative min-h-screen pt-20 bg-[#030508] text-[#F6F5F1] flex flex-col justify-between overflow-hidden"
          >
            {/* Layer 0: React Three Fiber + Drei Abstract Emerald 3D Orb & Subtle Starfield */}
            <div className="pointer-events-none absolute inset-0 z-0">
              {heroBackground ?? <HeroCanvas reducedMotion={reducedMotion} />}
            </div>

            {/* Layer 1: Floating Ambient Radial Glow Orbs (GPU Transform Only) */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
              <div
                className="finflow-orb-a absolute -top-28 left-1/2 -ml-[320px] w-[640px] h-[520px] rounded-full"
                style={{
                  background:
                    'radial-gradient(circle at 50% 45%, rgba(56, 178, 154, 0.2) 0%, rgba(14, 90, 79, 0.08) 42%, rgba(3, 5, 8, 0) 72%)',
                }}
              />
              <div
                className="finflow-orb-b absolute -bottom-24 -left-24 w-[520px] h-[520px] rounded-full"
                style={{
                  background:
                    'radial-gradient(circle at 50% 50%, rgba(226, 176, 94, 0.14) 0%, rgba(180, 123, 43, 0.05) 44%, rgba(3, 5, 8, 0) 72%)',
                }}
              />
            </div>

            {/* Layer 2: Editorial Contrast Vignette (Frames the Emerald 3D Orb & Protects Text Contrast) */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-[2]"
              style={{
                background:
                  'radial-gradient(ellipse 64% 56% at 50% 46%, rgba(3, 5, 8, 0.28) 0%, rgba(3, 5, 8, 0.56) 58%, rgba(3, 5, 8, 0.92) 100%)',
              }}
            />

            {/* Layer 3: Centered Massive Editorial Focal Stage */}
            <div className="relative z-10 flex-1 w-full max-w-[980px] mx-auto px-4 sm:px-6 py-16 sm:py-24 flex flex-col items-center justify-center text-center">
              <motion.p
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.48, delay: 0.04, ease: SYNAPSE_EASE }}
                className="text-[10.5px] sm:text-xs font-medium tracking-[0.07em] sm:tracking-[0.2em] whitespace-nowrap text-[#38B29A] mb-5 sm:mb-6"
              >
                Nền tảng Quản trị Tài sản &amp; Thu Chi Cá nhân
              </motion.p>

              <motion.h1
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.56, delay: 0.12, ease: SYNAPSE_EASE }}
                className="font-display text-[clamp(3.5rem,15vw,6.625rem)] font-semibold tracking-[-0.04em] leading-[0.94] whitespace-nowrap text-[#F6F5F1]"
              >
                Fin<span className="finflow-hero-shimmer">Flow</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.54, delay: 0.2, ease: SYNAPSE_EASE }}
                className="mt-4 sm:mt-5 font-display text-[clamp(1.15rem,4.6vw,2.125rem)] font-medium tracking-[-0.02em] whitespace-nowrap text-[#E2B05E]"
              >
                “Chính xác, tiện dụng, tiết kiệm”
              </motion.p>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.52, delay: 0.28, ease: SYNAPSE_EASE }}
                className="mt-4 sm:mt-5 max-w-[340px] sm:max-w-[560px] text-[13px] sm:text-base text-[#A8B3C4] leading-relaxed text-balance"
              >
                Hợp nhất tài sản thực tế, giá vốn đầu tư và dòng tiền thu chi hằng tháng trên một
                sổ cái rõ nét — dễ theo dõi mỗi ngày và tự động lưu riêng cho từng tài&nbsp;khoản.
              </motion.p>

              {/* Signature Synapse-Style Shiny Border CTA + Minimal Guest Action */}
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.54, delay: 0.36, ease: SYNAPSE_EASE }}
                className="mt-8 sm:mt-10 flex flex-row flex-wrap items-center justify-center gap-2.5 sm:gap-4"
              >
                <button
                  type="button"
                  onClick={() => openAuthModal('REGISTER')}
                  className="finflow-shiny-btn group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#38B29A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#030508]"
                >
                  <span className="finflow-shiny-inner px-5 sm:px-8 py-3 sm:py-3.5 text-xs sm:text-sm font-semibold whitespace-nowrap">
                    <span>Bắt đầu miễn phí</span>
                    <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#38B29A] transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5" />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onGuestMode('CONTINUE')}
                  className="aui-btn px-4 sm:px-6 py-3 sm:py-3.5 rounded-full bg-white/[0.04] hover:bg-white/[0.09] border border-white/12 hover:border-white/25 text-[#DCE3EC] hover:text-white text-xs sm:text-sm font-medium whitespace-nowrap transition-colors duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]"
                >
                  {deviceGuest ? 'Tiếp tục Tài khoản khách' : 'Vào Tài khoản khách'}
                </button>
              </motion.div>
            </div>

            {/* Minimal Bottom Scroll Cue */}
            <div className="relative z-10 pb-6 flex justify-center">
              <button
                type="button"
                onClick={() => scrollToSection('about')}
                className="group flex flex-col items-center gap-1.5 text-xs text-[#8D99AC] hover:text-[#F6F5F1] transition-colors duration-200"
                aria-label="Cuộn xuống phần giới thiệu FinFlow"
              >
                <span className="text-[11px] font-medium tracking-wide">Tìm hiểu thêm</span>
                <span className="w-7 h-7 rounded-full border border-white/15 group-hover:border-[#38B29A] flex items-center justify-center transition-colors">
                  <ArrowDown className="w-3.5 h-3.5 text-[#38B29A]" />
                </span>
              </button>
            </div>

            {/* INFINITE HORIZONTAL FINFLOW HIGHLIGHTS TICKER */}
            <div
              aria-label="Điểm nổi bật của FinFlow"
              className={`finflow-ticker-wrap relative z-10 w-full bg-[#05080D]/95 border-y border-white/10 py-3.5 ${
                reducedMotion ? 'overflow-x-auto' : 'overflow-hidden'
              }`}
            >
              {/* Subtle Left & Right Edge Fade Masks */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 w-16 sm:w-28 z-10"
                style={{
                  background: 'linear-gradient(90deg, #05080D 0%, rgba(5, 8, 13, 0) 100%)',
                }}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-0 w-16 sm:w-28 z-10"
                style={{
                  background: 'linear-gradient(270deg, #05080D 0%, rgba(5, 8, 13, 0) 100%)',
                }}
              />

              <div className="finflow-ticker-track">
                {[0, 1].map((dupIndex) => (
                  <div
                    key={dupIndex}
                    aria-hidden={dupIndex === 1}
                    className="flex items-center shrink-0"
                  >
                    {HERO_TICKER_ITEMS.map((item) => (
                      <div
                        key={`${dupIndex}-${item.label}`}
                        className="flex items-center gap-8 px-6 sm:px-8 shrink-0"
                      >
                        <div className="flex flex-col leading-tight">
                          <span className="font-num text-[10px] tracking-[0.18em] text-[#7D8A9D] whitespace-nowrap">
                            {item.label}
                          </span>
                          <span
                            className={`font-num text-xs sm:text-sm font-medium whitespace-nowrap mt-0.5 ${
                              item.tone === 'emerald'
                                ? 'text-[#38B29A]'
                                : item.tone === 'gold'
                                  ? 'text-[#E2B05E]'
                                  : 'text-[#F6F5F1]'
                            }`}
                          >
                            {item.value}
                          </span>
                        </div>
                        <span aria-hidden="true" className="h-6 w-px bg-white/10 shrink-0" />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* VERTICAL SCROLL LANDING SECTIONS & QUIET FOOTER */}
          <LandingContent
            deviceGuest={deviceGuest}
            onOpenAuthModal={openAuthModal}
            onGuestMode={onGuestMode}
            onScrollToSection={scrollToSection}
            showToast={showToast}
            isDark={isDark}
            reducedMotion={reducedMotion}
          />
        </main>

        {/* FLOATING AUTH MODAL (Triggered from Top-Right Login/Register or CTAs) */}
        <AnimatePresence>
          {authModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#090D14]/78 overflow-y-auto"
              role="dialog"
              aria-modal="true"
              aria-labelledby="finflow-auth-modal-title"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  closeAuthModal();
                }
              }}
            >
              <motion.div
                initial={{ opacity: 0, y: 18, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.97 }}
                transition={{ duration: 0.24, ease: EDITORIAL_EASE }}
                className="relative w-full max-w-[460px] my-auto bg-white dark:bg-[#151B23] rounded-xl border border-[#E4E2DB] dark:border-[#262F3D] p-6 sm:p-7 space-y-5 shadow-[0_32px_80px_-20px_rgba(0,0,0,0.55)]"
              >
                <button
                  type="button"
                  onClick={closeAuthModal}
                  disabled={isAnyAuthBusy}
                  aria-label="Đóng hộp thoại đăng nhập"
                  className="absolute right-4 top-4 p-1.5 rounded-lg text-[#63625C] dark:text-[#8E98A8] hover:text-[#141413] dark:hover:text-[#ECEBE6] hover:bg-[#F6F5F1] dark:hover:bg-[#1C2430] transition-colors disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="space-y-1 pr-7">
                  <p className="text-[11px] font-semibold tracking-[0.12em] text-[#0E5A4F] dark:text-[#38B29A]">
                    FinFlow · Sổ cái cá nhân
                  </p>
                  <h2
                    id="finflow-auth-modal-title"
                    className="font-display text-xl font-semibold text-[#141413] dark:text-[#ECEBE6]"
                  >
                    {mode === 'LOGIN' ? 'Mở sổ tài sản của bạn' : 'Tạo tài khoản mới'}
                  </h2>
                  <p className="text-xs text-[#63625C] dark:text-[#8E98A8]">
                    {mode === 'LOGIN'
                      ? 'Chọn tài khoản đã lưu để vào nhanh hoặc đăng nhập bằng Google, Email.'
                      : 'Mọi dữ liệu bạn cập nhật sẽ được lưu riêng cho tài khoản cá nhân của bạn.'}
                  </p>
                </div>

                {/* Quick-Login Saved Accounts (Up to 3 personal accounts on this device) */}
                {quickAccounts.length > 0 && (
                  <div className="space-y-2 pb-4 border-b border-[#E4E2DB] dark:border-[#262F3D]">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold tracking-[0.06em] text-[#0E5A4F] dark:text-[#38B29A]">
                        Đăng nhập nhanh · {quickAccounts.length}/{MAX_QUICK_LOGIN_ACCOUNTS} tài khoản
                      </span>
                      <span className="text-[#8E8C84] dark:text-[#667182]">Chạm để vào ngay</span>
                    </div>

                    <div className="space-y-1.5">
                      {quickAccounts.map((acc) => {
                        const isBusy = quickBusyUid === acc.uid;
                        return (
                          <div
                            key={acc.uid}
                            className="flex items-center gap-1.5 rounded-lg border border-[#E4E2DB] dark:border-[#262F3D] bg-[#F6F5F1]/75 dark:bg-[#0D1117]/75 hover:border-[#0E5A4F]/60 dark:hover:border-[#38B29A]/60 transition-colors"
                          >
                            <button
                              type="button"
                              disabled={isAnyAuthBusy}
                              onClick={() => handleQuickLogin(acc)}
                              className="flex-1 min-w-0 px-3 py-2 text-left flex items-center gap-2.5 disabled:opacity-60"
                            >
                              <div className="w-8 h-8 rounded-full bg-[#0E5A4F]/12 dark:bg-[#38B29A]/15 text-[#0E5A4F] dark:text-[#38B29A] border border-[#0E5A4F]/20 dark:border-[#38B29A]/25 flex items-center justify-center font-display text-xs font-semibold shrink-0">
                                {isBusy ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  (acc.displayName || acc.email || 'U').charAt(0).toUpperCase()
                                )}
                              </div>
                              <div className="min-w-0 flex-1 leading-tight">
                                <div className="text-xs font-semibold text-[#141413] dark:text-[#ECEBE6] truncate">
                                  {acc.displayName}
                                </div>
                                <div className="text-[11px] text-[#63625C] dark:text-[#8E98A8] truncate">
                                  {acc.email} · {acc.authProvider === 'google' ? 'Google' : 'Email'}
                                </div>
                              </div>
                              <ArrowRight className="w-3.5 h-3.5 text-[#8E8C84] dark:text-[#667182] shrink-0" />
                            </button>
                            <button
                              type="button"
                              disabled={isAnyAuthBusy}
                              onClick={() => handleRemoveQuickAccount(acc)}
                              aria-label={`Gỡ ${acc.displayName || acc.email} khỏi đăng nhập nhanh`}
                              title="Gỡ khỏi đăng nhập nhanh"
                              className="p-2 mr-1 rounded-md text-[#8E8C84] dark:text-[#667182] hover:text-[#BE123C] dark:hover:text-[#FB7185] hover:bg-[#FFF1F3] dark:hover:bg-[#2A141A] transition-colors shrink-0 disabled:opacity-40"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 1-Click Firebase Google Sign-In */}
                <div className="space-y-1.5">
                  <StatusButton
                    type="button"
                    status={googleBusy ? 'loading' : 'idle'}
                    disabled={emailBusy || quickBusyUid !== null}
                    onClick={() => handleGoogleSignIn()}
                    className="w-full py-2.5 px-4 rounded-lg bg-[#141413] dark:bg-[#ECEBE6] hover:bg-[#2A2A27] dark:hover:bg-white text-[#F6F5F1] dark:text-[#0D1117] text-xs font-semibold disabled:opacity-60"
                    states={{
                      idle: (
                        <>
                          <Cloud className="w-4 h-4 text-[#38B29A] dark:text-[#0E5A4F]" />
                          <span>Tiếp tục với Google (Firebase Cloud)</span>
                        </>
                      ),
                      loading: (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Đang kết nối Google...</span>
                        </>
                      ),
                    }}
                  />
                  <p className="text-[11px] text-[#63625C] dark:text-[#8E98A8] text-center">
                    Đồng bộ đa thiết bị thời gian thực qua Cloud Firestore
                  </p>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#E4E2DB] dark:border-[#262F3D]" />
                  </div>
                  <div className="relative flex justify-center text-[11px]">
                    <span className="bg-white dark:bg-[#151B23] px-2.5 text-[#63625C] dark:text-[#8E98A8]">
                      hoặc Email &amp; Mật khẩu
                    </span>
                  </div>
                </div>

                <GlidingTabs
                  variant="auth"
                  value={mode}
                  onChange={handleModeChange}
                  className="w-full"
                  items={[
                    { id: 'LOGIN', label: 'Đăng nhập' },
                    { id: 'REGISTER', label: 'Tạo tài khoản' },
                  ]}
                />

                {errorMsg && (
                  <div
                    key={`err-banner-${shakeTick}`}
                    role="alert"
                    className="aui-shake p-3 rounded-lg bg-[#FFF1F3] dark:bg-[#2A141A] border border-[#F6C4CE] dark:border-[#6B2135] text-[#9F1239] dark:text-[#FDA4AF] text-xs flex items-start gap-2"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#BE123C] dark:text-[#FB7185]" />
                    <span className="leading-relaxed">{errorMsg}</span>
                  </div>
                )}

                <form
                  key={mode}
                  noValidate
                  onSubmit={handleEmailSubmit}
                  style={{ '--aui-panel-x': `${modeDir * 8}px` } as React.CSSProperties}
                  className="aui-panel-in space-y-3.5"
                >
                  {mode === 'REGISTER' && (
                    <div>
                      <label className="block text-xs font-semibold text-[#141413] dark:text-[#ECEBE6] mb-1">
                        Tên hiển thị
                      </label>
                      <div
                        key={`auth-name-${fieldErrors.displayName ? shakeTick : 0}`}
                        className={`relative ${fieldErrors.displayName ? 'aui-shake' : ''}`}
                      >
                        <User className="w-4 h-4 text-[#8E8C84] dark:text-[#667182] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={displayName}
                          autoComplete="name"
                          onChange={(e) => {
                            setDisplayName(e.target.value);
                            if (fieldErrors.displayName) {
                              setFieldErrors((p) => ({ ...p, displayName: '' }));
                            }
                          }}
                          placeholder="Nguyễn Văn A"
                          className={`${inputBase} ${fieldErrors.displayName ? inputErr : inputNormal}`}
                        />
                      </div>
                      {fieldErrors.displayName && (
                        <p
                          role="alert"
                          className="mt-1 text-[11px] font-medium text-[#BE123C] dark:text-[#FB7185]"
                        >
                          {fieldErrors.displayName}
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-[#141413] dark:text-[#ECEBE6] mb-1">
                      Email
                    </label>
                    <div
                      key={`auth-email-${fieldErrors.email ? shakeTick : 0}`}
                      className={`relative ${fieldErrors.email ? 'aui-shake' : ''}`}
                    >
                      <Mail className="w-4 h-4 text-[#8E8C84] dark:text-[#667182] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={email}
                        autoComplete="email"
                        aria-invalid={Boolean(fieldErrors.email)}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: '' }));
                        }}
                        placeholder="ban@email.com"
                        className={`${inputBase} ${fieldErrors.email ? inputErr : inputNormal}`}
                      />
                    </div>
                    {fieldErrors.email && (
                      <p
                        role="alert"
                        className="mt-1 text-[11px] font-medium text-[#BE123C] dark:text-[#FB7185]"
                      >
                        {fieldErrors.email}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#141413] dark:text-[#ECEBE6] mb-1">
                      Mật khẩu
                    </label>
                    <div
                      key={`auth-pwd-${fieldErrors.password ? shakeTick : 0}`}
                      className={`relative ${fieldErrors.password ? 'aui-shake' : ''}`}
                    >
                      <Lock className="w-4 h-4 text-[#8E8C84] dark:text-[#667182] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPwd ? 'text' : 'password'}
                        value={password}
                        autoComplete={mode === 'LOGIN' ? 'current-password' : 'new-password'}
                        aria-invalid={Boolean(fieldErrors.password)}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: '' }));
                        }}
                        placeholder="Tối thiểu 6 ký tự"
                        className={`${inputBase} pr-10 ${fieldErrors.password ? inputErr : inputNormal}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#63625C] dark:text-[#8E98A8] hover:text-[#141413] dark:hover:text-[#ECEBE6]"
                        title={showPwd ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      >
                        {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {fieldErrors.password && (
                      <p
                        role="alert"
                        className="mt-1 text-[11px] font-medium text-[#BE123C] dark:text-[#FB7185]"
                      >
                        {fieldErrors.password}
                      </p>
                    )}
                  </div>

                  {mode === 'REGISTER' && (
                    <div>
                      <label className="block text-xs font-semibold text-[#141413] dark:text-[#ECEBE6] mb-1">
                        Xác nhận mật khẩu
                      </label>
                      <div
                        key={`auth-cpwd-${fieldErrors.confirmPassword ? shakeTick : 0}`}
                        className={`relative ${fieldErrors.confirmPassword ? 'aui-shake' : ''}`}
                      >
                        <Lock className="w-4 h-4 text-[#8E8C84] dark:text-[#667182] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type={showPwd ? 'text' : 'password'}
                          value={confirmPassword}
                          autoComplete="new-password"
                          aria-invalid={Boolean(fieldErrors.confirmPassword)}
                          onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            if (fieldErrors.confirmPassword) {
                              setFieldErrors((p) => ({ ...p, confirmPassword: '' }));
                            }
                          }}
                          placeholder="Nhập lại mật khẩu"
                          className={`${inputBase} ${fieldErrors.confirmPassword ? inputErr : inputNormal}`}
                        />
                      </div>
                      {fieldErrors.confirmPassword && (
                        <p
                          role="alert"
                          className="mt-1 text-[11px] font-medium text-[#BE123C] dark:text-[#FB7185]"
                        >
                          {fieldErrors.confirmPassword}
                        </p>
                      )}
                    </div>
                  )}

                  <StatusButton
                    type="submit"
                    status={emailBusy ? 'loading' : 'idle'}
                    disabled={googleBusy || quickBusyUid !== null}
                    className="w-full py-2.5 rounded-lg bg-[#0E5A4F] hover:bg-[#0A463D] dark:bg-[#38B29A] dark:hover:bg-[#2E9B86] text-white dark:text-[#0D1117] text-sm font-semibold disabled:opacity-60"
                    states={{
                      idle: (
                        <>
                          {mode === 'LOGIN' ? (
                            <LogIn className="w-4 h-4" />
                          ) : (
                            <UserPlus className="w-4 h-4" />
                          )}
                          <span>
                            {mode === 'LOGIN' ? 'Đăng nhập bằng Email' : 'Tạo tài khoản mới'}
                          </span>
                        </>
                      ),
                      loading: (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>
                            {mode === 'LOGIN' ? 'Đang đăng nhập...' : 'Đang tạo tài khoản...'}
                          </span>
                        </>
                      ),
                    }}
                  />
                </form>

                {/* Device-Bound Guest Account Section */}
                <div className="pt-4 border-t border-[#E4E2DB] dark:border-[#262F3D] space-y-3">
                  {deviceGuest ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold tracking-[0.06em] text-[#63625C] dark:text-[#8E98A8]">
                          Tài khoản khách trên thiết bị này
                        </span>
                        <span className="text-[#0E5A4F] dark:text-[#38B29A] font-medium">
                          Đã lưu dữ liệu
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={isAnyAuthBusy}
                        onClick={() => {
                          setAuthModalOpen(false);
                          onGuestMode('CONTINUE');
                        }}
                        className="aui-btn w-full px-3.5 py-2.5 rounded-lg bg-[#F6F5F1] dark:bg-[#0D1117] hover:bg-[#EFEDE7] dark:hover:bg-[#1C2430] border border-[#E4E2DB] dark:border-[#262F3D] hover:border-[#0E5A4F]/60 dark:hover:border-[#38B29A]/60 text-left flex items-center justify-between gap-3 transition-colors disabled:opacity-60"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#151B23] border border-[#E4E2DB] dark:border-[#262F3D] flex items-center justify-center shrink-0">
                            <HardDrive className="w-4 h-4 text-[#0E5A4F] dark:text-[#38B29A]" />
                          </div>
                          <div className="min-w-0 leading-tight">
                            <div className="text-xs font-semibold text-[#141413] dark:text-[#ECEBE6] truncate">
                              {deviceGuest.displayName || 'Tài khoản khách'}
                            </div>
                            <div className="text-[11px] text-[#63625C] dark:text-[#8E98A8] truncate">
                              {deviceGuest.hasData
                                ? `${deviceGuest.walletCount} ví · ${deviceGuest.cashflowCount} thu chi · ${deviceGuest.investmentCount} đầu tư`
                                : 'Gắn với thiết bị này · Chạm để vào tiếp'}
                            </div>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-[#0E5A4F] dark:text-[#38B29A] inline-flex items-center gap-1 shrink-0">
                          <span>Vào ngay</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </button>

                      {!confirmResetGuest ? (
                        <button
                          type="button"
                          disabled={isAnyAuthBusy}
                          onClick={() => setConfirmResetGuest(true)}
                          className="w-full py-1.5 text-xs font-medium text-[#63625C] dark:text-[#8E98A8] hover:text-[#BE123C] dark:hover:text-[#FB7185] flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Tạo tài khoản khách mới</span>
                        </button>
                      ) : (
                        <div
                          role="alert"
                          className="p-3.5 rounded-lg bg-[#FFFBEB] dark:bg-[#261E0F] border border-[#F2D59B] dark:border-[#6B4E16] space-y-3"
                        >
                          <div className="flex items-start gap-2.5 text-xs text-[#92400E] dark:text-[#FCD34D]">
                            <AlertTriangle className="w-4 h-4 text-[#B45309] dark:text-[#FBBF24] shrink-0 mt-0.5" />
                            <p className="leading-relaxed font-medium">
                              Bạn đã có dữ liệu ở tài khoản khách cũ và nếu tạo tài khoản khách
                              khác thì dữ liệu và tài khoản khách cũ sẽ mất đi
                            </p>
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setConfirmResetGuest(false)}
                              className="aui-btn px-3 py-1.5 rounded-lg bg-white dark:bg-[#151B23] border border-[#E4E2DB] dark:border-[#262F3D] text-xs font-semibold text-[#141413] dark:text-[#ECEBE6]"
                            >
                              Hủy
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmResetGuest(false);
                                setAuthModalOpen(false);
                                onGuestMode('CREATE_NEW');
                              }}
                              className="aui-btn px-3 py-1.5 rounded-lg bg-[#BE123C] hover:bg-[#9F1239] text-white text-xs font-semibold"
                            >
                              Xác nhận tạo mới
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAuthModalOpen(false);
                        onGuestMode('CREATE_NEW');
                      }}
                      disabled={isAnyAuthBusy}
                      className="aui-btn w-full py-2.5 px-4 rounded-lg bg-[#F6F5F1] dark:bg-[#0D1117] hover:bg-[#EFEDE7] dark:hover:bg-[#1C2430] border border-[#E4E2DB] dark:border-[#262F3D] text-[#141413] dark:text-[#ECEBE6] text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                    >
                      <HardDrive className="w-3.5 h-3.5 text-[#0E5A4F] dark:text-[#38B29A]" />
                      <span>Vào bằng Tài khoản khách (lưu trên thiết bị này)</span>
                    </button>
                  )}

                  <p className="text-[11px] text-[#63625C] dark:text-[#8E98A8] flex items-center justify-center gap-1.5 text-center">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#0E5A4F] dark:text-[#38B29A] shrink-0" />
                    <span>
                      Dữ liệu lưu riêng theo từng tài khoản · Hỗ trợ đăng nhập nhanh tối đa{' '}
                      {MAX_QUICK_LOGIN_ACCOUNTS} tài khoản.
                    </span>
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
