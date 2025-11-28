import { useNavigate } from 'react-router-dom';
import { TaskHistoryView } from '../../components/TaskHistoryView';

export default function TaskHistory() {
  const navigate = useNavigate();

  return (
    <TaskHistoryView onViewDetail={(taskId) => navigate(`/task-history/${taskId}`)} />
  );
}
