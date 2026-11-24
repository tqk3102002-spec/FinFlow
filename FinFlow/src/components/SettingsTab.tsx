import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  CloudUpload,
  Download,
  Edit2,
  FileSpreadsheet,
  HardDrive,
  KeyRound,
  Link2,
  Moon,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Sliders,
  Sun,
  Trash2,
  Upload,
  User,
  Zap,
} from 'lucide-react';
import { GlidingTabs, StatusButton } from './AnimateUI';
import {
  TEMPO_OPTIONS,
  type AssetType,
  type CapitalTransfer,
  type CashflowEntry,
  type InvestmentTrade,
  type SyncMode,
  type TradeSide,
  type UserAccount,
  type Wallet,
} from '../types/finance';
import {
  exportAllFinanceDataToCsv,
  exportCashflowsToCsv,
  exportInvestmentsToCsv,
  formatDateVN,
  formatQty,
  formatUSD,
  formatVND,
} from '../lib/accounting';

export function SettingsTab({
  account,
  syncMode,
  wallets,
  investments,
  cashflows,
  transfers = [],
  usdtVndRate = 25450,
  isSampleData,
  gasSyncUrl,
  theme = 'light',
  onToggleTheme,
  motionTempo,
  reducedMotion,
  onChangeTempo,
  onToggleReducedMotion,
  onUpdateDisplayName,
  onChangePassword,
  onSaveGasUrl,
  onGasPush,
  onGasPull,
  onExportJson,
  onImportJsonFile,
  onLoadSampleData,
  onClearAllData,
  onOpenInvestModal,
  onDeleteInvestment,
  onToast,
  tabDirection,
}: {
  account: UserAccount;
  syncMode: SyncMode;
  wallets: Wallet[];
  investments: InvestmentTrade[];
  cashflows: CashflowEntry[];
  transfers?: CapitalTransfer[];
  usdtVndRate?: number;
  isSampleData: boolean;
  gasSyncUrl: string;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  motionTempo: number;
  reducedMotion: boolean;
  onChangeTempo: (val: number) => void;
  onToggleReducedMotion: () => void;
  onUpdateDisplayName: (newName: string) => Promise<void>;
  onChangePassword: (oldPwd: string, newPwd: string) => Promise<void>;
  onSaveGasUrl: (url: string) => void;
  onGasPush: (url: string) => Promise<void>;
  onGasPull: (url: string) => Promise<void>;
  onExportJson: () => void;
  onImportJsonFile: (file: File) => void;
  onLoadSampleData: () => void;
  onClearAllData: () => void;
  onOpenInvestModal: (
    assetType: AssetType,
    symbol?: string,
    side?: TradeSide,
    record?: InvestmentTrade
  ) => void;
  onDeleteInvestment: (tx: InvestmentTrade) => void;
  onToast: (msg: string, type?: 'success' | 'warning' | 'error') => void;
  tabDirection: number;
}) {
  const [nameInput, setNameInput] = useState(account.displayName || '');
  const [nameSaving, setNameSaving] = useState(false);

  const [pwdForm, setPwdForm] = useState({ oldPwd: '', newPwd: '', confirmPwd: '' });
  const [pwdErrors, setPwdErrors] = useState<{
    oldPwd?: string;
    newPwd?: string;
    confirmPwd?: string;
  }>({});
  const [pwdShakeTick, setPwdShakeTick] = useState(0);
  const [pwdSaving, setPwdSaving] = useState(false);

  const [gasUrlInput, setGasUrlInput] = useState(gasSyncUrl || '');
  const [gasBusy, setGasBusy] = useState<'idle' | 'push' | 'pull'>('idle');

  const [demoSwapStatus, setDemoSwapStatus] = useState<'idle' | 'loading' | 'done'>('idle');
  const [demoShakeTick, setDemoShakeTick] = useState(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setNameInput(account.displayName || '');
  }, [account.displayName]);

  useEffect(() => {
    setGasUrlInput(gasSyncUrl || '');
  }, [gasSyncUrl]);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) {
      onToast('Tên hiển thị không được để trống.', 'error');
      return;
    }
    setNameSaving(true);
    try {
      await onUpdateDisplayName(trimmed);
    } finally {
      setNameSaving(false);
    }
  };

  const handleSubmitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdErrors({});
    if (!pwdForm.oldPwd) {
      setPwdErrors({ oldPwd: 'Vui lòng nhập mật khẩu hiện tại.' });
      setPwdShakeTick((t) => t + 1);
      return;
    }
    if (pwdForm.newPwd.length < 6) {
      setPwdErrors({ newPwd: 'Mật khẩu mới cần tối thiểu 6 ký tự.' });
      setPwdShakeTick((t) => t + 1);
      return;
    }
    if (pwdForm.newPwd !== pwdForm.confirmPwd) {
      setPwdErrors({ confirmPwd: 'Xác nhận mật khẩu mới chưa khớp.' });
      setPwdShakeTick((t) => t + 1);
      return;
    }

    setPwdSaving(true);
    try {
      await onChangePassword(pwdForm.oldPwd, pwdForm.newPwd);
      setPwdForm({ oldPwd: '', newPwd: '', confirmPwd: '' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Đổi mật khẩu thất bại.';
      setPwdErrors({ oldPwd: msg });
      setPwdShakeTick((t) => t + 1);
    } finally {
      setPwdSaving(false);
    }
  };

  const totalExportRows = cashflows.length + investments.length + transfers.length;

  const handleExportAllCsv = () => {
    if (totalExportRows === 0) {
      onToast('Chưa có giao dịch Thu – Chi, Đầu tư hoặc Nạp/Rút nào để xuất CSV.', 'warning');
      return;
    }
    exportAllFinanceDataToCsv(cashflows, investments, wallets, usdtVndRate, transfers);
    onToast(
      `Đã xuất Sổ cái giao dịch CSV chuẩn 1NF (${cashflows.length} Thu – Chi, ${investments.length} Đầu tư, ${transfers.length} Chuyển vốn).`
    );
  };

  return (
    <div
      key="panel-settings"
      style={{ '--aui-panel-x': `${tabDirection * 10}px` } as React.CSSProperties}
      className="aui-panel-in space-y-6"
    >
      {/* HÀNG 1: HỒ SƠ & ĐỔI MẬT KHẨU + GOOGLE APPS SCRIPT & SAO LƯU */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cột 1: Hồ sơ, Đổi tên hiển thị & Đổi mật khẩu */}
        <section className="bg-white dark:bg-[#151B23] rounded-xl border border-[#E4E2DB] dark:border-[#262F3D] p-5 space-y-5">
          <div>
            <h2 className="font-display text-base font-semibold text-[#141413] dark:text-[#ECEBE6] flex items-center gap-2">
              <User className="w-4 h-4 text-[#0E5A4F] dark:text-[#38B29A]" />
              <span>Hồ sơ tài khoản &amp; Bảo mật</span>
            </h2>
            <dl className="mt-3 divide-y divide-[#E4E2DB] dark:divide-[#262F3D] border-t border-b border-[#E4E2DB] dark:border-[#262F3D] text-xs">
              <div className="py-2.5 flex justify-between gap-2">
                <dt className="text-[#63625C] dark:text-[#8E98A8]">Email</dt>
                <dd className="font-semibold text-[#141413] dark:text-[#ECEBE6] truncate">
                  {account.isGuest ? 'Chế độ Khách (chưa gắn email)' : account.email}
                </dd>
              </div>
              <div className="py-2.5 flex justify-between gap-2">
                <dt className="text-[#63625C] dark:text-[#8E98A8]">Phương thức</dt>
                <dd className="font-semibold text-[#141413] dark:text-[#ECEBE6]">
                  {account.authProvider === 'google'
                    ? 'Google Sign-In (Firebase)'
                    : account.authProvider === 'password'
                    ? 'Email & Mật khẩu (Máy chủ FinFlow)'
                    : 'Khách cục bộ'}
                </dd>
              </div>
              <div className="py-2.5 flex justify-between gap-2">
                <dt className="text-[#63625C] dark:text-[#8E98A8]">Trạng thái đồng bộ</dt>
                <dd
                  className={`font-semibold ${
                    syncMode === 'CLOUD_SYNCED' || syncMode === 'SERVER_SYNCED'
                      ? 'text-[#137A4B] dark:text-[#34D399]'
                      : syncMode === 'VERIFY_EMAIL'
                      ? 'text-[#B45309] dark:text-[#FBBF24]'
                      : 'text-[#63625C] dark:text-[#8E98A8]'
                  }`}
                >
                  {syncMode === 'CLOUD_SYNCED'
                    ? 'Cloud Firestore thời gian thực'
                    : syncMode === 'SERVER_SYNCED'
                    ? 'Đồng bộ máy chủ FinFlow'
                    : syncMode === 'SYNCING'
                    ? 'Đang đồng bộ...'
                    : syncMode === 'VERIFY_EMAIL'
                    ? 'Chờ xác minh email'
                    : 'Lưu cục bộ trình duyệt'}
                </dd>
              </div>
            </dl>
          </div>

          {/* Form Đổi tên hiển thị */}
          <form onSubmit={handleSaveName} className="space-y-2.5">
            <label className="block text-xs font-semibold text-[#141413] dark:text-[#ECEBE6]">
              Đổi tên hiển thị
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Nhập tên hiển thị mới"
                className="flex-1 px-3 py-2 rounded-lg border border-[#E4E2DB] dark:border-[#262F3D] bg-[#F6F5F1]/60 dark:bg-[#0D1117]/70 text-xs text-[#141413] dark:text-[#ECEBE6] placeholder:text-[#8E8D86] dark:placeholder:text-[#5B6576] focus:outline-none focus:border-[#0E5A4F] dark:focus:border-[#38B29A]"
              />
              <button
                type="submit"
                disabled={nameSaving}
                className="aui-btn px-3.5 py-2 rounded-lg bg-[#0E5A4F] hover:bg-[#0A463D] dark:bg-[#38B29A] dark:hover:bg-[#2E9B86] text-white dark:text-[#0D1117] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-60"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{nameSaving ? 'Đang lưu...' : 'Lưu tên'}</span>
              </button>
            </div>
          </form>

          {/* Form Đổi mật khẩu */}
          <div className="pt-4 border-t border-[#E4E2DB] dark:border-[#262F3D] space-y-2.5">
            <h3 className="text-xs font-semibold text-[#141413] dark:text-[#ECEBE6] flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-[#0E5A4F] dark:text-[#38B29A]" />
              <span>Đổi mật khẩu tài khoản</span>
            </h3>

            {account.authProvider === 'password' ? (
              <form noValidate onSubmit={handleSubmitPassword} className="space-y-2.5 text-xs">
                <div
                  key={`pwd-old-${pwdErrors.oldPwd ? pwdShakeTick : 0}`}
                  className={pwdErrors.oldPwd ? 'aui-shake' : ''}
                >
                  <input
                    type="password"
                    value={pwdForm.oldPwd}
                    onChange={(e) => {
                      setPwdForm((p) => ({ ...p, oldPwd: e.target.value }));
                      if (pwdErrors.oldPwd) setPwdErrors((p) => ({ ...p, oldPwd: '' }));
                    }}
                    placeholder="Mật khẩu hiện tại"
                    className={`w-full px-3 py-2 rounded-lg border bg-[#F6F5F1]/60 dark:bg-[#0D1117]/70 text-[#141413] dark:text-[#ECEBE6] placeholder:text-[#8E8D86] dark:placeholder:text-[#5B6576] focus:outline-none ${
                      pwdErrors.oldPwd
                        ? 'border-[#BE123C] dark:border-[#FB7185] ring-2 ring-[#BE123C]/15 dark:ring-[#FB7185]/20 bg-[#FFF1F3] dark:bg-[#2A141A]'
                        : 'border-[#E4E2DB] dark:border-[#262F3D] focus:border-[#0E5A4F] dark:focus:border-[#38B29A]'
                    }`}
                  />
                  {pwdErrors.oldPwd && (
                    <p
                      role="alert"
                      className="mt-1 text-[11px] font-medium text-[#BE123C] dark:text-[#FB7185]"
                    >
                      {pwdErrors.oldPwd}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div
                    key={`pwd-new-${pwdErrors.newPwd ? pwdShakeTick : 0}`}
                    className={pwdErrors.newPwd ? 'aui-shake' : ''}
                  >
                    <input
                      type="password"
                      value={pwdForm.newPwd}
                      onChange={(e) => {
                        setPwdForm((p) => ({ ...p, newPwd: e.target.value }));
                        if (pwdErrors.newPwd) setPwdErrors((p) => ({ ...p, newPwd: '' }));
                      }}
                      placeholder="Mật khẩu mới (≥ 6 ký tự)"
                      className={`w-full px-3 py-2 rounded-lg border bg-[#F6F5F1]/60 dark:bg-[#0D1117]/70 text-[#141413] dark:text-[#ECEBE6] placeholder:text-[#8E8D86] dark:placeholder:text-[#5B6576] focus:outline-none ${
                        pwdErrors.newPwd
                          ? 'border-[#BE123C] dark:border-[#FB7185] ring-2 ring-[#BE123C]/15 dark:ring-[#FB7185]/20 bg-[#FFF1F3] dark:bg-[#2A141A]'
                          : 'border-[#E4E2DB] dark:border-[#262F3D] focus:border-[#0E5A4F] dark:focus:border-[#38B29A]'
                      }`}
                    />
                    {pwdErrors.newPwd && (
                      <p
                        role="alert"
                        className="mt-1 text-[11px] font-medium text-[#BE123C] dark:text-[#FB7185]"
                      >
                        {pwdErrors.newPwd}
                      </p>
                    )}
                  </div>
                  <div
                    key={`pwd-cfm-${pwdErrors.confirmPwd ? pwdShakeTick : 0}`}
                    className={pwdErrors.confirmPwd ? 'aui-shake' : ''}
                  >
                    <input
                      type="password"
                      value={pwdForm.confirmPwd}
                      onChange={(e) => {
                        setPwdForm((p) => ({ ...p, confirmPwd: e.target.value }));
                        if (pwdErrors.confirmPwd) setPwdErrors((p) => ({ ...p, confirmPwd: '' }));
                      }}
                      placeholder="Nhập lại mật khẩu mới"
                      className={`w-full px-3 py-2 rounded-lg border bg-[#F6F5F1]/60 dark:bg-[#0D1117]/70 text-[#141413] dark:text-[#ECEBE6] placeholder:text-[#8E8D86] dark:placeholder:text-[#5B6576] focus:outline-none ${
                        pwdErrors.confirmPwd
                          ? 'border-[#BE123C] dark:border-[#FB7185] ring-2 ring-[#BE123C]/15 dark:ring-[#FB7185]/20 bg-[#FFF1F3] dark:bg-[#2A141A]'
                          : 'border-[#E4E2DB] dark:border-[#262F3D] focus:border-[#0E5A4F] dark:focus:border-[#38B29A]'
                      }`}
                    />
                    {pwdErrors.confirmPwd && (
                      <p
                        role="alert"
                        className="mt-1 text-[11px] font-medium text-[#BE123C] dark:text-[#FB7185]"
                      >
                        {pwdErrors.confirmPwd}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={pwdSaving}
                  className="aui-btn px-4 py-2 rounded-lg bg-[#0E5A4F] hover:bg-[#0A463D] dark:bg-[#38B29A] dark:hover:bg-[#2E9B86] text-white dark:text-[#0D1117] text-xs font-semibold disabled:opacity-60"
                >
                  {pwdSaving ? 'Đang cập nhật mật khẩu...' : 'Cập nhật mật khẩu'}
                </button>
              </form>
            ) : (
              <p className="text-xs text-[#63625C] dark:text-[#8E98A8] leading-relaxed">
                {account.authProvider === 'google'
                  ? 'Bạn đang đăng nhập qua tài khoản Google nên bảo mật và mật khẩu được quản lý trực tiếp bởi Google Account.'
                  : 'Chế độ Khách lưu cục bộ trên trình duyệt nên không sử dụng mật khẩu. Hãy đăng nhập bằng Google hoặc Email để bảo vệ dữ liệu đám mây.'}
              </p>
            )}
          </div>
        </section>

        {/* Cột 2: Đồng bộ Google Apps Script + Xuất CSV / Sao lưu JSON */}
        <section className="bg-white dark:bg-[#151B23] rounded-xl border border-[#E4E2DB] dark:border-[#262F3D] p-5 space-y-5">
          {/* Đồng bộ Google Apps Script (2 chiều) */}
          <div className="space-y-2.5">
            <h2 className="font-display text-base font-semibold text-[#141413] dark:text-[#ECEBE6] flex items-center gap-2">
              <Link2 className="w-4 h-4 text-[#0E5A4F] dark:text-[#38B29A]" />
              <span>Đồng bộ hai chiều Google Apps Script</span>
            </h2>
            <p className="text-xs text-[#63625C] dark:text-[#8E98A8]">
              Dán địa chỉ Web App URL của Google Apps Script (Google Sheets) để đẩy hoặc tải toàn bộ
              ví, danh mục đầu tư, ngân sách và sổ thu chi.
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                value={gasUrlInput}
                onChange={(e) => setGasUrlInput(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="flex-1 px-3 py-2 rounded-lg border border-[#E4E2DB] dark:border-[#262F3D] bg-[#F6F5F1]/60 dark:bg-[#0D1117]/70 text-xs font-num text-[#141413] dark:text-[#ECEBE6] placeholder:text-[#8E8D86] dark:placeholder:text-[#5B6576] focus:outline-none focus:border-[#0E5A4F] dark:focus:border-[#38B29A]"
              />
              <button
                type="button"
                onClick={() => onSaveGasUrl(gasUrlInput)}
                className="aui-btn px-3 py-2 rounded-lg bg-[#EFEDE7] dark:bg-[#1C2430] hover:bg-[#E4E2DB] dark:hover:bg-[#262F3D] text-[#141413] dark:text-[#ECEBE6] text-xs font-semibold whitespace-nowrap shrink-0"
              >
                Lưu URL
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={gasBusy !== 'idle'}
                onClick={async () => {
                  setGasBusy('push');
                  try {
                    await onGasPush(gasUrlInput);
                  } finally {
                    setGasBusy('idle');
                  }
                }}
                className="aui-btn py-2 px-3 rounded-lg bg-[#0E5A4F]/[0.08] dark:bg-[#38B29A]/[0.14] hover:bg-[#0E5A4F]/[0.14] dark:hover:bg-[#38B29A]/[0.22] text-[#0E5A4F] dark:text-[#38B29A] text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                <CloudUpload className="w-3.5 h-3.5" />
                <span>{gasBusy === 'push' ? 'Đang đẩy...' : 'Đẩy lên Apps Script'}</span>
              </button>
              <button
                type="button"
                disabled={gasBusy !== 'idle'}
                onClick={async () => {
                  setGasBusy('pull');
                  try {
                    await onGasPull(gasUrlInput);
                  } finally {
                    setGasBusy('idle');
                  }
                }}
                className="aui-btn py-2 px-3 rounded-lg bg-[#EFEDE7] dark:bg-[#1C2430] hover:bg-[#E4E2DB] dark:hover:bg-[#262F3D] text-[#141413] dark:text-[#ECEBE6] text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{gasBusy === 'pull' ? 'Đang tải...' : 'Tải từ Apps Script'}</span>
              </button>
            </div>
          </div>

          {/* Xuất báo cáo CSV chuẩn Excel / Google Sheets */}
          <div className="pt-4 border-t border-[#E4E2DB] dark:border-[#262F3D] space-y-2.5">
            <div>
              <h3 className="text-xs font-semibold text-[#141413] dark:text-[#ECEBE6] flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#0E5A4F] dark:text-[#38B29A]" />
                <span>Xuất Sổ cái giao dịch CSV chuẩn 1NF (Excel / Google Sheets)</span>
              </h3>
              <p className="text-[11px] text-[#63625C] dark:text-[#8E98A8] mt-1">
                UTF-8 BOM tiếng Việt · Sắp xếp cũ → mới kèm thời gian ISO 8601, tách riêng Mã/Sàn/Ví
                nguồn–đích, Lãi/Lỗ đã chốt và Tác động tài sản ròng.
              </p>
            </div>

            <button
              type="button"
              onClick={handleExportAllCsv}
              className="aui-btn w-full py-2.5 px-3.5 rounded-lg bg-[#0E5A4F] hover:bg-[#0A463D] dark:bg-[#38B29A] dark:hover:bg-[#2E9B86] text-white dark:text-[#0D1117] text-xs font-semibold flex items-center justify-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span>
                Xuất Sổ cái giao dịch tổng hợp CSV ({totalExportRows} dòng)
              </span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  if (cashflows.length === 0) {
                    onToast('Chưa có giao dịch Thu – Chi để xuất CSV.', 'warning');
                    return;
                  }
                  exportCashflowsToCsv(cashflows, wallets, 'TatCa');
                  onToast(`Đã xuất ${cashflows.length} dòng Thu – Chi chuẩn 1NF ra CSV.`);
                }}
                className="aui-btn py-2 px-3 rounded-lg bg-white dark:bg-[#151B23] hover:bg-[#EFEDE7] dark:hover:bg-[#1C2430] border border-[#E4E2DB] dark:border-[#262F3D] text-[#141413] dark:text-[#ECEBE6] text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-[#137A4B] dark:text-[#34D399]" />
                <span>Riêng Thu – Chi ({cashflows.length})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (investments.length === 0) {
                    onToast('Chưa có giao dịch đầu tư để xuất CSV.', 'warning');
                    return;
                  }
                  exportInvestmentsToCsv(investments, wallets, usdtVndRate);
                  onToast(`Đã xuất Sổ cái đầu tư (${investments.length} lệnh) kèm Lãi/Lỗ chốt ra CSV.`);
                }}
                className="aui-btn py-2 px-3 rounded-lg bg-white dark:bg-[#151B23] hover:bg-[#EFEDE7] dark:hover:bg-[#1C2430] border border-[#E4E2DB] dark:border-[#262F3D] text-[#141413] dark:text-[#ECEBE6] text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-[#0E5A4F] dark:text-[#38B29A]" />
                <span>Riêng Đầu tư ({investments.length})</span>
              </button>
            </div>
          </div>

          {/* Sao lưu & Khôi phục JSON */}
          <div className="pt-4 border-t border-[#E4E2DB] dark:border-[#262F3D] space-y-2.5">
            <h3 className="text-xs font-semibold text-[#141413] dark:text-[#ECEBE6] flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-[#63625C] dark:text-[#8E98A8]" />
              <span>Sao lưu &amp; Khôi phục toàn bộ dữ liệu (JSON)</span>
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onExportJson}
                className="aui-btn py-2 px-3 rounded-lg bg-[#EFEDE7] dark:bg-[#1C2430] hover:bg-[#E4E2DB] dark:hover:bg-[#262F3D] text-[#141413] dark:text-[#ECEBE6] text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Xuất file JSON</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aui-btn py-2 px-3 rounded-lg bg-[#EFEDE7] dark:bg-[#1C2430] hover:bg-[#E4E2DB] dark:hover:bg-[#262F3D] text-[#141413] dark:text-[#ECEBE6] text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Nhập file JSON</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImportJsonFile(file);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="hidden"
              />
            </div>

            <div className="pt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onLoadSampleData}
                className="aui-btn px-3.5 py-2 rounded-lg bg-white dark:bg-[#151B23] hover:bg-[#EFEDE7] dark:hover:bg-[#1C2430] border border-[#E4E2DB] dark:border-[#262F3D] text-[#141413] dark:text-[#ECEBE6] text-xs font-semibold flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Nạp dữ liệu mẫu</span>
              </button>
              <button
                type="button"
                onClick={onClearAllData}
                className="aui-btn px-3.5 py-2 rounded-lg bg-[#FFF1F3] dark:bg-[#2A141A] hover:bg-[#FDE2E7] dark:hover:bg-[#3A1922] border border-[#F6C4CE] dark:border-[#6B2135] text-[#BE123C] dark:text-[#FB7185] text-xs font-semibold flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {isSampleData ? 'Xóa dữ liệu mẫu để bắt đầu trắng' : 'Xóa toàn bộ dữ liệu'}
                </span>
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* HÀNG 2: GIAO DIỆN HIỂN THỊ & CHUYỂN ĐỘNG */}
      <section className="bg-white dark:bg-[#151B23] rounded-xl border border-[#E4E2DB] dark:border-[#262F3D] p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-[#141413] dark:text-[#ECEBE6] flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#0E5A4F] dark:text-[#38B29A]" />
              <span>Giao diện dịu mắt &amp; Chuyển động</span>
            </h2>
            <p className="text-xs text-[#63625C] dark:text-[#8E98A8] mt-0.5">
              Chuyển nhanh chế độ Sáng / Tối dịu mắt ban đêm, điều chỉnh nhịp độ chuyển động toàn cục
              và chế độ Giảm chuyển động.
            </p>
          </div>
          <span className="text-xs font-semibold text-[#0E5A4F] dark:text-[#38B29A] font-num">
            {theme === 'dark' ? 'Dark Mode' : 'Light Mode'} · Tempo {motionTempo}x
          </span>
        </div>

        <div className="divide-y divide-[#E4E2DB] dark:divide-[#262F3D] border-t border-b border-[#E4E2DB] dark:border-[#262F3D]">
          {/* Chế độ hiển thị Sáng / Tối dịu mắt */}
          {onToggleTheme && (
            <div className="py-3.5 flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 p-1.5 rounded-md bg-[#F6F5F1] dark:bg-[#0D1117] border border-[#E4E2DB] dark:border-[#262F3D] text-[#0E5A4F] dark:text-[#E2B05E] shrink-0">
                  {theme === 'dark' ? (
                    <Moon className="w-4 h-4" />
                  ) : (
                    <Sun className="w-4 h-4" />
                  )}
                </span>
                <div>
                  <div className="text-xs font-semibold text-[#141413] dark:text-[#ECEBE6]">
                    Chế độ Tối dịu mắt (Dark Mode)
                  </div>
                  <div className="text-[11px] text-[#63625C] dark:text-[#8E98A8] mt-0.5">
                    Tông nền xanh đêm dịu mắt, giảm chói màn hình khi theo dõi tài sản vào buổi tối.
                  </div>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={theme === 'dark'}
                onClick={onToggleTheme}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                  theme === 'dark' ? 'bg-[#0E5A4F] dark:bg-[#38B29A]' : 'bg-[#D4D1C7] dark:bg-[#2E3848]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white dark:bg-[#0D1117] shadow transform transition-transform duration-200 ${
                    theme === 'dark' ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          )}

          {/* Nhịp độ + Giảm chuyển động */}
          <div className="py-3.5 grid grid-cols-1 lg:grid-cols-2 gap-4 items-center">
            <div className="space-y-1.5">
              <span className="block text-xs font-semibold text-[#141413] dark:text-[#ECEBE6]">
                Nhịp độ chuyển động (Tempo)
              </span>
              <GlidingTabs
                variant="tempo"
                value={String(motionTempo)}
                onChange={(id) => onChangeTempo(Number(id))}
                items={TEMPO_OPTIONS}
              />
            </div>

            <div className="flex items-center justify-between gap-3 lg:pl-4 lg:border-l border-[#E4E2DB] dark:border-[#262F3D]">
              <div>
                <div className="text-xs font-semibold text-[#141413] dark:text-[#ECEBE6]">
                  Giảm chuyển động (Reduced Motion)
                </div>
                <div className="text-[11px] text-[#63625C] dark:text-[#8E98A8] mt-0.5">
                  Tắt trượt, scale và rung lỗi; chỉ giữ chuyển tiếp mờ nhẹ.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={reducedMotion}
                onClick={onToggleReducedMotion}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                  reducedMotion ? 'bg-[#0E5A4F] dark:bg-[#38B29A]' : 'bg-[#D4D1C7] dark:bg-[#2E3848]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white dark:bg-[#0D1117] shadow transform transition-transform duration-200 ${
                    reducedMotion ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#63625C] dark:text-[#8E98A8] mr-1">Kiểm thử nhanh:</span>
          <button
            type="button"
            onClick={() => onToast(`Thông báo nổi (Tempo ${motionTempo}x).`)}
            className="aui-btn px-3 py-1.5 rounded-lg bg-[#EFEDE7] dark:bg-[#1C2430] hover:bg-[#E4E2DB] dark:hover:bg-[#262F3D] text-[#141413] dark:text-[#ECEBE6] text-xs font-semibold"
          >
            Thử Toast
          </button>
          <button
            type="button"
            key={`demo-shake-${demoShakeTick}`}
            onClick={() => setDemoShakeTick((t) => t + 1)}
            className={`aui-btn px-3 py-1.5 rounded-lg border text-xs font-semibold ${
              demoShakeTick > 0
                ? 'aui-shake bg-[#FFF1F3] dark:bg-[#2A141A] border-[#F6C4CE] dark:border-[#6B2135] text-[#BE123C] dark:text-[#FB7185]'
                : 'bg-[#EFEDE7] dark:bg-[#1C2430] border-transparent hover:bg-[#E4E2DB] dark:hover:bg-[#262F3D] text-[#141413] dark:text-[#ECEBE6]'
            }`}
          >
            Thử Rung lỗi
          </button>
          <StatusButton
            status={demoSwapStatus}
            onClick={() => {
              setDemoSwapStatus('loading');
              setTimeout(() => {
                setDemoSwapStatus('done');
                setTimeout(() => setDemoSwapStatus('idle'), 1100);
              }, 700);
            }}
            className="px-3 py-1.5 rounded-lg bg-[#0E5A4F]/[0.08] dark:bg-[#38B29A]/[0.14] hover:bg-[#0E5A4F]/[0.14] dark:hover:bg-[#38B29A]/[0.22] text-[#0E5A4F] dark:text-[#38B29A] text-xs font-semibold"
            states={{
              idle: (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>Thử Blur-Swap</span>
                </>
              ),
              loading: (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang xử lý...</span>
                </>
              ),
              done: (
                <>
                  <Check className="w-3.5 h-3.5 text-[#137A4B] dark:text-[#34D399]" />
                  <span className="text-[#137A4B] dark:text-[#34D399]">Hoàn tất</span>
                </>
              ),
            }}
          />
        </div>
      </section>

      {/* HÀNG 3: NHẬT KÝ TOÀN BỘ GIAO DỊCH ĐẦU TƯ */}
      <section className="bg-white dark:bg-[#151B23] rounded-xl border border-[#E4E2DB] dark:border-[#262F3D] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E4E2DB] dark:border-[#262F3D] flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold text-[#141413] dark:text-[#ECEBE6]">
            Nhật ký giao dịch đầu tư ({investments.length})
          </h2>
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={() => {
                if (investments.length === 0) {
                  onToast('Chưa có giao dịch đầu tư nào để xuất CSV.', 'warning');
                  return;
                }
                exportInvestmentsToCsv(investments, wallets, usdtVndRate);
                onToast(`Đã xuất Sổ cái đầu tư (${investments.length} lệnh) kèm Lãi/Lỗ chốt ra CSV.`);
              }}
              className="aui-btn text-xs font-semibold text-[#63625C] dark:text-[#8E98A8] hover:text-[#141413] dark:hover:text-[#ECEBE6] flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất CSV</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenInvestModal('VN_STOCK')}
              className="aui-btn text-xs font-semibold text-[#0E5A4F] dark:text-[#38B29A] hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm lệnh</span>
            </button>
          </div>
        </div>
        {investments.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#63625C] dark:text-[#8E98A8]">
            Chưa có giao dịch mua/bán cổ phiếu hay crypto nào.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F6F5F1]/70 dark:bg-[#0D1117]/60 text-[11px] uppercase tracking-[0.04em] text-[#63625C] dark:text-[#8E98A8] border-b border-[#E4E2DB] dark:border-[#262F3D]">
                  <th className="py-2.5 px-4 font-semibold">Ngày</th>
                  <th className="py-2.5 px-3 font-semibold">Lệnh</th>
                  <th className="py-2.5 px-3 font-semibold">Mã</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Khối lượng</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Giá khớp</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Phí</th>
                  <th className="py-2.5 px-3 font-semibold">Ghi chú</th>
                  <th className="py-2.5 px-4 text-center font-semibold">Sửa / Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E2DB] dark:divide-[#262F3D]">
                {[...investments]
                  .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
                  .map((tx) => {
                    const isCr = tx.assetType === 'CRYPTO';
                    return (
                      <tr
                        key={tx.id}
                        className="hover:bg-[#F6F5F1]/70 dark:hover:bg-[#1C2430]/50 transition-colors"
                      >
                        <td className="py-2.5 px-4 text-[#63625C] dark:text-[#8E98A8] font-num">
                          {formatDateVN(tx.date)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`font-bold ${
                              tx.type === 'BUY'
                                ? 'text-[#137A4B] dark:text-[#34D399]'
                                : 'text-[#BE123C] dark:text-[#FB7185]'
                            }`}
                          >
                            {tx.type === 'BUY' ? 'MUA' : 'BÁN'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-[#141413] dark:text-[#ECEBE6]">
                          {tx.symbol}{' '}
                          <span className="text-[11px] font-normal text-[#63625C] dark:text-[#8E98A8]">
                            · {isCr ? 'USDT' : 'VNĐ'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-num font-medium text-[#141413] dark:text-[#ECEBE6]">
                          {formatQty(tx.quantity, isCr)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-num font-semibold text-[#141413] dark:text-[#ECEBE6]">
                          {isCr ? formatUSD(tx.price) : formatVND(tx.price)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-num text-[#63625C] dark:text-[#8E98A8]">
                          {tx.feeAmount
                            ? isCr
                              ? formatUSD(tx.feeAmount)
                              : formatVND(tx.feeAmount)
                            : '0'}
                        </td>
                        <td className="py-2.5 px-3 text-[#63625C] dark:text-[#8E98A8] max-w-[180px] truncate">
                          {tx.note || '—'}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onOpenInvestModal(tx.assetType, '', 'BUY', tx)}
                              className="text-[#63625C] dark:text-[#8E98A8] hover:text-[#0E5A4F] dark:hover:text-[#38B29A]"
                              title="Sửa"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteInvestment(tx)}
                              className="text-[#63625C] dark:text-[#8E98A8] hover:text-[#BE123C] dark:hover:text-[#FB7185]"
                              title="Xóa"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
