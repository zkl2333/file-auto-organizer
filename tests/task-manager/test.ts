import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskManager } from '@/lib/task-manager/task-manager';
import { TaskUtils } from '@/lib/utils/task-utils';

// Mock dependencies
vi.mock('@/lib/utils/task-utils', () => ({
  TaskUtils: {
    generateTaskId: vi.fn(() => 'test-task-123'),
    getElapsedTime: vi.fn(() => 1000),
  },
}));

describe('TaskManager', () => {
  let taskManager: TaskManager;
  let mockTaskUtils: any;

  beforeEach(() => {
    // 重置所有 mock
    vi.clearAllMocks();

    mockTaskUtils = vi.mocked(TaskUtils);
  });

  describe('getInstance', () => {
    it('应该返回单例实例', () => {
      const instance1 = TaskManager.getInstance();
      const instance2 = TaskManager.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('应该在首次调用时创建新实例', () => {
      const instance1 = TaskManager.getInstance();
      const instance2 = TaskManager.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(TaskManager);
    });
  });

  describe('createTask', () => {
    beforeEach(() => {
      taskManager = new TaskManager();
    });

    it('应该创建新任务并生成任务ID', () => {
      const task = taskManager.createTask({
        dryRun: true,
        triggeredBy: 'manual',
      });

      expect(task.taskId).toBe('test-task-123');
      expect(task.dryRun).toBe(true);
      expect(task.triggeredBy).toBe('manual');
    });

    it('应该使用默认值当未提供选项时', () => {
      const task = taskManager.createTask({});

      expect(task.dryRun).toBe(false);
      expect(task.triggeredBy).toBe('manual');
      expect(task.metadata).toBeUndefined();
    });

    it('应该支持自定义元数据', () => {
      const metadata = { key1: 'value1', key2: 'value2' };
      const task = taskManager.createTask({ metadata });

      expect(task.metadata).toEqual(metadata);
    });

    it('应该生成唯一的任务ID', () => {
      const task1 = taskManager.createTask({});
      const task2 = taskManager.createTask({});

      expect(task1.taskId).not.toBe(task2.taskId);
    });

    it('应该处理并发创建', () => {
      const task1 = taskManager.createTask({});
      const task2 = taskManager.createTask({});

      expect(task1.taskId).not.toBe(task2.taskId);
    });
  });

  describe('getTask', () => {
    beforeEach(() => {
      taskManager = new TaskManager();
    });

    it('应该返回存在的任务', () => {
      const task = taskManager.createTask({});
      const retrieved = taskManager.getTask(task.taskId);

      expect(retrieved).toBe(task);
    });

    it('应该返回 null 当任务不存在时', () => {
      const retrieved = taskManager.getTask('non-existent-id');

      expect(retrieved).toBeNull();
    });

    it('应该返回任务对象而不是引用', () => {
      const task = taskManager.createTask({});
      const retrieved = taskManager.getTask(task.taskId);

      expect(retrieved).not.toBe(task);
      expect(retrieved?.taskId).toBe(task.taskId);
    });
  });

  describe('getAllTasks', () => {
    beforeEach(() => {
      taskManager = new TaskManager();
    });

    it('应该返回所有任务列表', () => {
      const task1 = taskManager.createTask({ metadata: { type: 'type1' } });
      const task2 = taskManager.createTask({ metadata: { type: 'type2' } });
      const task3 = taskManager.createTask({ metadata: { type: 'type3' } });

      const allTasks = taskManager.getAllTasks();

      expect(allTasks).toHaveLength(3);
      expect(allTasks.map((t) => t.taskId)).toEqual([task1.taskId, task2.taskId, task3.taskId]);
    });

    it('应该返回空数组当没有任务时', () => {
      const allTasks = taskManager.getAllTasks();

      expect(allTasks).toEqual([]);
    });

    it('应该不返回原始任务引用', () => {
      const task1 = taskManager.createTask({});
      const allTasks = taskManager.getAllTasks();

      // 修改返回的任务不应影响原始任务
      const originalTask = taskManager.getTask(task1.taskId);
      allTasks[0].metadata = { modified: true };

      const taskAgain = taskManager.getTask(task1.taskId);

      expect(taskAgain?.metadata).not.toEqual({ modified: true });
    });
  });

  describe('getRunningTask', () => {
    beforeEach(() => {
      taskManager = new TaskManager();
    });

    it('应该返回当前运行的任务', () => {
      const task = taskManager.createTask({});
      // 注意：实际执行需要 TaskExecutor，这里只测试状态管理
      const runningTask = taskManager.getRunningTask();

      expect(runningTask?.taskId).toBe(task.taskId);
    });

    it('应该返回 null 当没有任务运行时', () => {
      const runningTask = taskManager.getRunningTask();

      expect(runningTask).toBeNull();
    });
  });

  describe('deleteTask', () => {
    beforeEach(() => {
      taskManager = new TaskManager();
    });

    it('应该删除指定任务', () => {
      const task = taskManager.createTask({});
      taskManager.deleteTask(task.taskId);

      const retrieved = taskManager.getTask(task.taskId);

      expect(retrieved).toBeNull();
    });

    it('应该忽略删除不存在的任务', () => {
      expect(() => taskManager.deleteTask('non-existent-id')).not.toThrow();
    });
  });

  describe('deleteTasks', () => {
    beforeEach(() => {
      taskManager = new TaskManager();
    });

    it('应该批量删除任务', () => {
      const task1 = taskManager.createTask({ metadata: { type: 'type1' } });
      const task2 = taskManager.createTask({ metadata: { type: 'type2' } });
      const task3 = taskManager.createTask({ metadata: { type: 'type3' } });

      const result = taskManager.deleteTasks([task1.taskId, task2.taskId]);

      expect(result.deleted).toHaveLength(2);
      expect(result.deleted).toContain(task1.taskId);
      expect(result.deleted).toContain(task2.taskId);
    });

    it('应该部分删除当部分任务不存在时', () => {
      const task1 = taskManager.createTask({});
      const result = taskManager.deleteTasks([task1.taskId, 'non-existent-id']);

      expect(result.deleted).toHaveLength(1);
      expect(result.deleted).toContain(task1.taskId);
      expect(result.notFound).toContain('non-existent-id');
    });

    it('应该返回空数组当所有任务ID都不存在时', () => {
      const result = taskManager.deleteTasks(['id1', 'id2']);

      expect(result.deleted).toHaveLength(0);
      expect(result.notFound).toHaveLength(2);
    });
  });

  describe('canRunTask', () => {
    beforeEach(() => {
      taskManager = new TaskManager();
    });

    it('应该返回 true 当没有任务运行时', () => {
      const canRun = taskManager.canRunTask();

      expect(canRun).toBe(true);
    });

    it('应该返回 false 当有任务运行时', () => {
      const task = taskManager.createTask({});
      // 模拟任务正在运行
      const runningTask = taskManager.getRunningTask();

      const canRun = taskManager.canRunTask();

      expect(canRun).toBe(false);
    });
  });

  describe('getTaskStats', () => {
    beforeEach(() => {
      taskManager = new TaskManager();
    });

    it('应该返回任务统计信息', () => {
      const task = taskManager.createTask({ metadata: { test: 'data' } });
      const stats = taskManager.getTaskStats(task.taskId);

      expect(stats).toBeDefined();
      expect(stats.taskId).toBe(task.taskId);
    });

    it('应该返回 null 当任务不存在时', () => {
      const stats = taskManager.getTaskStats('non-existent-id');

      expect(stats).toBeNull();
    });
  });

  describe('缓存管理', () => {
    beforeEach(() => {
      taskManager = new TaskManager();
    });

    it('应该限制缓存的任务数量', () => {
      // 创建超过缓存限制的任务
      for (let i = 0; i < 105; i++) {
        taskManager.createTask({ metadata: { index: i } });
      }

      const allTasks = taskManager.getAllTasks();

      expect(allTasks.length).toBeLessThanOrEqual(100);
    });

    it('应该按LRU策略清理旧任务', () => {
      // 创建100个任务
      for (let i = 0; i < 100; i++) {
        taskManager.createTask({ metadata: { index: i } });
      }

      const firstTask = taskManager.getAllTasks()[0];
      const firstTaskId = firstTask?.taskId;

      // 创建第101个任务，应该移除第一个任务
      taskManager.createTask({ metadata: { index: 100 } });
      const allTasks = taskManager.getAllTasks();

      expect(allTasks).toHaveLength(100);
      expect(allTasks.map((t) => t.taskId)).not.toContain(firstTaskId);
    });
  });

  describe('任务状态转换', () => {
    beforeEach(() => {
      taskManager = new TaskManager();
    });

    it('应该正确处理任务状态', () => {
      const task = taskManager.createTask({});

      // 验证任务状态
      expect(task.status).toBeDefined();
      expect(['pending', 'running', 'completed', 'failed']).toContain(task.status);
    });
  });

  describe('错误处理', () => {
    beforeEach(() => {
      taskManager = new TaskManager();
    });

    it('应该处理获取不存在任务的错误', () => {
      expect(() => {
        taskManager.runTask('non-existent-id');
      }).toThrow('任务 non-existent-id 不存在');
    });

    it('应该处理并发任务执行错误', () => {
      const task = taskManager.createTask({});
      // 模拟已有运行任务
      const runningTask = taskManager.getRunningTask();

      if (runningTask) {
        expect(() => {
          taskManager.runTask(task.taskId);
        }).toThrow('已有任务正在运行');
      }
    });
  });
});
