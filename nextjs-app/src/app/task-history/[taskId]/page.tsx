'use client';

import { useParams, useRouter } from 'next/navigation';
import { TaskDetailView } from '@/components/TaskDetailView';

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.taskId as string;

  if (!taskId) {
    router.push('/task-history');
    return null;
  }

  return <TaskDetailView taskId={taskId} onBack={() => router.push('/task-history')} />;
}
