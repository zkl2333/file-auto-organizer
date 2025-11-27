FROM node:20-alpine

# 设置时区环境变量
ENV TZ=Asia/Shanghai
ENV NODE_ENV=production

# 安装时区数据和Perl（exiftool-vendored依赖）
RUN apk add --no-cache tzdata perl

WORKDIR /app

# 复制 backend 包管理文件并安装依赖
COPY backend/package.json ./backend/
WORKDIR /app/backend
RUN npm install

# 复制 TypeScript 配置与源码
COPY backend/tsconfig.json ./
COPY backend/src ./src

# 构建项目
RUN npm run build

# 启动命令 - 直接运行构建后的文件
CMD ["node", "dist/index.js"]
