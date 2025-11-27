#!/bin/bash

echo "========================================="
echo "容器休眠问题诊断脚本"
echo "========================================="
echo ""

CONTAINER_NAME="file-classifier"

# 检查容器是否存在
if ! docker ps -a | grep -q "$CONTAINER_NAME"; then
    echo "❌ 容器 $CONTAINER_NAME 不存在"
    exit 1
fi

echo "1️⃣  容器状态检查"
echo "-----------------------------------------"
docker ps -a --filter "name=$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.CreatedAt}}"
echo ""

echo "2️⃣  容器启动时间"
echo "-----------------------------------------"
STARTED_AT=$(docker inspect $CONTAINER_NAME | grep -o '"StartedAt": "[^"]*"' | cut -d'"' -f4)
echo "最后启动: $STARTED_AT"
echo ""

echo "3️⃣  容器重启次数"
echo "-----------------------------------------"
RESTART_COUNT=$(docker inspect $CONTAINER_NAME | grep -o '"RestartCount": [0-9]*' | grep -o '[0-9]*')
echo "重启次数: $RESTART_COUNT"
echo ""

echo "4️⃣  最近的 Docker 事件 (过去 48 小时)"
echo "-----------------------------------------"
docker events --since 48h --until 1s --filter "container=$CONTAINER_NAME" 2>/dev/null || echo "没有事件记录"
echo ""

echo "5️⃣  容器进程状态"
echo "-----------------------------------------"
docker exec $CONTAINER_NAME ps aux 2>/dev/null || echo "无法获取进程信息"
echo ""

echo "6️⃣  日志文件检查"
echo "-----------------------------------------"
if [ -d "./logs" ]; then
    echo "日志文件:"
    ls -lh ./logs/
    echo ""
    
    if [ -f "./logs/system.log" ]; then
        echo "最后 5 条系统日志:"
        tail -5 ./logs/system.log
    fi
else
    echo "⚠️  日志目录不存在"
fi
echo ""

echo "7️⃣  心跳检测 (创建心跳监控)"
echo "-----------------------------------------"
HEARTBEAT_FILE="./logs/heartbeat.log"

if [ -f "$HEARTBEAT_FILE" ]; then
    echo "现有心跳记录:"
    tail -10 "$HEARTBEAT_FILE"
    echo ""
    
    # 检查心跳间隔
    echo "检查心跳断层..."
    awk '{
        if (prev) {
            diff = $1 - prev
            if (diff > 120) {
                printf "⚠️  检测到 %d 秒的心跳断层: %s -> %s\n", diff, strftime("%Y-%m-%d %H:%M:%S", prev), strftime("%Y-%m-%d %H:%M:%S", $1)
            }
        }
        prev = $1
    }' "$HEARTBEAT_FILE"
else
    echo "创建心跳监控..."
    docker exec -d $CONTAINER_NAME sh -c 'while true; do date +%s >> /app/logs/heartbeat.log; sleep 60; done'
    echo "✅ 心跳监控已启动，60秒后可查看 $HEARTBEAT_FILE"
fi
echo ""

echo "8️⃣  测试立即执行"
echo "-----------------------------------------"
echo "尝试手动执行一次任务..."
docker exec $CONTAINER_NAME bun run dist/index.js --once
echo ""

echo "========================================="
echo "诊断完成"
echo "========================================="
echo ""
echo "💡 建议:"
echo "  1. 检查上述日志，查找 'pause', 'stop', 'kill' 事件"
echo "  2. 如果重启次数 > 0，检查容器为什么重启"
echo "  3. 等待 2-3 分钟后运行 'tail -20 ./logs/heartbeat.log' 查看心跳"
echo "  4. 如果心跳有断层，说明容器确实被暂停了"
echo ""
