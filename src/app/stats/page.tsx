import { redirect } from 'next/navigation';

export default function StatsPage() {
  // 默认重定向到 /stats/week
  redirect('/stats/week');
}
