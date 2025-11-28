import { Navigate } from 'react-router-dom';

export default function StatsIndex() {
  // 默认重定向到 7 天视图
  return <Navigate to="/stats/week" replace />;
}
