#!/bin/bash

# 设置基本URL
BASE_URL="http://localhost:3000"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 从环境变量获取JWT_SECRET
JWT_SECRET="92f7087863c9e280a160ba4c2b5f9acc50925b5e64d8b9834c2a5a72c50e57972558a1d2104ccd54b3107785f47ada0582b158ac2cf23da093cb8a5da05bfb4a"

echo -e "${BLUE}=== JWT 认证测试脚本 ===${NC}"
echo "使用 JWT_SECRET: ${JWT_SECRET:0:10}..."
echo ""

# 安装jq（如果没有的话）
if ! command -v jq &> /dev/null; then
    echo "警告: jq 未安装，某些输出可能不美观"
    JQ_FLAG=""
else
    JQ_FLAG=".data"
fi

# 使用node.js生成token
echo -e "${BLUE}1. 生成管理员 Token...${NC}"
ADMIN_TOKEN=$(node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign({
  sub: 'test-admin-id-12345',
  role: 'ADMIN',
  level: 'DIRECTOR',
  scope: ['active', 'admin', 'read', 'write']
}, '$JWT_SECRET', {
  expiresIn: '7d',
  algorithm: 'HS256',
  issuer: 'zhongdao-mall',
  audience: 'zhongdao-users'
});
console.log(token);
")
echo "✓ 管理员Token生成成功"
echo ""

echo -e "${BLUE}2. 生成普通用户 Token...${NC}"
USER_TOKEN=$(node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign({
  sub: 'test-user-id-12345',
  role: 'USER',
  level: 'NORMAL',
  scope: ['active']
}, '$JWT_SECRET', {
  expiresIn: '7d',
  algorithm: 'HS256',
  issuer: 'zhongdao-mall',
  audience: 'zhongdao-users'
});
console.log(token);
")
echo "✓ 用户Token生成成功"
echo ""

# 测试健康检查
echo -e "${BLUE}3. 测试健康检查端点...${NC}"
curl -s "$BASE_URL/health" | jq .
echo ""

# 测试管理员认证
echo -e "${BLUE}4. 测试管理员认证...${NC}"
AUTH_RESPONSE=$(curl -s -X GET "$BASE_URL/api/v1/auth/me" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json")

if echo "$AUTH_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 管理员认证成功${NC}"
    echo "$AUTH_RESPONSE" | jq .
else
    echo -e "${RED}✗ 管理员认证失败${NC}"
    echo "$AUTH_RESPONSE" | jq .
fi
echo ""

# 测试用户认证
echo -e "${BLUE}5. 测试普通用户认证...${NC}"
USER_AUTH_RESPONSE=$(curl -s -X GET "$BASE_URL/api/v1/auth/me" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json")

if echo "$USER_AUTH_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 用户认证成功${NC}"
    echo "$USER_AUTH_RESPONSE" | jq .
else
    echo -e "${RED}✗ 用户认证失败${NC}"
    echo "$USER_AUTH_RESPONSE" | jq .
fi
echo ""

# 测试管理端点
echo -e "${BLUE}6. 测试管理端点访问...${NC}"
ADMIN_ENDPOINT_RESPONSE=$(curl -s -X GET "$BASE_URL/api/v1/admin/configs" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json")

if echo "$ADMIN_ENDPOINT_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 管理端点访问成功${NC}"
    echo "$ADMIN_ENDPOINT_RESPONSE" | jq .
else
    echo -e "${RED}✗ 管理端点访问失败${NC}"
    echo "$ADMIN_ENDPOINT_RESPONSE" | jq .
fi
echo ""

# 测试无认证访问
echo -e "${BLUE}7. 测试无认证访问（应该失败）...${NC}"
NO_AUTH_RESPONSE=$(curl -s -X GET "$BASE_URL/api/v1/auth/me" \
  -H "Content-Type: application/json")

if echo "$NO_AUTH_RESPONSE" | jq -e '.error.code == "UNAUTHORIZED"' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 正确拒绝了无认证访问${NC}"
    echo "$NO_AUTH_RESPONSE" | jq .
else
    echo -e "${RED}✗ 应该拒绝无认证访问，但没有${NC}"
    echo "$NO_AUTH_RESPONSE" | jq .
fi
echo ""

echo -e "${BLUE}=== 测试完成 ===${NC}"