'use client';

import { useState } from 'react';
import { useTaskHistoryRealtime, useSmartRealtimeUpdates } from '@/hooks/useRealtimeUpdates';
import { api } from '@/lib/api-client';
import type { TaskRecord } from '@/lib/api-client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Clock,
  FileText,
  Zap,
  MoreVertical,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

const formatDuration = (ms: number): string => {
  if (!ms || ms < 0) return 'N/A';
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m${remainingSeconds}s`;
};

const formatTime = (isoTime: string): string => {
  if (!isoTime) return 'N/A';
  try {
    const date = new Date(isoTime);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return isoTime || 'N/A';
  }
};

const StatusBadge: React.FC<{ status: TaskRecord['status'] }> = ({ status }) => {
  switch (status) {
    case 'success':
      return (
        <Badge variant="outline" className="text-muted-foreground px-1.5">
          <CheckCircle className="fill-green-500 dark:fill-green-400 text-white w-3.5 h-3.5" />
          成功
        </Badge>
      );
    case 'partial':
      return (
        <Badge variant="outline" className="text-muted-foreground px-1.5">
          <AlertCircle className="fill-yellow-500 dark:fill-yellow-400 text-white w-3.5 h-3.5" />
          部分成功
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="outline" className="text-muted-foreground px-1.5">
          <XCircle className="fill-red-500 dark:fill-red-400 text-white w-3.5 h-3.5" />
          失败
        </Badge>
      );
    case 'running':
      return (
        <Badge variant="outline" className="text-muted-foreground px-1.5">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
          运行中
        </Badge>
      );
  }
};

interface TaskActionsProps {
  task: TaskRecord;
  onViewDetail?: (taskId: string) => void;
  onDeleteClick: (taskId: string) => void;
}

const TaskActions: React.FC<TaskActionsProps> = ({ task, onViewDetail, onDeleteClick }) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="data-[state=open]:bg-muted text-muted-foreground flex size-8"
          size="icon"
        >
          <MoreVertical className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={() => onViewDetail?.(task.taskId)}>
          <Eye className="w-4 h-4" />
          查看详情
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => onDeleteClick(task.taskId)}
          disabled={task.status === 'running'}
        >
          <Trash2 className="w-4 h-4" />
          删除记录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const TaskHistoryView: React.FC<{ onViewDetail?: (taskId: string) => void }> = ({
  onViewDetail,
}) => {
  const router = useRouter();

  // 使用智能实时更新
  const { taskHistory, error, isLoading, refreshHistory } = useTaskHistoryRealtime();
  useSmartRealtimeUpdates(); // 用于实时更新，但不需要返回值
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState(false);

  const tasks = taskHistory || [];

  // Pagination
  const pageCount = Math.ceil(tasks.length / pageSize);
  const paginatedTasks = tasks.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

  const canPreviousPage = pageIndex > 0;
  const canNextPage = pageIndex < pageCount - 1;

  // Selection helpers
  const selectableTasks = paginatedTasks.filter((t) => t.status !== 'running');
  const allSelectableSelected =
    selectableTasks.length > 0 && selectableTasks.every((t) => selectedIds.has(t.taskId));
  const someSelected = selectableTasks.some((t) => selectedIds.has(t.taskId));

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      const newSelected = new Set(selectedIds);
      selectableTasks.forEach((t) => newSelected.add(t.taskId));
      setSelectedIds(newSelected);
    } else {
      const newSelected = new Set(selectedIds);
      selectableTasks.forEach((t) => newSelected.delete(t.taskId));
      setSelectedIds(newSelected);
    }
  };

  const toggleSelect = (taskId: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(taskId);
    } else {
      newSelected.delete(taskId);
    }
    setSelectedIds(newSelected);
  };

  const handleDeleteClick = (taskId: string) => {
    setDeleteTaskId(taskId);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTaskId) return;

    setIsDeleting(true);
    try {
      const result = await api.deleteTask(deleteTaskId);
      if (result.success) {
        toast.success('任务记录已删除');
        selectedIds.delete(deleteTaskId);
        setSelectedIds(new Set(selectedIds));
        refreshHistory();
      } else {
        toast.error(result.message || '删除失败');
      }
    } catch {
      toast.error('删除失败');
    } finally {
      setIsDeleting(false);
      setDeleteTaskId(null);
    }
  };

  const handleBatchDeleteClick = () => {
    if (selectedIds.size === 0) return;
    setShowBatchDeleteDialog(true);
  };

  const handleBatchDeleteConfirm = async () => {
    if (selectedIds.size === 0) return;

    setIsDeleting(true);
    try {
      const result = await api.deleteTasks(Array.from(selectedIds));
      if (result.success) {
        toast.success(`已删除 ${result.deleted.length} 条记录`);
        setSelectedIds(new Set());
        refreshHistory();
      } else {
        toast.error(result.message || '批量删除失败');
      }
    } catch {
      toast.error('批量删除失败');
    } finally {
      setIsDeleting(false);
      setShowBatchDeleteDialog(false);
    }
  };

  const handleViewDetail = (taskId: string) => {
    if (onViewDetail) {
      onViewDetail(taskId);
    } else {
      // 使用 Next.js 路由导航到详情页面
      router.push(`/task-history/${taskId}`);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between px-4 lg:px-6">
        <div>
          <h2 className="text-lg font-semibold">任务执行历史</h2>
          <p className="text-sm text-muted-foreground">查看所有任务的执行记录和统计信息</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBatchDeleteClick}
              disabled={isDeleting}
            >
              <Trash2 className={`w-4 h-4 ${isDeleting ? 'animate-spin' : ''}`} />
              删除 ({selectedIds.size})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={refreshHistory} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden lg:inline">刷新</span>
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mx-4 lg:mx-6">
          <AlertDescription>{error.message || '加载任务历史失败'}</AlertDescription>
        </Alert>
      )}

      <div className="relative flex flex-col gap-4 px-4 lg:px-6">
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-12">
                  <div className="flex items-center justify-center">
                    <Checkbox
                      checked={allSelectableSelected || (someSelected ? 'indeterminate' : false)}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </div>
                </TableHead>
                <TableHead>任务ID</TableHead>
                <TableHead>开始时间</TableHead>
                <TableHead className="text-center">状态</TableHead>
                <TableHead className="text-right">耗时</TableHead>
                <TableHead className="text-right">处理文件</TableHead>
                <TableHead className="text-right hidden md:table-cell">相似度</TableHead>
                <TableHead className="text-right hidden md:table-cell">AI分类</TableHead>
                <TableHead className="text-right hidden lg:table-cell">Token</TableHead>
                <TableHead className="text-center w-12">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    加载中...
                  </TableCell>
                </TableRow>
              ) : paginatedTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                    暂无任务记录
                  </TableCell>
                </TableRow>
              ) : (
                paginatedTasks.map((task) => (
                  <TableRow
                    key={task.taskId}
                    className="group"
                    data-state={selectedIds.has(task.taskId) && 'selected'}
                  >
                    <TableCell>
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={selectedIds.has(task.taskId)}
                          onCheckedChange={(checked) => toggleSelect(task.taskId, !!checked)}
                          disabled={task.status === 'running'}
                          aria-label="Select row"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{task.taskId}</span>
                        {task.dryRun && (
                          <Badge variant="outline" className="text-xs px-1">
                            模拟
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatTime(task.startTime)}
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusBadge status={task.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span className="text-sm">
                          {task.status === 'running' ? '...' : formatDuration(task.duration)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <FileText className="w-3 h-3 text-muted-foreground" />
                        <span className="font-medium">{task.filesProcessed || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right hidden md:table-cell">
                      <span className="text-blue-600 dark:text-blue-400 font-medium">
                        {task.similarityMatched || 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-right hidden md:table-cell">
                      <span className="text-purple-600 dark:text-purple-400 font-medium">
                        {task.aiClassified || 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-right hidden lg:table-cell">
                      <div className="flex items-center justify-end gap-1">
                        <Zap className="w-3 h-3 text-orange-500" />
                        <span className="text-sm">{(task.tokensUsed || 0).toLocaleString()}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <TaskActions
                        task={task}
                        onViewDetail={handleViewDetail}
                        onDeleteClick={handleDeleteClick}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {tasks.length > 0 && (
          <div className="flex items-center justify-between px-2">
            <div className="text-muted-foreground text-sm hidden lg:flex flex-1">
              {selectedIds.size > 0 ? (
                <span>已选择 {selectedIds.size} 项</span>
              ) : (
                <span>共 {tasks.length} 条记录</span>
              )}
            </div>
            <div className="flex w-full items-center gap-6 lg:w-fit lg:gap-8">
              <div className="hidden items-center gap-2 lg:flex">
                <Label htmlFor="rows-per-page" className="text-sm font-medium">
                  每页
                </Label>
                <Select
                  value={`${pageSize}`}
                  onValueChange={(value) => {
                    setPageSize(Number(value));
                    setPageIndex(0);
                  }}
                >
                  <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                    <SelectValue placeholder={pageSize} />
                  </SelectTrigger>
                  <SelectContent side="top">
                    {[10, 20, 30, 50].map((size) => (
                      <SelectItem key={size} value={`${size}`}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex w-fit items-center justify-center text-sm font-medium">
                第 {pageIndex + 1} / {pageCount || 1} 页
              </div>
              <div className="ml-auto flex items-center gap-2 lg:ml-0">
                <Button
                  variant="outline"
                  className="hidden h-8 w-8 p-0 lg:flex"
                  onClick={() => setPageIndex(0)}
                  disabled={!canPreviousPage}
                >
                  <span className="sr-only">Go to first page</span>
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="size-8"
                  size="icon"
                  onClick={() => setPageIndex((prev) => prev - 1)}
                  disabled={!canPreviousPage}
                >
                  <span className="sr-only">Go to previous page</span>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="size-8"
                  size="icon"
                  onClick={() => setPageIndex((prev) => prev + 1)}
                  disabled={!canNextPage}
                >
                  <span className="sr-only">Go to next page</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="hidden size-8 lg:flex"
                  size="icon"
                  onClick={() => setPageIndex(pageCount - 1)}
                  disabled={!canNextPage}
                >
                  <span className="sr-only">Go to last page</span>
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden px-4 space-y-3">
        {!isLoading &&
          paginatedTasks.map((task) => (
            <div
              key={task.taskId}
              className={`border rounded-lg p-4 space-y-3 bg-card ${
                selectedIds.has(task.taskId) ? 'ring-2 ring-primary' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedIds.has(task.taskId)}
                    onCheckedChange={(checked) => toggleSelect(task.taskId, !!checked)}
                    disabled={task.status === 'running'}
                    aria-label="Select row"
                  />
                  <StatusBadge status={task.status} />
                  {task.dryRun && (
                    <Badge variant="outline" className="text-xs">
                      模拟
                    </Badge>
                  )}
                </div>
                <TaskActions
                  task={task}
                  onViewDetail={handleViewDetail}
                  onDeleteClick={handleDeleteClick}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs">任务ID</div>
                  <div className="font-mono text-xs">{task.taskId?.slice(-12) || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">耗时</div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span>{formatDuration(task.duration)}</span>
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">处理文件</div>
                  <div className="font-medium">{task.filesProcessed || 0}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Token</div>
                  <div className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-orange-500" />
                    <span>{(task.tokensUsed || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm border-t pt-2">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">相似度:</span>
                  <span className="text-blue-600 font-medium">{task.similarityMatched || 0}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">AI:</span>
                  <span className="text-purple-600 font-medium">{task.aiClassified || 0}</span>
                </div>
              </div>

              <div className="text-xs text-muted-foreground">{formatTime(task.startTime)}</div>
            </div>
          ))}
      </div>

      {/* 单个删除确认对话框 */}
      <AlertDialog
        open={deleteTaskId !== null}
        onOpenChange={(open) => !open && setDeleteTaskId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除此任务记录吗？此操作将同时删除任务记录和对应的日志目录，且无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              variant="destructive"
            >
              {isDeleting ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 批量删除确认对话框 */}
      <AlertDialog open={showBatchDeleteDialog} onOpenChange={setShowBatchDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除选中的 {selectedIds.size}{' '}
              条任务记录吗？此操作将同时删除任务记录和对应的日志目录，且无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchDeleteConfirm}
              disabled={isDeleting}
              variant="destructive"
            >
              {isDeleting ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TaskHistoryView;
