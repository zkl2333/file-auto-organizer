# GitHub Actions 工作流说明

## Docker 自动构建和发布

### 功能说明

`docker-publish.yml` 工作流会在以下情况下自动触发：

- 推送到 `main` 或 `master` 分支
- 创建版本标签（如 `v1.0.0`）
- 创建 Pull Request

### 工作流程

1. **构建阶段**：使用 Docker Buildx 构建多平台镜像（linux/amd64, linux/arm64）
2. **发布阶段**：自动推送到 DockerHub（仅在非PR情况下）
3. **标签策略**：
   - 分支推送：使用分支名作为标签
   - 版本标签：使用语义化版本号
   - 主分支：额外添加 `latest` 标签

### 配置要求

#### 1. 设置 GitHub Secrets

在 GitHub 仓库设置中添加以下 Secrets：

- `DOCKER_USERNAME`: 您的 DockerHub 用户名
- `DOCKER_PASSWORD`: 您的 DockerHub 访问令牌（不是密码）

#### 2. 创建 DockerHub 访问令牌

1. 登录 [DockerHub](https://hub.docker.com/)
2. 进入 Account Settings → Security
3. 点击 "New Access Token"
4. 设置令牌名称和权限（建议选择 "Read & Write"）
5. 复制生成的令牌

#### 3. 配置 GitHub Secrets

1. 进入 GitHub 仓库 → Settings → Secrets and variables → Actions
2. 点击 "New repository secret"
3. 添加以下两个 secrets：
   - Name: `DOCKER_USERNAME`, Value: 您的 DockerHub 用户名
   - Name: `DOCKER_PASSWORD`, Value: 您的 DockerHub 访问令牌

### 使用方法

#### 自动发布

工作流会在以下情况自动运行：

```bash
# 推送到主分支（自动发布到 DockerHub）
git push origin main

# 创建版本标签（自动发布到 DockerHub）
git tag v1.0.0
git push origin v1.0.0
```

#### 手动触发

1. 进入 GitHub 仓库 → Actions
2. 选择 "Docker Build and Publish" 工作流
3. 点击 "Run workflow"
4. 选择分支并运行

### 镜像标签说明

- `latest`: 主分支的最新版本
- `main`: 主分支的当前版本
- `v1.0.0`: 特定版本标签
- `v1.0`: 主版本标签
- `v1`: 大版本标签

### 注意事项

1. 确保 Dockerfile 在项目根目录
2. 确保 package.json 中的构建脚本正确配置
3. 首次运行可能需要较长时间来构建和推送镜像
4. PR 只会构建镜像，不会推送到 DockerHub
5. 建议在发布前先在本地测试 Docker 构建

### 故障排除

#### 常见问题

1. **认证失败**：检查 DockerHub 用户名和访问令牌是否正确
2. **构建失败**：检查 Dockerfile 语法和依赖项
3. **推送失败**：确认 DockerHub 仓库存在且有推送权限

#### 调试方法

1. 查看 GitHub Actions 日志
2. 在本地运行 `docker build` 测试
3. 检查 Dockerfile 和依赖项配置
