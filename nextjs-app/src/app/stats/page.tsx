import { redirect } from 'next/navigation';

export default function StatsRedirect() {
  redirect('/dashboard/stats');
}
