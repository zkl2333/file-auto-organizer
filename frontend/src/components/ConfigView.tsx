import React, { useEffect, useState } from "react";
import { api, type ConfigJson } from "../api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { IconLoader2 } from "@tabler/icons-react";

const defaultConfig: ConfigJson = {
  openai: {
    api_key: "",
    model: "gpt-4o-mini",
    base_url: "",
  },
  directories: {
    root_dir: "./分类库",
    incoming_dir: "./待分类",
  },
  cron: {
    enabled: true,
    schedule: "0 * * * *",
  },
  logging: {
    level: "info",
    dir: "./logs",
  },
  scan: {
    max_depth: 3,
    similarity_threshold: 0.65,
  },
  ai: {
    batch_size: 5,
  },
  file_operations: {
    max_retries: 3,
    retry_delay_base: 1000,
  },
};

export const ConfigView: React.FC = () => {
  const [config, setConfig] = useState<ConfigJson>(defaultConfig);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await api.getConfig();
      if (data.json) {
        setConfig({ ...defaultConfig, ...data.json });
      }
      setMessage({ type: "info", text: "配置修改后无需重启，将在下次任务执行时生效" });
    } catch (err) {
      setMessage({
        type: "error",
        text: "加载失败: " + (err instanceof Error ? err.message : String(err)),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await api.updateConfigJson(config);
      if (res.success) {
        setMessage({ type: "success", text: res.message });
      } else {
        setMessage({ type: "error", text: res.message + (res.error ? ": " + res.error : "") });
      }
    } catch (err) {
      setMessage({
        type: "error",
        text: "保存失败: " + (err instanceof Error ? err.message : String(err)),
      });
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = <K extends keyof ConfigJson>(
    section: K,
    key: keyof ConfigJson[K],
    value: string | number | boolean
  ) => {
    setConfig((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">加载中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <Alert
          variant={message.type === "error" ? "destructive" : "default"}
          className={
            message.type === "success"
              ? "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400"
              : message.type === "info"
              ? "border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-400"
              : ""
          }
        >
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* OpenAI 配置 */}
      <Card>
        <CardHeader>
          <CardTitle>AI 服务配置</CardTitle>
          <CardDescription>配置 OpenAI API 相关参数</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="api_key">API Key</Label>
            <Input
              id="api_key"
              type="password"
              placeholder="sk-..."
              value={config.openai.api_key}
              onChange={(e) => updateConfig("openai", "api_key", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="model">模型</Label>
              <Input
                id="model"
                placeholder="gpt-4o-mini"
                value={config.openai.model}
                onChange={(e) => updateConfig("openai", "model", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="base_url">Base URL (可选)</Label>
              <Input
                id="base_url"
                placeholder="https://api.openai.com/v1"
                value={config.openai.base_url}
                onChange={(e) => updateConfig("openai", "base_url", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 目录配置 */}
      <Card>
        <CardHeader>
          <CardTitle>目录配置</CardTitle>
          <CardDescription>设置文件分类相关目录</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="root_dir">分类库目录</Label>
              <Input
                id="root_dir"
                placeholder="./分类库"
                value={config.directories.root_dir}
                onChange={(e) => updateConfig("directories", "root_dir", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="incoming_dir">待分类目录</Label>
              <Input
                id="incoming_dir"
                placeholder="./待分类"
                value={config.directories.incoming_dir}
                onChange={(e) => updateConfig("directories", "incoming_dir", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 定时任务配置 */}
      <Card>
        <CardHeader>
          <CardTitle>定时任务</CardTitle>
          <CardDescription>配置自动执行的定时任务</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="cron-enabled" className="text-sm font-medium">
                启用定时任务
              </Label>
              <p className="text-xs text-muted-foreground">
                关闭后将在下次任务执行时生效，无需重启服务
              </p>
            </div>
            <Checkbox
              id="cron-enabled"
              checked={config.cron.enabled}
              onCheckedChange={(checked) => updateConfig("cron", "enabled", checked === true)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="schedule">Cron 表达式</Label>
            <Input
              id="schedule"
              placeholder="0 * * * *"
              value={config.cron.schedule}
              onChange={(e) => updateConfig("cron", "schedule", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              示例：0 * * * * (每小时)、0 0 * * * (每天)、*/30 * * * * (每30分钟)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 日志配置 */}
      <Card>
        <CardHeader>
          <CardTitle>日志配置</CardTitle>
          <CardDescription>配置日志级别和存储位置</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="log_level">日志级别</Label>
              <Select
                value={config.logging.level}
                onValueChange={(value) => updateConfig("logging", "level", value)}
              >
                <SelectTrigger id="log_level">
                  <SelectValue placeholder="选择日志级别" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trace">Trace</SelectItem>
                  <SelectItem value="debug">Debug</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warn">Warn</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="log_dir">日志目录</Label>
              <Input
                id="log_dir"
                placeholder="./logs"
                value={config.logging.dir}
                onChange={(e) => updateConfig("logging", "dir", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 扫描配置 */}
      <Card>
        <CardHeader>
          <CardTitle>扫描配置</CardTitle>
          <CardDescription>配置文件扫描参数</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="max_depth">最大扫描深度</Label>
              <Input
                id="max_depth"
                type="number"
                min={1}
                max={10}
                value={config.scan.max_depth}
                onChange={(e) => updateConfig("scan", "max_depth", parseInt(e.target.value) || 3)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="similarity_threshold">相似度阈值</Label>
              <Input
                id="similarity_threshold"
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={config.scan.similarity_threshold}
                onChange={(e) =>
                  updateConfig("scan", "similarity_threshold", parseFloat(e.target.value) || 0.65)
                }
              />
              <p className="text-xs text-muted-foreground">范围 0-1，值越高匹配越严格</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI 批处理配置 */}
      <Card>
        <CardHeader>
          <CardTitle>AI 批处理</CardTitle>
          <CardDescription>配置 AI 分类批处理参数</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            <Label htmlFor="batch_size">批处理大小</Label>
            <Input
              id="batch_size"
              type="number"
              min={1}
              max={20}
              value={config.ai.batch_size}
              onChange={(e) => updateConfig("ai", "batch_size", parseInt(e.target.value) || 5)}
            />
            <p className="text-xs text-muted-foreground">每次 AI 请求处理的文件数量</p>
          </div>
        </CardContent>
      </Card>

      {/* 文件操作配置 */}
      <Card>
        <CardHeader>
          <CardTitle>文件操作</CardTitle>
          <CardDescription>配置文件移动重试参数</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="max_retries">最大重试次数</Label>
              <Input
                id="max_retries"
                type="number"
                min={1}
                max={10}
                value={config.file_operations.max_retries}
                onChange={(e) =>
                  updateConfig("file_operations", "max_retries", parseInt(e.target.value) || 3)
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="retry_delay_base">重试延迟基数 (ms)</Label>
              <Input
                id="retry_delay_base"
                type="number"
                min={100}
                max={10000}
                step={100}
                value={config.file_operations.retry_delay_base}
                onChange={(e) =>
                  updateConfig(
                    "file_operations",
                    "retry_delay_base",
                    parseInt(e.target.value) || 1000
                  )
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
        {saving ? (
          <>
            <IconLoader2 className="mr-2 size-4 animate-spin" />
            保存中...
          </>
        ) : (
          "保存配置"
        )}
      </Button>
    </div>
  );
};
