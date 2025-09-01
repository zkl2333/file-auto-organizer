FROM node:20-alpine

WORKDIR /app

# 仅复制包管理文件并安装依赖（包含 dev，用于构建）
COPY package*.json ./
RUN npm install

# 复制 ts 配置与源码
COPY tsconfig.json ./
COPY ./src ./src

# 构建并移除 dev 依赖
RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production

# 启动命令
CMD ["node", "dist/index.js"]
