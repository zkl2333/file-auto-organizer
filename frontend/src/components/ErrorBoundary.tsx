import { useMemo, useState } from "react";
import {
  isRouteErrorResponse,
  useLocation,
  useNavigate,
  useRouteError,
} from "react-router-dom";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  CopyCheck,
  Home,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";

type CopyState = "idle" | "copied";

type ErrorMeta = {
  status: number;
  statusText: string;
  message: string;
  detail: string;
};

function safeStringify(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function buildErrorMeta(error: unknown): ErrorMeta {
  if (isRouteErrorResponse(error)) {
    const hasMessage =
      typeof error.data === "object" &&
      error.data !== null &&
      "message" in error.data &&
      typeof (error.data as { message: unknown }).message === "string";

    return {
      status: error.status,
      statusText: error.statusText || "请求失败",
      message: hasMessage
        ? (error.data as { message: string }).message
        : typeof error.data === "string"
          ? error.data
          : "请求被拒绝或资源不存在",
      detail: safeStringify(error.data),
    };
  }

  if (error instanceof Error) {
    return {
      status: 500,
      statusText: error.name || "Error",
      message: error.message || "发生未知错误",
      detail: error.stack || error.message,
    };
  }

  if (typeof error === "string") {
    return {
      status: 500,
      statusText: "Error",
      message: error,
      detail: error,
    };
  }

  return {
    status: 500,
    statusText: "Unexpected Error",
    message: "发生未知错误",
    detail: safeStringify(error),
  };
}

export default function AppErrorBoundary() {
  const location = useLocation();
  const routeError = useRouteError();
  const navigate = useNavigate();
  const [showDetails, setShowDetails] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>("idle");

  const errorMeta = useMemo(() => buildErrorMeta(routeError), [routeError]);
  const timestamp = useMemo(() => new Date().toLocaleString(), []);
  const pathLabel = `${location.pathname}${location.search}${location.hash}`;

  const detailsPayload = useMemo(() => {
    return [
      `Path: ${pathLabel}`,
      `Status: ${errorMeta.status} ${errorMeta.statusText}`,
      `Message: ${errorMeta.message}`,
      errorMeta.detail,
    ]
      .filter(Boolean)
      .join("\n\n");
  }, [errorMeta.detail, errorMeta.message, errorMeta.status, errorMeta.statusText, pathLabel]);

  const friendlyTitle =
    errorMeta.status >= 500 ? "系统暂时不可用" : "无法完成您的请求";

  const friendlyHint =
    errorMeta.status >= 500
      ? "我们的服务出现了短暂的异常，您可以稍后再试或刷新页面继续。"
      : "请检查请求参数或网络连接，然后重试。";

  const handleRetry = () => navigate(0);
  const handleBackHome = () => navigate("/");

  const handleCopy = async () => {
    if (!detailsPayload || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(detailsPayload);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch (error) {
      console.error("Failed to copy error details", error);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-6 py-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 rounded-3xl border border-border/60 bg-background/95 p-8 text-center shadow-lg shadow-black/5 backdrop-blur">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <TriangleAlert className="size-8" />
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground">
            Error {errorMeta.status}
          </p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            {friendlyTitle}
          </h1>
          <p className="text-balance text-base text-muted-foreground md:text-lg">
            {errorMeta.message}
          </p>
          <p className="text-sm text-muted-foreground/80">{friendlyHint}</p>
        </div>

        <div className="grid w-full gap-3 text-left text-sm text-muted-foreground md:grid-cols-3">
          <div className="rounded-2xl border bg-muted/40 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground/70">
              状态码
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {errorMeta.status}
            </p>
            <p className="text-xs text-muted-foreground">{errorMeta.statusText}</p>
          </div>
          <div className="rounded-2xl border bg-muted/40 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground/70">
              访问路径
            </p>
            <p className="mt-1 line-clamp-2 font-medium text-foreground">
              {pathLabel || "/"}
            </p>
          </div>
          <div className="rounded-2xl border bg-muted/40 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground/70">
              时间
            </p>
            <p className="mt-1 font-medium text-foreground">{timestamp}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button onClick={handleRetry} className="min-w-32 gap-2">
            <RefreshCw className="size-4" />
            重新加载
          </Button>
          <Button
            variant="outline"
            onClick={handleBackHome}
            className="min-w-32 gap-2"
          >
            <Home className="size-4" />
            返回仪表盘
          </Button>
          <Button
            variant="ghost"
            className="gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowDetails((value) => !value)}
          >
            {showDetails ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
            查看技术细节
          </Button>
        </div>

        {showDetails && (
          <div className="w-full rounded-2xl border border-dashed border-muted-foreground/50 bg-muted/40 p-4 text-left">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <span>technical details</span>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-muted-foreground hover:text-foreground"
                onClick={handleCopy}
                disabled={!detailsPayload}
              >
                {copyState === "copied" ? (
                  <>
                    <CopyCheck className="size-4" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy className="size-4" />
                    复制
                  </>
                )}
              </Button>
            </div>
            <pre className="max-h-64 overflow-auto rounded-xl bg-background/70 p-4 text-xs leading-relaxed text-muted-foreground">
              {detailsPayload || "暂无更多信息"}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
