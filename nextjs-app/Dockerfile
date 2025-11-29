FROM node:20-alpine

# 设置时区环境变量
ENV TZ=Asia/Shanghai
ENV NODE_ENV=production
ENV PORT=3000

# 安装时区数据和Perl（exiftool-vendored依赖）
RUN apk add --no-cache tzdata perl

WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["npm", "start"]