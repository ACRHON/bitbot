#!/bin/bash
# bitbot 一键启动脚本

set -e

echo "🚀 启动 bitbot 本地开发环境..."

# 检查依赖
if ! command -v npx &> /dev/null; then
    echo "❌ npx 未安装，请先安装 Node.js"
    exit 1
fi

# 安装根目录依赖（concurrently, localtunnel）
echo "📦 安装依赖..."
npm install

# 安装 frontend 依赖
echo "📦 安装前端依赖..."
cd frontend && npm install && cd ..

# 安装 workers 依赖
echo "📦 安装后端依赖..."
cd workers && npm install && cd ..

# 初始化本地 D1 数据库
echo "🗄️  初始化本地数据库..."
cd workers
if [ ! -f ".dev.vars" ]; then
    echo "# 本地开发环境变量" > .dev.vars
    echo "请创建 .dev.vars 文件配置 Cloudflare 凭据（如需要）"
fi

# 检查是否已有本地数据库
echo "⚠️  注意: 本地 D1 数据库需要 Cloudflare 凭据"
echo "如果提示需要登录，请先运行: npx wrangler login"
echo ""

# 启动服务
echo "🎉 启动服务..."
echo ""
echo "📍 访问地址:"
echo "   - 前端 H5: http://localhost:5173"
echo "   - 后端 API: http://localhost:8787"
echo "   - Tunnel 公网地址: 稍后显示在下方"
echo ""
echo "⚠️  Tunnel (localtunnel) 可能需要等待几秒才能获取公网 URL"
echo ""

# 启动
npm run dev
