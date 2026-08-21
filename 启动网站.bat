@echo off
chcp 65001 >nul
title 孔丽园的个人简历 - 本地服务器

echo ============================================
echo   孔丽园的个人简历 - 启动本地服务器
echo ============================================
echo.

rem 检查是否安装了 Python
where python >nul 2>&1
if %errorlevel%==0 (
    echo [信息] 使用 Python 启动本地服务器...
    echo.
    echo [提示] 服务器启动后，请在浏览器中访问: http://localhost:8090
    echo.
    echo [提示] 按 Ctrl+C 可停止服务器
    echo ============================================
    echo.
    start "" "http://localhost:8090"
    python -m http.server 8090
) else (
    where python3 >nul 2>&1
    if %errorlevel%==0 (
        echo [信息] 使用 Python3 启动本地服务器...
        start "" "http://localhost:8090"
        python3 -m http.server 8090
    ) else (
        echo [错误] 未检测到 Python！
        echo.
        echo 请先安装 Python：
        echo   1. 访问 https://www.python.org/downloads/ 下载 Python
        echo   2. 安装时勾选 "Add Python to PATH"
        echo   3. 安装完成后重新运行此脚本
        echo.
        pause
        exit /b 1
    )
)
