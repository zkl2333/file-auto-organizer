import { useState } from 'react';
import { TaskHistoryView } from '../components/TaskHistoryView';
import { TaskDetailView } from '../components/TaskDetailView';

export default function TaskHistory() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  return (
    <div className="p-6">
      {selectedTaskId ? (
        <TaskDetailView 
          taskId={selectedTaskId} 
          onBack={() => setSelectedTaskId(null)} 
        />
      ) : (
        <TaskHistoryView onViewDetail={setSelectedTaskId} />
      )}
    </div>
  );
}
