@echo off
REM bitbot 一键启动脚本 (Windows)

echo 🚀 启动 bitbot 本地开发环境...

REM 安装依赖
echo 📦 安装依赖...
call npm install
call cd frontend && npm install && cd ..
call cd workers && npm install && cd ..

echo 📍 访问地址:
echo    - 前端 H5: http://localhost:5173
echo    - 后端 API: http://localhost:8787
echo    - Tunnel 公网地址: 稍后显示在下方
echo.

REM 启动
echo 🎉 启动服务...
npm run dev
