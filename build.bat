@echo off
echo 使用宽松配置编译TypeScript...
npx tsc --project tsconfig.build.json
if %errorlevel% equ 0 (
  echo 编译成功！
  echo 输出目录: .\dist\
) else (
  echo 编译失败！
  pause
)
