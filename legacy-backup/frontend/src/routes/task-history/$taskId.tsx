import { useParams, useNavigate } from 'react-router-dom';
import { TaskDetailView } from '../../components/TaskDetailView';

export default function TaskDetail() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();

  if (!taskId) {
    navigate('/task-history');
    return null;
  }

  return <TaskDetailView taskId={taskId} onBack={() => navigate('/task-history')} />;
}
