import type { RouteObject } from 'react-router-dom';
import Layout from './routes/_layout';
import Index from './routes/_index';
import StatsLayout from './routes/stats/_layout';
import StatsIndex from './routes/stats/_index';
import StatsWithTimeRange from './routes/stats/$timeRange';
import Logs from './routes/logs';
import Trigger from './routes/trigger';
import Config from './routes/config';
import TaskHistory from './routes/task-history/_index';
import TaskDetail from './routes/task-history/$taskId';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Index />,
      },
      {
        path: 'stats',
        element: <StatsLayout />,
        children: [
          {
            index: true,
            element: <StatsIndex />,
          },
          {
            path: ':timeRange',
            element: <StatsWithTimeRange />,
          },
        ],
      },
      {
        path: 'logs',
        element: <Logs />,
      },
      {
        path: 'trigger',
        element: <Trigger />,
      },
      {
        path: 'config',
        element: <Config />,
      },
      {
        path: 'task-history',
        children: [
          {
            index: true,
            element: <TaskHistory />,
          },
          {
            path: ':taskId',
            element: <TaskDetail />,
          },
        ],
      },
    ],
  },
];
