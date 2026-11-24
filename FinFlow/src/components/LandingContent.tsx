import React, { useState } from 'react';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { ArrowRight, Check, Copy } from 'lucide-react';
import { StudioModel3D } from './StudioModel3D';
import type { StudioModelKind } from '../lib/threeStudio';
import type { DeviceGuestProfile } from '../types/finance';

const EDITORIAL_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const SECTION_REVEAL_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: EDITORIAL_EASE,
    },
  },
};

const FEATURE_GRID_VARIANTS: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.03,
    },
  },
};

const FEATURE_CARD_VARIANTS: Variants = {
  hidden: {
    opacity: 0,
    y: 22,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: EDITORIAL_EASE,
    },
  },
};

interface AboutPillarItem {
  title: string;
  subtitle: string;
  detail: string;
  modelKind: StudioModelKind;
}

const ABOUT_PILLARS: readonly AboutPillarItem[] = [
  {
    title: 'Chính xác',
    subtitle: 'Chuẩn kế toán cá nhân',
    detail:
      'Cấu trúc số liệu minh bạch giữa tiền mặt, giá vốn đầu tư bình quân và giá trị thị trường thực tế.',
    modelKind: 'ABOUT_BALANCE',
  },
  {
    title: 'Tiện dụng',
    subtitle: 'Ghi chép trong vài giây',
    detail:
      'Giao diện phẳng, thoáng và dễ đọc trên cả máy tính lẫn di động để bạn cập nhật thu chi mỗi ngày.',
    modelKind: 'APP_FLOW',
  },
  {
    title: 'Tiết kiệm',
    subtitle: 'Giữ vững thặng dư',
    detail:
      'Nhìn rõ khoản chi nào đang tăng nhanh để duy trì kỷ luật ngân sách và tích lũy bền vững từng tháng.',
    modelKind: 'WHY_BUDGET',
  },
] as const;

interface WhyFinflowItem {
  id: 'NAV' | 'MARKET' | 'BUDGET' | 'SECURITY';
  modelKind: StudioModelKind;
  index: string;
  category: string;
  title: string;
  summary: string;
  detailNote: string;
}

const WHY_FINFLOW_CARDS: readonly WhyFinflowItem[] = [
  {
    id: 'NAV',
    modelKind: 'WHY_NAV',
    index: '01',
    category: 'Sổ cái hợp nhất',
    title: 'Tài sản thực tế (NAV)',
    summary:
      'Tổng hợp tức thì tiền mặt, tài khoản ngân hàng, sổ tiết kiệm và toàn bộ danh mục đầu tư vào một con số giá trị tài sản ròng chuẩn xác từng đồng.',
    detailNote:
      'Mọi khoản thu, chi hoặc chuyển tiền giữa các ví đều tự động phản ánh ngay vào tổng tài sản hiện có.',
  },
  {
    id: 'MARKET',
    modelKind: 'WHY_MARKET',
    index: '02',
    category: 'Chứng khoán & Crypto',
    title: 'Giá vốn bình quân & Đầu tư',
    summary:
      'Tự động tính giá vốn bình quân theo từng lô mua bán, đồng bộ thị giá cổ phiếu Việt Nam và tiền số để đo lường lãi lỗ thực tế rõ ràng.',
    detailNote:
      'Tách bạch vốn gốc, giá trị thị trường hiện tại và tỷ suất sinh lời theo từng mã tài sản.',
  },
  {
    id: 'BUDGET',
    modelKind: 'WHY_BUDGET',
    index: '03',
    category: 'Kiểm soát tốc độ chi',
    title: 'Dự báo chi tiêu & Ngân sách',
    summary:
      'Theo dõi nhịp chi tiêu thực tế theo từng ngày trong tháng, ước tính số dư cuối kỳ và cảnh báo sớm khi một danh mục tiến sát hạn mức.',
    detailNote:
      'Giúp bạn duy trì kỷ luật tiết kiệm chủ động hằng tháng mà không cần tự lập bảng tính phức tạp.',
  },
  {
    id: 'SECURITY',
    modelKind: 'WHY_SECURITY',
    index: '04',
    category: 'Lưu trữ & Đa thiết bị',
    title: 'Đồng bộ & Bảo mật riêng biệt',
    summary:
      'Đăng nhập bằng Google Cloud, Email hoặc Tài khoản khách gắn thiết bị; mọi dữ liệu bạn tạo và cập nhật được lưu riêng theo từng tài khoản.',
    detailNote:
      'Hỗ trợ đăng nhập nhanh tối đa 3 tài khoản trên thiết bị cùng khả năng xuất báo cáo CSV chuẩn Excel.',
  },
] as const;

interface AppScenarioItem {
  id: 'DAILY' | 'CASHFLOW' | 'PORTFOLIO' | 'BUDGET';
  modelKind: StudioModelKind;
  index: string;
  category: string;
  title: string;
  shortDesc: string;
  outcomeHeading: string;
  outcomeDetail: string;
  highlights: readonly string[];
}

const APP_SCENARIOS: readonly AppScenarioItem[] = [
  {
    id: 'DAILY',
    modelKind: 'COMPACT_WALLET',
    index: '01',
    category: 'Thu chi hằng ngày',
    title: 'Quản lý thu chi hằng ngày gọn nhẹ',
    shortDesc:
      'Ghi nhận thu nhập, chi tiêu ăn uống, hóa đơn và chuyển khoản giữa các ví chỉ trong vài giây.',
    outcomeHeading: 'Không bỏ sót khoản chi nhỏ mỗi ngày',
    outcomeDetail:
      'Mỗi khoản chi được gắn trực tiếp vào ví thanh toán tương ứng, tự động khấu trừ số dư và sắp xếp theo danh mục rõ ràng để bạn tra cứu lại bất cứ lúc nào.',
    highlights: [
      'Tự động cập nhật số dư ví liên kết',
      'Phân loại thu chi rõ ràng',
      'Lọc và tìm kiếm lịch sử nhanh',
    ],
  },
  {
    id: 'CASHFLOW',
    modelKind: 'APP_FLOW',
    index: '02',
    category: 'Dòng tiền theo tháng',
    title: 'Kiểm tra dòng tiền & so sánh theo tháng',
    shortDesc:
      'Biểu đồ thu – chi – tiết kiệm ròng minh bạch giúp nhìn rõ thặng dư hay thâm hụt từng kỳ.',
    outcomeHeading: 'Đọc vị xu hướng dòng tiền qua 6 đến 12 tháng',
    outcomeDetail:
      'Quan sát tốc độ tích lũy theo từng tháng, nhận ra những giai đoạn chi tiêu tăng đột biến và chủ động cân đối lại kế hoạch tài chính cho tháng tiếp theo.',
    highlights: [
      'Biểu đồ so sánh thu – chi trực quan',
      'Tính tỷ lệ tiết kiệm ròng theo tháng',
      'Xuất bảng kê CSV chuẩn Excel',
    ],
  },
  {
    id: 'PORTFOLIO',
    modelKind: 'WHY_MARKET',
    index: '03',
    category: 'Danh mục đầu tư',
    title: 'Theo dõi tài sản & danh mục đầu tư tập trung',
    shortDesc:
      'Quan sát đồng thời tiền mặt, cổ phiếu Việt Nam và Crypto trên một màn hình thống nhất.',
    outcomeHeading: 'Nắm rõ giá vốn bình quân và lãi lỗ thực tế',
    outcomeDetail:
      'Mỗi khi mua thêm hoặc chốt lời một phần, FinFlow tự tính lại giá vốn bình quân và quy đổi toàn bộ danh mục về VND theo tỷ giá cập nhật.',
    highlights: [
      'Cập nhật giá cổ phiếu Việt Nam & Crypto',
      'Hỗ trợ điều chỉnh giá thủ công khi cần',
      'Phân bổ tỷ trọng tài sản tự động',
    ],
  },
  {
    id: 'BUDGET',
    modelKind: 'WHY_BUDGET',
    index: '04',
    category: 'Ngân sách & Tiết kiệm',
    title: 'Kiểm soát ngân sách & giữ kỷ luật tiết kiệm',
    shortDesc:
      'Đặt hạn mức chi cho từng nhóm nhu cầu và theo dõi tiến độ tiêu dùng theo từng ngày.',
    outcomeHeading: 'Cảnh báo sớm trước khi chi tiêu vượt kế hoạch',
    outcomeDetail:
      'Thanh tiến độ ngân sách hiển thị phần trăm đã chi và số tiền còn lại trong tháng, gửi thông báo ngay khi một nhóm chi tiêu chạm ngưỡng cảnh báo hoặc vượt hạn mức.',
    highlights: [
      'Thiết lập hạn mức linh hoạt theo tháng',
      'Cảnh báo tức thì ngay lúc ghi khoản chi',
      'Dự báo nhịp chi tiêu đến cuối kỳ',
    ],
  },
] as const;

const ONBOARDING_STEPS = [
  {
    step: '01.',
    title: 'Chọn cách mở sổ phù hợp',
    detail:
      'Vào sổ bằng Google Cloud để đồng bộ đa thiết bị, tạo tài khoản Email riêng hoặc bắt đầu ngay với Tài khoản khách gắn cố định trên thiết bị.',
  },
  {
    step: '02.',
    title: 'Ghi nhận ví, đầu tư & thu chi',
    detail:
      'Tạo các ví tiền mặt hoặc ngân hàng hiện có, thêm lệnh đầu tư và nhập các khoản thu chi phát sinh hằng ngày bằng biểu mẫu tối giản.',
  },
  {
    step: '03.',
    title: 'Theo dõi bức tranh tài chính tự động',
    detail:
      'Giá trị tài sản ròng, giá vốn bình quân, biểu đồ dòng tiền và mức độ hoàn thành ngân sách tự động cập nhật sau mỗi thay đổi.',
  },
] as const;

interface SecurityCommitmentItem {
  title: string;
  subtitle: string;
  detail: string;
  modelKind: StudioModelKind;
}

const SECURITY_COMMITMENTS: readonly SecurityCommitmentItem[] = [
  {
    title: 'Lưu trữ tách biệt cho từng tài khoản',
    subtitle: 'Dữ liệu cá nhân độc lập',
    detail:
      'Mọi ví tiền, danh mục đầu tư và sổ thu chi bạn cập nhật được lưu riêng theo đúng tài khoản cá nhân, không pha trộn dữ liệu giữa các người dùng.',
    modelKind: 'PRIVACY_VAULT',
  },
  {
    title: 'Đăng nhập nhanh tối đa 3 tài khoản an toàn',
    subtitle: 'Không lưu mật khẩu ở trình duyệt',
    detail:
      'Chuyển nhanh giữa tối đa 3 tài khoản đã dùng trên thiết bị bằng phiên bảo mật; tự động thay thế tài khoản cũ nhất khi vượt giới hạn.',
    modelKind: 'COMPACT_KEYS',
  },
  {
    title: 'Tài khoản khách gắn cố định với thiết bị',
    subtitle: 'Chủ động bảo toàn dữ liệu cũ',
    detail:
      'Dữ liệu ở Tài khoản khách được lưu giữ cho các lần truy cập sau và luôn hiển thị cảnh báo xác nhận trước khi bạn chọn tạo tài khoản khách mới.',
    modelKind: 'WHY_SECURITY',
  },
] as const;

const AUTHOR_INFO = {
  name: 'Trần Quang Khải',
  phone: '0859691350',
  email: 'tqk3102002@gmail.com',
} as const;

export interface LandingContentProps {
  deviceGuest: DeviceGuestProfile | null;
  onOpenAuthModal: (mode: 'LOGIN' | 'REGISTER') => void;
  onGuestMode: (mode?: 'CONTINUE' | 'CREATE_NEW') => void;
  onScrollToSection: (sectionId: string) => void;
  showToast: (msg: string, type?: 'success' | 'warning' | 'error') => void;
  isDark: boolean;
  reducedMotion: boolean;
}

export function LandingContent({
  deviceGuest,
  onOpenAuthModal,
  onGuestMode,
  onScrollToSection,
  showToast,
  isDark,
  reducedMotion,
}: LandingContentProps) {
  const [activeScenarioId, setActiveScenarioId] = useState<AppScenarioItem['id']>('DAILY');
  const [copiedKey, setCopiedKey] = useState<'phone' | 'email' | null>(null);

  const activeScenario =
    APP_SCENARIOS.find((item) => item.id === activeScenarioId) || APP_SCENARIOS[0];

  const handleCopyContact = async (key: 'phone' | 'email', value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      showToast(`Đã sao chép ${label}: ${value}`);
      window.setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 2000);
    } catch {
      showToast(`Không thể tự động sao chép. ${label}: ${value}`, 'warning');
    }
  };

  return (
    <div className="bg-[#F6F5F1] dark:bg-[#0D1117] text-[#141413] dark:text-[#ECEBE6]">
      {/* SECTION 01: GIỚI THIỆU FINFLOW (CLEAN EDITORIAL + 3 COMPACT 76PX PILLAR 3D MODELS) */}
      <section
        id="about"
        className="scroll-mt-16 w-full max-w-[1200px] mx-auto px-6 py-20 sm:py-24"
      >
        <motion.div
          variants={SECTION_REVEAL_VARIANTS}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.25 }}
          className="max-w-[740px] mb-12 space-y-4"
        >
          <p className="text-xs font-semibold tracking-[0.14em] text-[#0E5A4F] dark:text-[#38B29A]">
            01. Giới thiệu FinFlow
          </p>

          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[#141413] dark:text-[#ECEBE6] leading-[1.15] text-balance">
            Một sổ cái rõ ràng cho toàn bộ tài sản và dòng tiền cá nhân.
          </h2>

          <p className="text-sm sm:text-base text-[#63625C] dark:text-[#8E98A8] leading-relaxed">
            FinFlow gom trọn bức tranh tài chính của bạn vào một nơi duy nhất: từ tiền mặt, tài
            khoản ngân hàng, danh mục đầu tư chứng khoán và Crypto cho đến nhịp thu chi mỗi ngày —
            không bảng tính rối mắt, không thao tác thừa.
          </p>
        </motion.div>

        <motion.div
          variants={FEATURE_GRID_VARIANTS}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {ABOUT_PILLARS.map((pillar) => (
            <motion.div
              key={pillar.title}
              variants={FEATURE_CARD_VARIANTS}
              className="rounded-xl border border-[#E4E2DB] dark:border-[#262F3D] bg-white dark:bg-[#151B23] p-6 space-y-4"
            >
              <div className="flex items-center gap-4">
                <StudioModel3D
                  kind={pillar.modelKind}
                  isDark={isDark}
                  reducedMotion={reducedMotion}
                  className="w-[76px] h-[76px]"
                />
                <div className="min-w-0 space-y-0.5">
                  <p className="text-[11px] font-medium text-[#0E5A4F] dark:text-[#38B29A]">
                    {pillar.subtitle}
                  </p>
                  <h3 className="font-display text-xl font-semibold text-[#141413] dark:text-[#ECEBE6]">
                    {pillar.title}
                  </h3>
                </div>
              </div>

              <p className="text-sm text-[#63625C] dark:text-[#8E98A8] leading-relaxed pt-3 border-t border-[#E4E2DB] dark:border-[#262F3D]">
                {pillar.detail}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* SECTION 02: TẠI SAO CHỌN FINFLOW (2×2 COMPACT FEATURE CARDS WITH 88PX 3D BESIDE TITLE) */}
      <section
        id="why-finflow"
        className="scroll-mt-16 border-t border-[#E4E2DB] dark:border-[#262F3D] bg-white dark:bg-[#11161F]"
      >
        <div className="w-full max-w-[1200px] mx-auto px-6 py-20 sm:py-24">
          <motion.div
            variants={SECTION_REVEAL_VARIANTS}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.25 }}
            className="max-w-[680px] mb-12 space-y-3"
          >
            <p className="text-xs font-semibold tracking-[0.14em] text-[#0E5A4F] dark:text-[#38B29A]">
              02. Tại sao chọn FinFlow
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[#141413] dark:text-[#ECEBE6] leading-[1.15] text-balance">
              Rõ từng con số, gọn từng thao tác, vững nhịp tiết kiệm.
            </h2>
            <p className="text-sm text-[#63625C] dark:text-[#8E98A8] leading-relaxed">
              Bốn nền tảng cốt lõi được xây dựng xoay quanh thói quen quản lý tài chính thực tế của
              người dùng Việt.
            </p>
          </motion.div>

          <motion.div
            variants={FEATURE_GRID_VARIANTS}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.14 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {WHY_FINFLOW_CARDS.map((card) => (
              <motion.div key={card.id} variants={FEATURE_CARD_VARIANTS} className="h-full">
                <article
                  tabIndex={0}
                  onClick={() => onOpenAuthModal('REGISTER')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpenAuthModal('REGISTER');
                    }
                  }}
                  className="group h-full cursor-pointer rounded-xl border border-[#E4E2DB] dark:border-[#262F3D] hover:border-[#0E5A4F]/65 dark:hover:border-[#38B29A]/65 bg-[#F6F5F1]/65 dark:bg-[#151B23] p-6 sm:p-7 flex flex-col justify-between gap-5 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E5A4F] dark:focus-visible:ring-[#38B29A]"
                >
                  {/* Top Row: Compact 88px 3D Model Paired Directly Beside Title */}
                  <div className="flex items-start gap-4 sm:gap-5">
                    <StudioModel3D
                      kind={card.modelKind}
                      isDark={isDark}
                      reducedMotion={reducedMotion}
                      className="w-[84px] h-[84px] sm:w-[88px] sm:h-[88px]"
                    />

                    <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-num font-semibold tracking-wider text-[#63625C] dark:text-[#8E98A8] group-hover:text-[#0E5A4F] dark:group-hover:text-[#38B29A] transition-colors">
                          {card.index} · {card.category}
                        </span>
                        <ArrowRight
                          aria-hidden="true"
                          className="w-4 h-4 shrink-0 text-[#8E8C84] dark:text-[#667182] group-hover:text-[#0E5A4F] dark:group-hover:text-[#38B29A] transition-colors"
                        />
                      </div>

                      <h3 className="font-display text-xl sm:text-2xl font-semibold text-[#141413] dark:text-[#ECEBE6] leading-snug">
                        {card.title}
                      </h3>
                    </div>
                  </div>

                  {/* Feature Copy */}
                  <div className="space-y-2 pt-4 border-t border-[#E4E2DB] dark:border-[#262F3D]">
                    <p className="text-sm text-[#63625C] dark:text-[#8E98A8] leading-relaxed">
                      {card.summary}
                    </p>
                    <p className="text-xs text-[#8E8C84] dark:text-[#667182] leading-relaxed">
                      {card.detailNote}
                    </p>
                  </div>
                </article>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* SECTION 03: TÍNH NĂNG ỨNG DỤNG (4 CLICKABLE ITEMS WITH COMPACT 76PX 3D + CLEAN DETAIL PANEL) */}
      <section
        id="applications"
        className="scroll-mt-16 border-t border-[#E4E2DB] dark:border-[#262F3D] w-full max-w-[1200px] mx-auto px-6 py-20 sm:py-24"
      >
        <motion.div
          variants={SECTION_REVEAL_VARIANTS}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.25 }}
          className="max-w-[680px] mb-12 space-y-3"
        >
          <p className="text-xs font-semibold tracking-[0.14em] text-[#0E5A4F] dark:text-[#38B29A]">
            03. Tính năng ứng dụng
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[#141413] dark:text-[#ECEBE6] leading-[1.15] text-balance">
            FinFlow đồng hành cùng nhịp tài chính mỗi ngày của bạn.
          </h2>
          <p className="text-sm text-[#63625C] dark:text-[#8E98A8] leading-relaxed">
            Từ một khoản cà phê buổi sáng đến báo cáo dòng tiền cuối tháng và danh mục đầu tư dài
            hạn, mọi nhu cầu được gom gọn trong một trải nghiệm liền mạch.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.12fr_0.88fr] gap-8 lg:gap-10 items-start">
          {/* Interactive List of 4 Application Features, Each With Its Own Compact 76px 3D Model */}
          <div className="space-y-3">
            {APP_SCENARIOS.map((item) => {
              const isActive = item.id === activeScenario.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setActiveScenarioId(item.id)}
                  className={`w-full text-left rounded-xl border p-4 sm:p-5 transition-colors duration-200 flex items-center gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E5A4F] dark:focus-visible:ring-[#38B29A] ${
                    isActive
                      ? 'bg-white dark:bg-[#151B23] border-[#0E5A4F] dark:border-[#38B29A]'
                      : 'bg-white/55 dark:bg-[#151B23]/45 border-[#E4E2DB] dark:border-[#262F3D] hover:bg-white dark:hover:bg-[#151B23]'
                  }`}
                >
                  <StudioModel3D
                    kind={item.modelKind}
                    isDark={isDark}
                    reducedMotion={reducedMotion}
                    className="w-[72px] h-[72px] sm:w-[76px] sm:h-[76px]"
                  />

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className={`font-num font-semibold ${
                          isActive
                            ? 'text-[#0E5A4F] dark:text-[#38B29A]'
                            : 'text-[#8E8C84] dark:text-[#667182]'
                        }`}
                      >
                        {item.index} · {item.category}
                      </span>
                    </div>
                    <h3
                      className={`text-base font-semibold leading-snug transition-colors ${
                        isActive
                          ? 'text-[#141413] dark:text-[#ECEBE6]'
                          : 'text-[#44433E] dark:text-[#A9B3C1]'
                      }`}
                    >
                      {item.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#63625C] dark:text-[#8E98A8] leading-relaxed">
                      {item.shortDesc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Clean Focused Detail Card Synchronized With Selected Feature */}
          <div className="lg:sticky lg:top-24 rounded-xl border border-[#E4E2DB] dark:border-[#262F3D] bg-white dark:bg-[#151B23] p-6 sm:p-7">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeScenario.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: EDITORIAL_EASE }}
                className="space-y-5"
              >
                <div className="flex items-center gap-4">
                  <StudioModel3D
                    kind={activeScenario.modelKind}
                    isDark={isDark}
                    reducedMotion={reducedMotion}
                    className="w-[84px] h-[84px]"
                  />
                  <div className="min-w-0 space-y-1">
                    <p className="font-num text-xs font-semibold text-[#0E5A4F] dark:text-[#38B29A]">
                      {activeScenario.index} · {activeScenario.category}
                    </p>
                    <h3 className="font-display text-xl font-semibold text-[#141413] dark:text-[#ECEBE6] leading-snug">
                      {activeScenario.outcomeHeading}
                    </h3>
                  </div>
                </div>

                <p className="text-sm text-[#63625C] dark:text-[#8E98A8] leading-relaxed pt-4 border-t border-[#E4E2DB] dark:border-[#262F3D]">
                  {activeScenario.outcomeDetail}
                </p>

                <ul className="space-y-2.5 pt-1 text-xs sm:text-sm text-[#141413] dark:text-[#ECEBE6]">
                  {activeScenario.highlights.map((hl, idx) => (
                    <li key={hl} className="flex items-baseline gap-2.5">
                      <span className="font-num text-xs font-semibold text-[#B47B2B] dark:text-[#E2B05E] shrink-0">
                        0{idx + 1}.
                      </span>
                      <span>{hl}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-4 border-t border-[#E4E2DB] dark:border-[#262F3D] flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onOpenAuthModal('REGISTER')}
                    className="aui-btn px-4 py-2 rounded-lg bg-[#0E5A4F] hover:bg-[#0A463D] dark:bg-[#38B29A] dark:hover:bg-[#2E9B86] text-white dark:text-[#090D14] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors"
                  >
                    <span>Trải nghiệm ngay</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onGuestMode('CONTINUE')}
                    className="aui-btn px-3.5 py-2 rounded-lg bg-[#F6F5F1] dark:bg-[#0D1117] hover:bg-[#EFEDE7] dark:hover:bg-[#1C2430] border border-[#E4E2DB] dark:border-[#262F3D] text-[#141413] dark:text-[#ECEBE6] text-xs font-semibold whitespace-nowrap transition-colors"
                  >
                    {deviceGuest ? 'Tiếp tục Tài khoản khách' : 'Dùng thử Tài khoản khách'}
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* SECTION 04: QUY TRÌNH BẮT ĐẦU TRONG 3 BƯỚC (CLEAN EDITORIAL BREATHING REST) */}
      <section
        id="how-it-works"
        className="scroll-mt-16 border-t border-[#E4E2DB] dark:border-[#262F3D] bg-white dark:bg-[#11161F]"
      >
        <div className="w-full max-w-[1200px] mx-auto px-6 py-20 sm:py-24">
          <motion.div
            variants={SECTION_REVEAL_VARIANTS}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.25 }}
            className="max-w-[640px] mb-12 space-y-3"
          >
            <p className="text-xs font-semibold tracking-[0.14em] text-[#0E5A4F] dark:text-[#38B29A]">
              04. Quy trình bắt đầu trong 3 bước
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[#141413] dark:text-[#ECEBE6] leading-[1.15] text-balance">
              Bắt đầu quản lý tài sản chỉ trong ba bước đơn giản.
            </h2>
          </motion.div>

          <motion.div
            variants={FEATURE_GRID_VARIANTS}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.18 }}
            className="grid grid-cols-1 md:grid-cols-3 border-t border-b border-[#E4E2DB] dark:border-[#262F3D] divide-y md:divide-y-0 md:divide-x divide-[#E4E2DB] dark:divide-[#262F3D]"
          >
            {ONBOARDING_STEPS.map((item) => (
              <motion.div
                key={item.step}
                variants={SECTION_REVEAL_VARIANTS}
                className="py-7 md:py-8 md:px-7 first:md:pl-0 last:md:pr-0 space-y-3"
              >
                <span className="font-num text-sm font-semibold text-[#B47B2B] dark:text-[#E2B05E]">
                  {item.step}
                </span>
                <h3 className="font-display text-xl font-semibold text-[#141413] dark:text-[#ECEBE6]">
                  {item.title}
                </h3>
                <p className="text-sm text-[#63625C] dark:text-[#8E98A8] leading-relaxed">
                  {item.detail}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* SECTION 05: CAM KẾT BẢO MẬT (CLEAN EDITORIAL + 3 COMPACT 76PX SECURITY 3D MODELS) */}
      <section
        id="security"
        className="scroll-mt-16 border-t border-[#E4E2DB] dark:border-[#262F3D] w-full max-w-[1200px] mx-auto px-6 py-20 sm:py-24"
      >
        <motion.div
          variants={SECTION_REVEAL_VARIANTS}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.25 }}
          className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12"
        >
          <div className="max-w-[660px] space-y-3">
            <p className="text-xs font-semibold tracking-[0.14em] text-[#0E5A4F] dark:text-[#38B29A]">
              05. Cam kết bảo mật
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[#141413] dark:text-[#ECEBE6] leading-[1.15] text-balance">
              Lưu trữ riêng biệt, chủ động dữ liệu trên mọi thiết bị.
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onOpenAuthModal('REGISTER')}
              className="aui-btn px-5 py-2.5 rounded-lg bg-[#0E5A4F] hover:bg-[#0A463D] dark:bg-[#38B29A] dark:hover:bg-[#2E9B86] text-white dark:text-[#090D14] text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-colors"
            >
              <span>Mở sổ FinFlow ngay</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onGuestMode('CONTINUE')}
              className="aui-btn px-4 py-2.5 rounded-lg bg-white dark:bg-[#151B23] hover:bg-[#EFEDE7] dark:hover:bg-[#1C2430] border border-[#E4E2DB] dark:border-[#262F3D] text-[#141413] dark:text-[#ECEBE6] text-xs font-semibold whitespace-nowrap transition-colors"
            >
              {deviceGuest ? 'Tiếp tục Tài khoản khách' : 'Vào Tài khoản khách'}
            </button>
          </div>
        </motion.div>

        <motion.div
          variants={FEATURE_GRID_VARIANTS}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {SECURITY_COMMITMENTS.map((item) => (
            <motion.div
              key={item.title}
              variants={FEATURE_CARD_VARIANTS}
              className="rounded-xl border border-[#E4E2DB] dark:border-[#262F3D] bg-white dark:bg-[#151B23] p-6 space-y-4"
            >
              <div className="flex items-center gap-4">
                <StudioModel3D
                  kind={item.modelKind}
                  isDark={isDark}
                  reducedMotion={reducedMotion}
                  className="w-[76px] h-[76px]"
                />
                <div className="min-w-0 space-y-0.5">
                  <p className="text-[11px] font-medium text-[#0E5A4F] dark:text-[#38B29A]">
                    {item.subtitle}
                  </p>
                  <h3 className="text-base font-semibold text-[#141413] dark:text-[#ECEBE6] leading-snug">
                    {item.title}
                  </h3>
                </div>
              </div>

              <p className="text-sm text-[#63625C] dark:text-[#8E98A8] leading-relaxed pt-3 border-t border-[#E4E2DB] dark:border-[#262F3D]">
                {item.detail}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* QUIET EDITORIAL FOOTER WITH SUBTLE RECESSED AUTHOR ATTRIBUTION */}
      <footer className="border-t border-[#E4E2DB] dark:border-[#262F3D] bg-[#F6F5F1] dark:bg-[#0D1117]">
        <div className="w-full max-w-[1200px] mx-auto px-6 py-8 space-y-5">
          {/* Primary Quiet Footer Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#63625C] dark:text-[#8E98A8]">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="font-display text-sm font-semibold text-[#141413] dark:text-[#ECEBE6]">
                FinFlow
              </span>
              <span aria-hidden="true">·</span>
              <span>Chính xác, tiện dụng, tiết kiệm</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-5">
              <button
                type="button"
                onClick={() => onScrollToSection('about')}
                className="whitespace-nowrap hover:text-[#141413] dark:hover:text-[#ECEBE6] transition-colors"
              >
                Giới thiệu
              </button>
              <button
                type="button"
                onClick={() => onScrollToSection('why-finflow')}
                className="whitespace-nowrap hover:text-[#141413] dark:hover:text-[#ECEBE6] transition-colors"
              >
                Vì sao chọn
              </button>
              <button
                type="button"
                onClick={() => onScrollToSection('applications')}
                className="whitespace-nowrap hover:text-[#141413] dark:hover:text-[#ECEBE6] transition-colors"
              >
                Tính năng
              </button>
              <button
                type="button"
                onClick={() => onScrollToSection('security')}
                className="whitespace-nowrap hover:text-[#141413] dark:hover:text-[#ECEBE6] transition-colors"
              >
                Bảo mật
              </button>
              <button
                type="button"
                onClick={() => onOpenAuthModal('LOGIN')}
                className="whitespace-nowrap font-semibold text-[#141413] dark:text-[#ECEBE6] hover:text-[#0E5A4F] dark:hover:text-[#38B29A] transition-colors"
              >
                Đăng nhập
              </button>
            </div>
          </div>

          {/* Subtle Recessed Author Line */}
          <div className="pt-4 border-t border-[#E4E2DB]/75 dark:border-[#262F3D]/75 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-[11px] text-[#8E8C84] dark:text-[#667182]">
            <span>Thiết kế bởi {AUTHOR_INFO.name}</span>

            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1.5">
                <a
                  href={`tel:${AUTHOR_INFO.phone}`}
                  className="font-num hover:text-[#63625C] dark:hover:text-[#8E98A8] transition-colors"
                >
                  {AUTHOR_INFO.phone}
                </a>
                <button
                  type="button"
                  onClick={() => handleCopyContact('phone', AUTHOR_INFO.phone, 'Số điện thoại')}
                  aria-label="Sao chép số điện thoại tác giả"
                  title="Sao chép số điện thoại"
                  className="p-0.5 rounded opacity-55 hover:opacity-100 hover:text-[#141413] dark:hover:text-[#ECEBE6] transition-opacity"
                >
                  {copiedKey === 'phone' ? (
                    <Check className="w-3 h-3 text-[#0E5A4F] dark:text-[#38B29A]" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </span>

              <span aria-hidden="true">·</span>

              <span className="inline-flex items-center gap-1.5">
                <a
                  href={`mailto:${AUTHOR_INFO.email}`}
                  className="hover:text-[#63625C] dark:hover:text-[#8E98A8] transition-colors"
                >
                  {AUTHOR_INFO.email}
                </a>
                <button
                  type="button"
                  onClick={() => handleCopyContact('email', AUTHOR_INFO.email, 'Email')}
                  aria-label="Sao chép email tác giả"
                  title="Sao chép email"
                  className="p-0.5 rounded opacity-55 hover:opacity-100 hover:text-[#141413] dark:hover:text-[#ECEBE6] transition-opacity"
                >
                  {copiedKey === 'email' ? (
                    <Check className="w-3 h-3 text-[#0E5A4F] dark:text-[#38B29A]" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
