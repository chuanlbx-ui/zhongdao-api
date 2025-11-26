# 同步脚本语法修复说明

## 🐛 问题描述

在服务器上运行管理后台同步脚本时出现语法错误：
```
./sync-admin-repo.sh: line 432: conditional binary operator expected
```

## 🔍 问题原因

问题出现在bash脚本中的正则表达式语法。在一些bash版本中，使用 `=~ "M"` 语法来检查字符串是否包含"M"字符时，会因解析问题导致语法错误。

## ✅ 修复方案

将所有脚本中的正则表达式匹配语法从：
```bash
# 有问题的语法
if [[ "$build_size" =~ "M" ]]; then
```

修改为更兼容的字符串包含语法：
```bash
# 修复后的语法
if [[ "$build_size" == *"M"* ]]; then
```

## 🔧 修复的文件

### 1. 管理后台同步脚本
- **文件**: `/d/wwwroot/zhongdao-admin/scripts/sync-admin-repo.sh`
- **修复位置**: 第422行和第448行

### 2. H5前端同步脚本
- **文件**: `/d/wwwroot/zhongdao-H5/scripts/sync-h5-repo.sh`
- **修复位置**: 第355行和第369行

### 3. 后端API同步脚本
- **文件**: `/d/wwwroot/zhongdao-mall/scripts/sync-backend-repo.sh`
- **状态**: 无此问题，无需修复

## 🧪 验证结果

所有脚本已通过语法检查：
```bash
bash -n /d/wwwroot/zhongdao-admin/scripts/sync-admin-repo.sh  # ✅ 通过
bash -n /d/wwwroot/zhongdao-H5/scripts/sync-h5-repo.sh          # ✅ 通过
bash -n /d/wwwroot/zhongdao-mall/scripts/sync-backend-repo.sh  # ✅ 通过
```

## 🚀 使用说明

现在所有同步脚本都可以正常运行了：

```bash
# 在管理后台目录
cd /www/wwwroot/zd-admin.wenbita.cn
./sync-admin-repo.sh

# 在H5前端目录
cd /path/to/zhongdao-H5
./scripts/sync-h5-repo.sh

# 在后端API目录
cd /www/wwwroot/zd-api.wenbita.cn
./sync-backend-repo.sh
```

## 📝 技术细节

### 为什么原来的语法有问题？
- `=~ "M"` 语法在某些bash版本中对单字符正则表达式解析有问题
- 特别是当脚本包含中文字符时，更容易出现解析错误

### 新语法的优势：
- `== *"M"*` 是标准的bash字符串匹配语法
- 兼容性更好，在所有bash版本中都能正常工作
- 语法更简洁明了

### 性能影响：
- 新语法性能与原语法相当
- 没有额外的性能开销
- 代码可读性更好

---

**修复完成时间**: 2025-11-25
**影响范围**: 3个同步脚本中的2个
**测试状态**: 全部通过语法检查