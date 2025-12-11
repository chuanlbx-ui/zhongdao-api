@echo off
echo 开始测试积分API响应性...

echo.
echo 1. 测试健康检查...
curl -s -w "状态码: %%{http_code}\n耗时: %%{time_total}s\n" http://localhost:3000/health -o nul
echo.

echo 2. 测试积分余额（无认证）...
curl -s -w "状态码: %%{http_code}\n耗时: %%{time_total}s\n" http://localhost:3000/api/v1/points/balance -o nul
echo.

echo 3. 测试积分余额（错误token）...
curl -s -w "状态码: %%{http_code}\n耗时: %%{time_total}s\n" -H "Authorization: Bearer wrong_token" http://localhost:3000/api/v1/points/balance -o nul
echo.

echo 4. 测试积分交易记录（可能超时）...
curl -s -m 10 -w "状态码: %%{http_code}\n耗时: %%{time_total}s\n" -H "Authorization: Bearer test_token" http://localhost:3000/api/v1/points/transactions -o nul
if errorlevel 1 echo 连接超时或失败！
echo.

echo 5. 测试积分统计（可能超时）...
curl -s -m 10 -w "状态码: %%{http_code}\n耗时: %%{time_total}s\n" -H "Authorization: Bearer test_token" http://localhost:3000/api/v1/points/statistics -o nul
if errorlevel 1 echo 连接超时或失败！
echo.

echo 测试完成！
pause