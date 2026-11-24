import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let friendly = error.message || 'Đã xảy ra sự cố không mong muốn.';
    try {
      const parsed = JSON.parse(error.message);
      if (parsed?.error && parsed?.operationType) {
        friendly = `Lỗi đồng bộ cơ sở dữ liệu (${parsed.operationType}): ${parsed.error}`;
      }
    } catch {
      // Plain error string
    }
    return { hasError: true, errorMessage: friendly };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('FinFlow ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F6F5F1] dark:bg-[#0D1117] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white dark:bg-[#151B23] border border-[#E4E2DB] dark:border-[#262F3D] rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-[#BE123C] dark:text-[#FB7185]">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h2 className="font-display text-lg font-semibold text-[#141413] dark:text-[#ECEBE6]">
                FinFlow tạm thời gián đoạn
              </h2>
            </div>
            <p className="text-sm text-[#63625C] dark:text-[#8E98A8] leading-relaxed">
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '' });
                window.location.reload();
              }}
              className="aui-btn inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0E5A4F] hover:bg-[#0A463D] dark:bg-[#38B29A] dark:hover:bg-[#2E9B86] text-white dark:text-[#0D1117] text-sm font-semibold"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Tải lại ứng dụng</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
