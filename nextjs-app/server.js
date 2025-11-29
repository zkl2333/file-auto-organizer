const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 8080;

// 创建 Next.js 应用
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// 启动服务器
app
  .prepare()
  .then(() => {
    createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);

        // 处理 Next.js 请求
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('服务器错误:', err);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    })
      .once('error', (err) => {
        console.error('服务器启动失败:', err);
        process.exit(1);
      })
      .listen(port, () => {
        console.log(`🚀 Next.js 服务器启动成功`);
        console.log(`> Ready on http://${hostname}:${port}`);
      });

    // 监听服务器关闭
    process.on('SIGINT', () => {
      console.log('收到关闭信号，正在关闭服务器...');
      process.exit(0);
    });
  })
  .catch((err) => {
    console.error('Next.js 应用准备失败:', err);
    process.exit(1);
  });
