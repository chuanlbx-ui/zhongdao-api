# API测试渐进式测试报告

生成时间: 2025/12/9 22:31:29

## 总览

- 总测试数: 7
- 通过: 2 (28.6%)
- 失败: 5 (71.4%)

## Phase详情

### Phase 1: 基础设施验证

结果: 1/2 通过

✅ **数据库连接测试**
   命令: `npm run db:validate`

❌ **TypeScript编译检查**
   命令: `npm run type-check`
   错误: Command failed: npm run type-check

### Phase 2: 核心模块测试

结果: 1/2 通过

✅ **支付系统测试**
   命令: `npm test tests/api/payments.test.ts`

❌ **库存管理测试**
   命令: `npm test tests/api/inventory.test.ts`
   错误: Command failed: npm test tests/api/inventory.test.ts
[90mstderr[2m | api/inventory.test.ts[2m > [22m[2m库存管理API测试[2m > [22m[2mPOST /inventory/adjust[2m > [22m[2m应该能够调整库存数量
[22m[39m库存日志记录失败（表可能不存在）: Cannot read properties of undefined (reading 'create')

[90mstderr[2m | api/inventory.test.ts[2m > [22m[2m库存管理API测试[2m > [22m[2mPOST /inventory/adjust[2m > [22m[2m应该能够减少库存
[22m[39m库存日志记录失败（表可能不存在）: Cannot read properties of undefined (reading 'create')

[90mstderr[2m | api/inventory.test.ts[2m > [22m[2m库存管理API测试[2m > [22m[2mPOST /inventory/transfer[2m > [22m[2m应该能够在仓库间调拨库存
[22m[39m调拨日志记录失败（表可能不存在）: Cannot read properties of undefined (reading 'createMany')

[90mstderr[2m | api/inventory.test.ts[2m > [22m[2m库存管理API测试[2m > [22m[2mPOST /inventory/stocktake[2m > [22m[2m应该能够创建库存盘点任务
[22m[39m盘点日志记录失败（表可能不存在）: Cannot read properties of undefined (reading 'create')


[31m⎯⎯⎯⎯⎯⎯⎯[39m[1m[41m Failed Tests 3 [49m[22m[31m⎯⎯⎯⎯⎯⎯⎯[39m

[41m[1m FAIL [22m[49m api/inventory.test.ts[2m > [22m库存管理API测试[2m > [22mGET /inventory[2m > [22m应该支持按商品筛选
[31m[1mError[22m: expected 200 "OK", got 500 "Internal Server Error"[39m
[36m [2m❯[22m api/inventory.test.ts:[2m182:10[22m[39m
    [90m180| [39m        })
    [90m181| [39m        [33m.[39m[35mset[39m([32m'Authorization'[39m[33m,[39m [32m`Bearer [39m[36m${[39mdirectorToken[36m}[39m[32m`[39m)
    [90m182| [39m        [33m.[39m[34mexpect[39m([34m200[39m)[33m;[39m
    [90m   | [39m         [31m^[39m
    [90m183| [39m
    [90m184| [39m      [34mexpect[39m(response[33m.[39mbody[33m.[39msuccess)[33m.[39m[34mtoBe[39m([35mtrue[39m)[33m;[39m
[90m [2m❯[22m Test._assertStatus ../node_modules/supertest/lib/test.js:[2m309:14[22m[39m
[90m [2m❯[22m ../node_modules/supertest/lib/test.js:[2m365:13[22m[39m
[90m [2m❯[22m Test._assertFunction ../node_modules/supertest/lib/test.js:[2m342:13[22m[39m
[90m [2m❯[22m Test.assert ../node_modules/supertest/lib/test.js:[2m195:23[22m[39m
[90m [2m❯[22m localAssert ../node_modules/supertest/lib/test.js:[2m138:14[22m[39m
[90m [2m❯[22m Server.<anonymous> ../node_modules/supertest/lib/test.js:[2m152:11[22m[39m

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯[22m[39m

[41m[1m FAIL [22m[49m api/inventory.test.ts[2m > [22m库存管理API测试[2m > [22mGET /inventory/products/:productId/stock[2m > [22m应该能够查询商品在各仓库的库存
[31m[1mError[22m: expected 200 "OK", got 500 "Internal Server Error"[39m
[36m [2m❯[22m api/inventory.test.ts:[2m522:10[22m[39m
    [90m520| [39m        [33m.[39m[35mget[39m([32m`[39m[36m${[39m[33mAPI_BASE[39m[36m}[39m[32m/inventory/products/[39m[36m${[39mtestProductId[36m}[39m[32m/stock`[39m)
    [90m521| [39m        [33m.[39m[35mset[39m([32m'Authorization'[39m[33m,[39m [32m`Bearer [39m[36m${[39mstarUserToken[36m}[39m[32m`[39m)
    [90m522| [39m        [33m.[39m[34mexpect[39m([34m200[39m)[33m;[39m
    [90m   | [39m         [31m^[39m
    [90m523| [39m
    [90m524| [39m      [34mexpect[39m(response[33m.[39mbody[33m.[39msuccess)[33m.[39m[34mtoBe[39m([35mtrue[39m)[33m;[39m
[90m [2m❯[22m Test._assertStatus ../node_modules/supertest/lib/test.js:[2m309:14[22m[39m
[90m [2m❯[22m ../node_modules/supertest/lib/test.js:[2m365:13[22m[39m
[90m [2m❯[22m Test._assertFunction ../node_modules/supertest/lib/test.js:[2m342:13[22m[39m
[90m [2m❯[22m Test.assert ../node_modules/supertest/lib/test.js:[2m195:23[22m[39m
[90m [2m❯[22m localAssert ../node_modules/supertest/lib/test.js:[2m138:14[22m[39m
[90m [2m❯[22m Server.<anonymous> ../node_modules/supertest/lib/test.js:[2m152:11[22m[39m

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯[22m[39m

[41m[1m FAIL [22m[49m api/inventory.test.ts[2m > [22m库存管理API测试[2m > [22mGET /inventory/products/:productId/stock[2m > [22m不存在的商品ID应返回404
[31m[1mError[22m: expected 404 "Not Found", got 500 "Internal Server Error"[39m
[36m [2m❯[22m api/inventory.test.ts:[2m542:10[22m[39m
    [90m540| [39m        [33m.[39m[35mget[39m([32m`[39m[36m${[39m[33mAPI_BASE[39m[36m}[39m[32m/inventory/products/[39m[36m${[39mfakeId[36m}[39m[32m/stock`[39m)
    [90m541| [39m        [33m.[39m[35mset[39m([32m'Authorization'[39m[33m,[39m [32m`Bearer [39m[36m${[39mstarUserToken[36m}[39m[32m`[39m)
    [90m542| [39m        [33m.[39m[34mexpect[39m([34m404[39m)[33m;[39m
    [90m   | [39m         [31m^[39m
    [90m543| [39m
    [90m544| [39m      [34mexpect[39m(response[33m.[39mbody[33m.[39msuccess)[33m.[39m[34mtoBe[39m([35mfalse[39m)[33m;[39m
[90m [2m❯[22m Test._assertStatus ../node_modules/supertest/lib/test.js:[2m309:14[22m[39m
[90m [2m❯[22m ../node_modules/supertest/lib/test.js:[2m365:13[22m[39m
[90m [2m❯[22m Test._assertFunction ../node_modules/supertest/lib/test.js:[2m342:13[22m[39m
[90m [2m❯[22m Test.assert ../node_modules/supertest/lib/test.js:[2m195:23[22m[39m
[90m [2m❯[22m localAssert ../node_modules/supertest/lib/test.js:[2m138:14[22m[39m
[90m [2m❯[22m Server.<anonymous> ../node_modules/supertest/lib/test.js:[2m152:11[22m[39m

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯[22m[39m



### Phase 3: 用户管理测试

结果: 0/1 通过

❌ **用户API测试**
   命令: `npm test tests/api/users.test.ts -- --reporter=verbose`
   错误: spawnSync C:\Windows\system32\cmd.exe ETIMEDOUT

### Phase 4: 其他模块测试

结果: 0/2 通过

❌ **店铺管理测试**
   命令: `npm test tests/api/shops.test.ts`
   错误: Command failed: npm test tests/api/shops.test.ts

[31m⎯⎯⎯⎯⎯⎯⎯[39m[1m[41m Failed Tests 6 [49m[22m[31m⎯⎯⎯⎯⎯⎯⎯[39m

[41m[1m FAIL [22m[49m api/shops.test.ts[2m > [22m店铺管理API测试[2m > [22mPOST /shops[2m > [22mVIP用户应该能够创建云店
[31m[1mError[22m: expected 201 "Created", got 500 "Internal Server Error"[39m
[36m [2m❯[22m api/shops.test.ts:[2m81:10[22m[39m
    [90m 79| [39m        [33m.[39m[35mset[39m([32m'Authorization'[39m[33m,[39m [32m`Bearer [39m[36m${[39mvipUserToken[36m}[39m[32m`[39m)
    [90m 80| [39m        [33m.[39m[34msend[39m(shopData)
    [90m 81| [39m        [33m.[39m[34mexpect[39m([34m201[39m)[33m;[39m
    [90m   | [39m         [31m^[39m
    [90m 82| [39m
    [90m 83| [39m      [34mexpect[39m(response[33m.[39mbody[33m.[39msuccess)[33m.[39m[34mtoBe[39m([35mtrue[39m)[33m;[39m
[90m [2m❯[22m Test._assertStatus ../node_modules/supertest/lib/test.js:[2m309:14[22m[39m
[90m [2m❯[22m ../node_modules/supertest/lib/test.js:[2m365:13[22m[39m
[90m [2m❯[22m Test._assertFunction ../node_modules/supertest/lib/test.js:[2m342:13[22m[39m
[90m [2m❯[22m Test.assert ../node_modules/supertest/lib/test.js:[2m195:23[22m[39m
[90m [2m❯[22m localAssert ../node_modules/supertest/lib/test.js:[2m138:14[22m[39m
[90m [2m❯[22m Server.<anonymous> ../node_modules/supertest/lib/test.js:[2m152:11[22m[39m

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/6]⎯[22m[39m

[41m[1m FAIL [22m[49m api/shops.test.ts[2m > [22m店铺管理API测试[2m > [22mPOST /shops[2m > [22m普通用户不能创建云店
[31m[1mError[22m: expected 403 "Forbidden", got 500 "Internal Server Error"[39m
[36m [2m❯[22m api/shops.test.ts:[2m101:10[22m[39m
    [90m 99| [39m        [33m.[39m[35mset[39m([32m'Authorization'[39m[33m,[39m [32m`Bearer [39m[36m${[39mnormalUserToken[36m}[39m[32m`[39m)
    [90m100| [39m        [33m.[39m[34msend[39m(shopData)
    [90m101| [39m        [33m.[39m[34mexpect[39m([34m403[39m)[33m;[39m
    [90m   | [39m         [31m^[39m
    [90m102| [39m
    [90m103| [39m      [34mexpect[39m(response[33m.[39mbody[33m.[39msuccess)[33m.[39m[34mtoBe[39m([35mfalse[39m)[33m;[39m
[90m [2m❯[22m Test._assertStatus ../node_modules/supertest/lib/test.js:[2m309:14[22m[39m
[90m [2m❯[22m ../node_modules/supertest/lib/test.js:[2m365:13[22m[39m
[90m [2m❯[22m Test._assertFunction ../node_modules/supertest/lib/test.js:[2m342:13[22m[39m
[90m [2m❯[22m Test.assert ../node_modules/supertest/lib/test.js:[2m195:23[22m[39m
[90m [2m❯[22m localAssert ../node_modules/supertest/lib/test.js:[2m138:14[22m[39m
[90m [2m❯[22m Server.<anonymous> ../node_modules/supertest/lib/test.js:[2m152:11[22m[39m

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/6]⎯[22m[39m

[41m[1m FAIL [22m[49m api/shops.test.ts[2m > [22m店铺管理API测试[2m > [22mPOST /shops[2m > [22m二星店长应该能够创建五通店
[31m[1mError[22m: expected 201 "Created", got 500 "Internal Server Error"[39m
[36m [2m❯[22m api/shops.test.ts:[2m122:10[22m[39m
    [90m120| [39m        [33m.[39m[35mset[39m([32m'Authorization'[39m[33m,[39m [32m`Bearer [39m[36m${[39mstar2User[33m.[39mtokens[33m.[39maccessToken[36m}[39m[32m`[39m)
    [90m121| [39m        [33m.[39m[34msend[39m(shopData)
    [90m122| [39m        [33m.[39m[34mexpect[39m([34m201[39m)[33m;[39m
    [90m   | [39m         [31m^[39m
    [90m123| [39m
    [90m124| [39m      [34mexpect[39m(response[33m.[39mbody[33m.[39msuccess)[33m.[39m[34mtoBe[39m([35mtrue[39m)[33m;[39m
[90m [2m❯[22m Test._assertStatus ../node_modules/supertest/lib/test.js:[2m309:14[22m[39m
[90m [2m❯[22m ../node_modules/supertest/lib/test.js:[2m365:13[22m[39m
[90m [2m❯[22m Test._assertFunction ../node_modules/supertest/lib/test.js:[2m342:13[22m[39m
[90m [2m❯[22m Test.assert ../node_modules/supertest/lib/test.js:[2m195:23[22m[39m
[90m [2m❯[22m localAssert ../node_modules/supertest/lib/test.js:[2m138:14[22m[39m
[90m [2m❯[22m Server.<anonymous> ../node_modules/supertest/lib/test.js:[2m152:11[22m[39m

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/6]⎯[22m[39m

[41m[1m FAIL [22m[49m api/shops.test.ts[2m > [22m店铺管理API测试[2m > [22mPOST /shops/:id/upgrade[2m > [22m应该能够申请店铺升级
[31m[1mTypeError[22m: Cannot read properties of undefined (reading 'id')[39m
[36m [2m❯[22m api/shops.test.ts:[2m297:45[22m[39m
    [90m295| [39m        })[33m;[39m
    [90m296| [39m
    [90m297| [39m      [35mconst[39m shopId [33m=[39m shopResponse[33m.[39mbody[33m.[39mdata[33m.[39mid[33m;[39m
    [90m   | [39m                                            [31m^[39m
    [90m298| [39m
    [90m299| [39m      [35mconst[39m upgradeData [33m=[39m {

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/6]⎯[22m[39m

[41m[1m FAIL [22m[49m api/shops.test.ts[2m > [22m店铺管理API测试[2m > [22mPOST /shops/:id/upgrade[2m > [22m应该验证升级条件
[31m[1mError[22m: expected 400 "Bad Request", got 404 "Not Found"[39m
[36m [2m❯[22m api/shops.test.ts:[2m325:10[22m[39m
    [90m323| [39m        [33m.[39m[35mset[39m([32m'Authorization'[39m[33m,[39m [32m`Bearer [39m[36m${[39mvipUserToken[36m}[39m[32m`[39m)
    [90m324| [39m        [33m.[39m[34msend[39m(upgradeData)
    [90m325| [39m        [33m.[39m[34mexpect[39m([34m400[39m)[33m;[39m
    [90m   | [39m         [31m^[39m
    [90m326| [39m
    [90m327| [39m      [34mexpect[39m(response[33m.[39mbody[33m.[39msuccess)[33m.[39m[34mtoBe[39m([35mfalse[39m)[33m;[39m
[90m [2m❯[22m Test._assertStatus ../node_modules/supertest/lib/test.js:[2m309:14[22m[39m
[90m [2m❯[22m ../node_modules/supertest/lib/test.js:[2m365:13[22m[39m
[90m [2m❯[22m Test._assertFunction ../node_modules/supertest/lib/test.js:[2m342:13[22m[39m
[90m [2m❯[22m Test.assert ../node_modules/supertest/lib/test.js:[2m195:23[22m[39m
[90m [2m❯[22m localAssert ../node_modules/supertest/lib/test.js:[2m138:14[22m[39m
[90m [2m❯[22m Server.<anonymous> ../node_modules/supertest/lib/test.js:[2m152:11[22m[39m

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/6]⎯[22m[39m

[41m[1m FAIL [22m[49m api/shops.test.ts[2m > [22m店铺管理API测试[2m > [22mPOST /shops/wutong/claim-gift[2m > [22m五通店用户应该能够申请赠品
[31m[1mError[22m: expected 200 "OK", got 403 "Forbidden"[39m
[36m [2m❯[22m api/shops.test.ts:[2m418:10[22m[39m
    [90m416| [39m        [33m.[39m[35mset[39m([32m'Authorization'[39m[33m,[39m [32m`Bearer [39m[36m${[39mstar2User[33m.[39mtokens[33m.[39maccessToken[36m}[39m[32m`[39m)
    [90m417| [39m        [33m.[39m[34msend[39m(orderData)
    [90m418| [39m        [33m.[39m[34mexpect[39m([34m200[39m)[33m;[39m
    [90m   | [39m         [31m^[39m
    [90m419| [39m
    [90m420| [39m      [34mexpect[39m(response[33m.[39mbody[33m.[39msuccess)[33m.[39m[34mtoBe[39m([35mtrue[39m)[33m;[39m
[90m [2m❯[22m Test._assertStatus ../node_modules/supertest/lib/test.js:[2m309:14[22m[39m
[90m [2m❯[22m ../node_modules/supertest/lib/test.js:[2m365:13[22m[39m
[90m [2m❯[22m Test._assertFunction ../node_modules/supertest/lib/test.js:[2m342:13[22m[39m
[90m [2m❯[22m Test.assert ../node_modules/supertest/lib/test.js:[2m195:23[22m[39m
[90m [2m❯[22m localAssert ../node_modules/supertest/lib/test.js:[2m138:14[22m[39m
[90m [2m❯[22m Server.<anonymous> ../node_modules/supertest/lib/test.js:[2m152:11[22m[39m

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/6]⎯[22m[39m



❌ **商品管理测试**
   命令: `npm test tests/api/products.test.ts`
   错误: Command failed: npm test tests/api/products.test.ts

[31m⎯⎯⎯⎯⎯⎯⎯[39m[1m[41m Failed Tests 9 [49m[22m[31m⎯⎯⎯⎯⎯⎯⎯[39m

[41m[1m FAIL [22m[49m api/products.test.ts[2m > [22m商品管理API测试 - 简化版[2m > [22m商品分类API[2m > [22m应该能够获取商品分类树
[31m[1mError[22m: expected 200 "OK", got 401 "Unauthorized"[39m
[36m [2m❯[22m api/products.test.ts:[2m35:10[22m[39m
    [90m 33| [39m        [33m.[39m[35mget[39m([32m`[39m[36m${[39m[33mAPI_BASE[39m[36m}[39m[32m/products/categories/tree`[39m)
    [90m 34| [39m        [33m.[39m[35mset[39m([32m'Authorization'[39m[33m,[39m [32m`Bearer [39m[36m${[39mnormalUserToken[36m}[39m[32m`[39m)
    [90m 35| [39m        [33m.[39m[34mexpect[39m([34m200[39m)[33m;[39m
    [90m   | [39m         [31m^[39m
    [90m 36| [39m
    [90m 37| [39m      [34mexpect[39m(response[33m.[39mbody[33m.[39msuccess)[33m.[39m[34mtoBe[39m([35mtrue[39m)[33m;[39m
[90m [2m❯[22m Test._assertStatus ../node_modules/supertest/lib/test.js:[2m309:14[22m[39m
[90m [2m❯[22m ../node_modules/supertest/lib/test.js:[2m365:13[22m[39m
[90m [2m❯[22m Test._assertFunction ../node_modules/supertest/lib/test.js:[2m342:13[22m[39m
[90m [2m❯[22m Test.assert ../node_modules/supertest/lib/test.js:[2m195:23[22m[39m
[90m [2m❯[22m localAssert ../node_modules/supertest/lib/test.js:[2m138:14[22m[39m
[90m [2m❯[22m Server.<anonymous> ../node_modules/supertest/lib/test.js:[2m152:11[22m[39m

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/9]⎯[22m[39m

[41m[1m FAIL [22m[49m api/products.test.ts[2m > [22m商品管理API测试 - 简化版[2m > [22m商品分类API[2m > [22m应该能够获取商品分类列表
[31m[1mError[22m: expected 200 "OK", got 401 "Unauthorized"[39m
[36m [2m❯[22m api/products.test.ts:[2m47:10[22m[39m
    [90m 45| [39m        [33m.[39m[35mset[39m([32m'Authorization'[39m[33m,[39m [32m`Bearer [39m[36m${[39mnormalUserToken[36m}[39m[32m`[39m)
    [90m 46| [39m        [33m.[39m[34mquery[39m({ page[33m:[39m [34m1[39m[33m,[39m perPage[33m:[39m [34m10[39m })
    [90m 47| [39m        [33m.[39m[34mexpect[39m([34m200[39m)[33m;[39m
    [90m   | [39m         [31m^[39m
    [90m 48| [39m
    [90m 49| [39m      [34mexpect[39m(response[33m.[39mbody[33m.[39msuccess)[33m.[39m[34mtoBe[39m([35mtrue[39m)[33m;[39m
[90m [2m❯[22m Test._assertStatus ../node_modules/supertest/lib/test.js:[2m309:14[22m[39m
[90m [2m❯[22m ../node_modules/supertest/lib/test.js:[2m365:13[22m[39m
[90m [2m❯[22m Test._assertFunction ../node_modules/supertest/lib/test.js:[2m342:13[22m[39m
[90m [2m❯[22m Test.assert ../node_modules/supertest/lib/test.js:[2m195:23[22m[39m
[90m [2m❯[22m localAssert ../node_modules/supertest/lib/test.js:[2m138:14[22m[39m
[90m [2m❯[22m Server.<anonymous> ../node_modules/supertest/lib/test.js:[2m152:11[22m[39m

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/9]⎯[22m[39m

[41m[1m FAIL [22m[49m api/products.test.ts[2m > [22m商品管理API测试 - 简化版[2m > [22m商品分类API[2m > [22m应该能够按级别筛选商品分类
[31m[1mError[22m: expected 200 "OK", got 401 "Unauthorized"[39m
[36m [2m❯[22m api/products.test.ts:[2m56:10[22m[39m
    [90m 54| [39m    [34mit[39m([32m'应该能够按级别筛选商品分类'[39m[33m,[39m [35masync[39m () [33m=>[39m {
    [90m 55| [39m      const response = await makeAuthenticatedRequest('GET', `${API_BA…
    [90m 56| [39m        [33m.[39m[34mexpect[39m([34m200[39m)[33m;[39m
    [90m   | [39m         [31m^[39m
    [90m 57| [39m
    [90m 58| [39m      [34mexpect[39m(response[33m.[39mbody[33m.[39msuccess)[33m.[39m[34mtoBe[39m([35mtrue[39m)[33m;[39m
[90m [2m❯[22m Test._assertStatus ../node_modules/supertest/lib/test.js:[2m309:14[22m[39m
[90m [2m❯[22m ../node_modules/supertest/lib/test.js:[2m365:13[22m[39m
[90m [2m❯[22m Test._assertFunction ../node_modules/supertest/lib/test.js:[2m342:13[22m[39m
[90m [2m❯[22m Test.assert ../node_modules/supertest/lib/test.js:[2m195:23[22m[39m
[90m [2m❯[22m localAssert ../node_modules/supertest/lib/test.js:[2m138:14[22m[39m
[90m [2m❯[22m Server.<anonymous> ../node_modules/supertest/lib/test.js:[2m152:11[22m[39m

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/9]⎯[22m[39m

[41m[1m FAIL [22m[49m api/products.test.ts[2m > [22m商品管理API测试 - 简化版[2m > [22m商品标签API[2m > [22m应该能够获取商品标签列表
[31m[1mError[22m: expected 200 "OK", got 401 "Unauthorized"[39m
[36m [2m❯[22m api/products.test.ts:[2m66:10[22m[39m
    [90m 64| [39m    [34mit[39m([32m'应该能够获取商品标签列表'[39m[33m,[39m [35masync[39m () [33m=>[39m {
    [90m 65| [39m      const response = await makeAuthenticatedRequest('GET', `${API_BA…
    [90m 66| [39m        [33m.[39m[34mexpect[39m([34m200[39m)[33m;[39m
    [90m   | [39m         [31m^[39m
    [90m 67| [39m
    [90m 68| [39m      [34mexpect[39m(response[33m.[39mbody[33m.[39msuccess)[33m.[39m[34mtoBe[39m([35mtrue[39m)[33m;[39m
[90m [2m❯[22m Test._assertStatus ../node_modules/supertest/lib/test.js:[2m309:14[22m[39m
[90m [2m❯[22m ../node_modules/supertest/lib/test.js:[2m365:13[22m[39m
[90m [2m❯[22m Test._assertFunction ../node_modules/supertest/lib/test.js:[2m342:13[22m[39m
[90m [2m❯[22m Test.assert ../node_modules/supertest/lib/test.js:[2m195:23[22m[39m
[90m [2m❯[22m localAssert ../node_modules/supertest/lib/test.js:[2m138:14[22m[39m
[90m [2m❯[22m Server.<anonymous> ../node_modules/supertest/lib/test.js:[2m152:11[22m[39m

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/9]⎯[22m[39m

[41m[1m FAIL [22m[49m api/products.test.ts[2m > [22m商品管理API测试 - 简化版[2m > [22m商品标签API[2m > [22m应该能够获取所有商品标签
[31m[1mError[22m: expected 200 "OK", got 401 "Unauthorized"[39m
[36m [2m❯[22m api/products.test.ts:[2m75:10[22m[39m
    [90m 73| [39m    [34mit[39m([32m'应该能够获取所有商品标签'[39m[33m,[39m [35masync[39m () [33m=>[39m {
    [90m 74| [39m      const response = await makeAuthenticatedRequest('GET', `${API_BA…
    [90m 75| [39m        [33m.[39m[34mexpect[39m([34m200[39m)[33m;[39m
    [90m   | [39m         [31m^[39m
    [90m 76| [39m
    [90m 77| [39m      [34mexpect[39m(response[33m.[39mbody[33m.[39msuccess)[33m.[39m[34mtoBe[39m([35mtrue[39m)[33m;[39m
[90m [2m❯[22m Test._assertStatus ../node_modules/supertest/lib/test.js:[2m309:14[22m[39m
[90m [2m❯[22m ../node_modules/supertest/lib/test.js:[2m365:13[22m[39m
[90m [2m❯[22m Test._assertFunction ../node_modules/supertest/lib/test.js:[2m342:13[22m[39m
[90m [2m❯[22m Test.assert ../node_modules/supertest/lib/test.js:[2m195:23[22m[39m
[90m [2m❯[22m localAssert ../node_modules/supertest/lib/test.js:[2m138:14[22m[39m
[90m [2m❯[22m Server.<anonymous> ../node_modules/supertest/lib/test.js:[2m152:11[22m[39m

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/9]⎯[22m[39m

[41m[1m FAIL [22m[49m api/products.test.ts[2m > [22m商品管理API测试 - 简化版[2m > [22m商品标签API[2m > [22m应该能够创建新的商品标签
[31m[1mError[22m: expected 200 "OK", got 401 "Unauthorized"[39m
[36m [2m❯[22m api/products.test.ts:[2m90:10[22m[39m
    [90m 88| [39m      const response = await makeAdminRequest('POST', `${API_BASE}/pro…
    [90m 89| [39m        [33m.[39m[34msend[39m(tagData)
    [90m 90| [39m        [33m.[39m[34mexpect[39m([34m200[39m)[33m;[39m
    [90m   | [39m         [31m^[39m
    [90m 91| [39m
    [90m 92| [39m      [34mexpect[39m(response[33m.[39mbody[33m.[39msuccess)[33m.[39m[34mtoBe[39m([35mtrue[39m)[33m;[39m
[90m [2m❯[22m Test._assertStatus ../node_modules/supertest/lib/test.js:[2m309:14[22m[39m
[90m [2m❯[22m ../node_modules/supertest/lib/test.js:[2m365:13[22m[39m
[90m [2m❯[22m Test._assertFunction ../node_modules/supertest/lib/test.js:[2m342:13[22m[39m
[90m [2m❯[22m Test.assert ../node_modules/supertest/lib/test.js:[2m195:23[22m[39m
[90m [2m❯[22m localAssert ../node_modules/supertest/lib/test.js:[2m138:14[22m[39m
[90m [2m❯[22m Server.<anonymous> ../node_modules/supertest/lib/test.js:[2m152:11[22m[39m

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/9]⎯[22m[39m

[41m[1m FAIL [22m[49m api/products.test.ts[2m > [22m商品管理API测试 - 简化版[2m > [22m商品列表API[2m > [22m应该能够获取商品列表
[31m[1mError[22m: expected 200 "OK", got 401 "Unauthorized"[39m
[36m [2m❯[22m api/products.test.ts:[2m100:10[22m[39m
    [90m 98| [39m    [34mit[39m([32m'应该能够获取商品列表'[39m[33m,[39m [35masync[39m () [33m=>[39m {
    [90m 99| [39m      const response = await makeAuthenticatedRequest('GET', `${API_BA…
    [90m100| [39m        [33m.[39m[34mexpect[39m([34m200[39m)[33m;[39m
    [90m   | [39m         [31m^[39m
    [90m101| [39m
    [90m102| [39m      [34mexpect[39m(response[33m.[39mbody[33m.[39msuccess)[33m.[39m[34mtoBe[39m([35mtrue[39m)[33m;[39m
[90m [2m❯[22m Test._assertStatus ../node_modules/supertest/lib/test.js:[2m309:14[22m[39m
[90m [2m❯[22m ../node_modules/supertest/lib/test.js:[2m365:13[22m[39m
[90m [2m❯[22m Test._assertFunction ../node_modules/supertest/lib/test.js:[2m342:13[22m[39m
[90m [2m❯[22m Test.assert ../node_modules/supertest/lib/test.js:[2m195:23[22m[39m
[90m [2m❯[22m localAssert ../node_modules/supertest/lib/test.js:[2m138:14[22m[39m
[90m [2m❯[22m Server.<anonymous> ../node_modules/supertest/lib/test.js:[2m152:11[22m[39m

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[7/9]⎯[22m[39m

[41m[1m FAIL [22m[49m api/products.test.ts[2m > [22m商品管理API测试 - 简化版[2m > [22m商品列表API[2m > [22m应该能够按状态筛选商品
[31m[1mError[22m: expected 200 "OK", got 401 "Unauthorized"[39m
[36m [2m❯[22m api/products.test.ts:[2m109:10[22m[39m
    [90m107| [39m    [34mit[39m([32m'应该能够按状态筛选商品'[39m[33m,[39m [35masync[39m () [33m=>[39m {
    [90m108| [39m      const response = await makeAuthenticatedRequest('GET', `${API_BA…
    [90m109| [39m        [33m.[39m[34mexpect[39m([34m200[39m)[33m;[39m
    [90m   | [39m         [31m^[39m
    [90m110| [39m
    [90m111| [39m      [34mexpect[39m(response[33m.[39mbody[33m.[39msuccess)[33m.[39m[34mtoBe[39m([35mtrue[39m)[33m;[39m
[90m [2m❯[22m Test._assertStatus ../node_modules/supertest/lib/test.js:[2m309:14[22m[39m
[90m [2m❯[22m ../node_modules/supertest/lib/test.js:[2m365:13[22m[39m
[90m [2m❯[22m Test._assertFunction ../node_modules/supertest/lib/test.js:[2m342:13[22m[39m
[90m [2m❯[22m Test.assert ../node_modules/supertest/lib/test.js:[2m195:23[22m[39m
[90m [2m❯[22m localAssert ../node_modules/supertest/lib/test.js:[2m138:14[22m[39m
[90m [2m❯[22m Server.<anonymous> ../node_modules/supertest/lib/test.js:[2m152:11[22m[39m

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[8/9]⎯[22m[39m

[41m[1m FAIL [22m[49m api/products.test.ts[2m > [22m商品管理API测试 - 简化版[2m > [22m商品规格API[2m > [22m应该能够获取商品规格列表
[31m[1mError[22m: expected 200 "OK", got 401 "Unauthorized"[39m
[36m [2m❯[22m api/products.test.ts:[2m118:10[22m[39m
    [90m116| [39m    [34mit[39m([32m'应该能够获取商品规格列表'[39m[33m,[39m [35masync[39m () [33m=>[39m {
    [90m117| [39m      const response = await makeAuthenticatedRequest('GET', `${API_BA…
    [90m118| [39m        [33m.[39m[34mexpect[39m([34m200[39m)[33m;[39m
    [90m   | [39m         [31m^[39m
    [90m119| [39m
    [90m120| [39m      [34mexpect[39m(response[33m.[39mbody[33m.[39msuccess)[33m.[39m[34mtoBe[39m([35mtrue[39m)[33m;[39m
[90m [2m❯[22m Test._assertStatus ../node_modules/supertest/lib/test.js:[2m309:14[22m[39m
[90m [2m❯[22m ../node_modules/supertest/lib/test.js:[2m365:13[22m[39m
[90m [2m❯[22m Test._assertFunction ../node_modules/supertest/lib/test.js:[2m342:13[22m[39m
[90m [2m❯[22m Test.assert ../node_modules/supertest/lib/test.js:[2m195:23[22m[39m
[90m [2m❯[22m localAssert ../node_modules/supertest/lib/test.js:[2m138:14[22m[39m
[90m [2m❯[22m Server.<anonymous> ../node_modules/supertest/lib/test.js:[2m152:11[22m[39m

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[9/9]⎯[22m[39m



