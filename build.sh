#!/bin/bash

# 使用宽松的配置编译
npx tsc --project tsconfig.build.json

echo "编译完成！"
echo "输出目录: ./dist/"
