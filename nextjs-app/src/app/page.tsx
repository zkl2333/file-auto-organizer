import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect to stats page (default view)
  redirect('/stats');
}
