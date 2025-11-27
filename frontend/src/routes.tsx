import type { RouteObject } from 'react-router-dom';
import Layout from './routes/_layout';
import Index from './routes/_index';
import Stats from './routes/stats';
import Logs from './routes/logs';
import Trigger from './routes/trigger';
import Config from './routes/config';
import Files from './routes/files';

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
        element: <Stats />,
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
        path: 'files',
        element: <Files />,
      },
    ],
  },
];
