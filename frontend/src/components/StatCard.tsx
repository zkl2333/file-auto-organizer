import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  /** 卡片标题 */
  title: string;
  /** 统计数值 */
  value: number | string;
  /** 数值单位 */
  unit: string;
  /** 图标组件 */
  icon: LucideIcon;
  /** Badge 标签文本 */
  badge: string;
  /** 主题色 (purple | orange | green | blue) */
  theme: "purple" | "orange" | "green" | "blue";
  /** 底部额外信息 (可选) */
  footer?: React.ReactNode;
  /** 格式化数值的函数 (可选) */
  formatValue?: (value: number) => string;
}

const themeConfig = {
  purple: {
    gradient: "from-purple-50 to-purple-100/50 dark:from-purple-950/20 dark:to-purple-900/20",
    blur: "bg-purple-500/10",
    iconBg: "bg-purple-500/20 dark:bg-purple-500/10",
    iconColor: "text-purple-600 dark:text-purple-400",
    badgeBg: "bg-purple-100/50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    titleColor: "text-purple-700 dark:text-purple-300",
    valueColor: "text-purple-900 dark:text-purple-100",
    unitColor: "text-purple-600 dark:text-purple-400",
  },
  orange: {
    gradient: "from-orange-50 to-orange-100/50 dark:from-orange-950/20 dark:to-orange-900/20",
    blur: "bg-orange-500/10",
    iconBg: "bg-orange-500/20 dark:bg-orange-500/10",
    iconColor: "text-orange-600 dark:text-orange-400",
    badgeBg: "bg-orange-100/50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    titleColor: "text-orange-700 dark:text-orange-300",
    valueColor: "text-orange-900 dark:text-orange-100",
    unitColor: "text-orange-600 dark:text-orange-400",
  },
  green: {
    gradient: "from-green-50 to-green-100/50 dark:from-green-950/20 dark:to-green-900/20",
    blur: "bg-green-500/10",
    iconBg: "bg-green-500/20 dark:bg-green-500/10",
    iconColor: "text-green-600 dark:text-green-400",
    badgeBg: "bg-green-100/50 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    titleColor: "text-green-700 dark:text-green-300",
    valueColor: "text-green-900 dark:text-green-100",
    unitColor: "text-green-600 dark:text-green-400",
  },
  blue: {
    gradient: "from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/20",
    blur: "bg-blue-500/10",
    iconBg: "bg-blue-500/20 dark:bg-blue-500/10",
    iconColor: "text-blue-600 dark:text-blue-400",
    badgeBg: "bg-blue-100/50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    titleColor: "text-blue-700 dark:text-blue-300",
    valueColor: "text-blue-900 dark:text-blue-100",
    unitColor: "text-blue-600 dark:text-blue-400",
  },
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  unit,
  icon: Icon,
  badge,
  theme,
  footer,
  formatValue,
}) => {
  const config = themeConfig[theme];
  const displayValue = formatValue && typeof value === "number" 
    ? formatValue(value) 
    : value;

  return (
    <Card 
      className={`py-0 relative overflow-hidden border-0 bg-linear-to-br ${config.gradient} group hover:shadow-xl transition-all duration-500 ease-out`}
    >
      <div className={`absolute top-0 right-0 w-24 h-24 ${config.blur} rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700`} />
      <CardContent className="p-6 relative">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-xl ${config.iconBg} group-hover:scale-110 transition-transform duration-300`}>
            <Icon className={`w-5 h-5 ${config.iconColor}`} />
          </div>
          <Badge
            variant="secondary"
            className={config.badgeBg}
          >
            {badge}
          </Badge>
        </div>
        <div className="space-y-2">
          <p className={`text-sm font-medium ${config.titleColor}`}>
            {title}
          </p>
          <div className="flex items-baseline gap-2">
            <h3 className={`text-3xl font-bold ${config.valueColor}`}>
              {displayValue}
            </h3>
            <span className={`text-xs ${config.unitColor}`}>
              {unit}
            </span>
          </div>
          {footer && <div>{footer}</div>}
        </div>
      </CardContent>
    </Card>
  );
};

