import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IconFolder, IconFile, IconChevronLeft, IconHome } from '@tabler/icons-react';
import { api, type FileItem, type FileListResponse } from '@/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function FilesView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FileListResponse | null>(null);
  const [base, setBase] = useState<'root' | 'incoming'>(
    (searchParams.get('base') as 'root' | 'incoming') || 'root'
  );
  const currentPath = searchParams.get('path') || '';

  useEffect(() => {
    loadFiles();
  }, [currentPath, base]);

  const loadFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getFiles(currentPath || undefined, base);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const navigateToPath = (path: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (path) {
      newParams.set('path', path);
    } else {
      newParams.delete('path');
    }
    setSearchParams(newParams);
  };

  const goBack = () => {
    if (!currentPath) return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    navigateToPath(parts.join('/'));
  };

  const formatSize = (bytes: number | null): string => {
    if (bytes === null) return '-';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  const handleItemClick = (item: FileItem) => {
    if (item.type === 'directory') {
      navigateToPath(item.path);
    }
  };

  const pathParts = currentPath ? currentPath.split('/').filter(Boolean) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setBase('root');
              navigateToPath('');
            }}
          >
            <IconHome className="h-4 w-4 mr-2" />
            根目录
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setBase('incoming');
              navigateToPath('');
            }}
          >
            <IconHome className="h-4 w-4 mr-2" />
            待分类目录
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {currentPath && (
            <Button variant="outline" size="sm" onClick={goBack}>
              <IconChevronLeft className="h-4 w-4 mr-2" />
              返回
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>文件导航</CardTitle>
          <CardDescription>
            {base === 'root' ? '根目录' : '待分类目录'}
            {pathParts.length > 0 && ` / ${pathParts.join(' / ')}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : data?.type === 'directory' && data.items ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">类型</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead className="text-right">大小</TableHead>
                  <TableHead>修改时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      目录为空
                    </TableCell>
                  </TableRow>
                ) : (
                  data.items.map((item) => (
                    <TableRow
                      key={item.path}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleItemClick(item)}
                    >
                      <TableCell>
                        {item.type === 'directory' ? (
                          <IconFolder className="h-5 w-5 text-blue-500" />
                        ) : (
                          <IconFile className="h-5 w-5 text-gray-500" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-right">
                        {item.type === 'directory' ? '-' : formatSize(item.size)}
                      </TableCell>
                      <TableCell>{formatDate(item.modified)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : (
            <Alert>
              <AlertDescription>未知的数据类型</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
