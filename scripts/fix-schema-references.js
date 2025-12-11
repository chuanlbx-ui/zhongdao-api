/**
 * 修复 Prisma schema 中的关系字段引用
 */

const fs = require('fs');
const path = require('path');

// 读取 schema 文件
const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

// 修复关系字段引用
const replacements = [
  // 字段名映射
  { from: 'user_id', to: 'userId' },
  { from: 'shop_id', to: 'shopId' },
  { from: 'order_id', to: 'orderId' },
  { from: 'product_id', to: 'productId' },
  { from: 'category_id', to: 'categoryId' },
  { from: 'parent_id', to: 'parentId' },
  { from: 'referee_id', to: 'refereeId' },
  { from: 'team_id', to: 'teamId' },
  { from: 'member_id', to: 'memberId' },
  { from: 'spec_id', to: 'specId' },
  { from: 'item_id', to: 'itemId' },
  { from: 'stock_id', to: 'stockId' },
  { from: 'tag_id', to: 'tagId' },
  { from: 'alert_id', to: 'alertId' },
  { from: 'log_id', to: 'logId' },
  { from: 'config_id', to: 'configId' },
  { from: 'payment_id', to: 'paymentId' },
  { from: 'refund_id', to: 'refundId' },
  { from: 'gift_id', to: 'giftId' },
  { from: 'transaction_id', to: 'transactionId' },
  { from: 'inventory_id', to: 'inventoryId' },
  { from: 'from_user_id', to: 'fromUserId' },
  { from: 'to_user_id', to: 'toUserId' },
  { from: 'last_modified_by', to: 'lastModifiedBy' },
  { from: 'resolved_by', to: 'resolvedBy' },
  { from: 'created_by', to: 'createdBy' },
  { from: 'updated_by', to: 'updatedBy' },
  { from: 'deleted_by', to: 'deletedBy' },
  { from: 'operator_id', to: 'operatorId' },
  { from: 'processed_by', to: 'processedBy' },
  { from: 'related_order_id', to: 'relatedOrderId' },
  { from: 'original_payment_id', to: 'originalPaymentId' },
  { from: 'parent_shop_id', to: 'parentShopId' },
  { from: 'owner_id', to: 'ownerId' },
  { from: 'upline_id', to: 'uplineId' },
  { from: 'calculated_at', to: 'calculatedAt' },
  { from: 'status_changed_at', to: 'statusChangedAt' },
  { from: 'joined_at', to: 'joinedAt' },
  { from: 'activated_at', to: 'activatedAt' },
  { from: 'settlement_date', to: 'settlementDate' },
  { from: 'shipped_at', to: 'shippedAt' },
  { from: 'delivered_at', to: 'deliveredAt' },
  { from: 'cancelled_at', to: 'cancelledAt' },
  { from: 'verified_at', to: 'verifiedAt' },
  { from: 'refunded_at', to: 'refundedAt' },
  { from: 'processed_at', to: 'processedAt' },
  { from: 'expires_at', to: 'expiresAt' },
  { from: 'last_restocked_at', to: 'lastRestockedAt' },
  { from: 'last_login_at', to: 'lastLoginAt' },
  { from: 'last_login_ip', to: 'lastLoginIp' },
  { from: 'locked_until', to: 'lockedUntil' }
];

// 修复 fields: [xxx] 中的引用
replacements.forEach(({ from, to }) => {
  const regex1 = new RegExp(`fields:\\s*\\[${from}\\]`, 'g');
  const regex2 = new RegExp(`fields:\\s*\\[(\\w+),\\s*${from}\\]`, 'g');
  const regex3 = new RegExp(`fields:\\s*\\[${from},\\s*(\\w+)\\]`, 'g');

  schema = schema.replace(regex1, `fields: [${to}]`);
  schema = schema.replace(regex2, `fields: [$1, ${to}]`);
  schema = schema.replace(regex3, `fields: [${to}, $1]`);
});

// 修复 references: [xxx] 中的引用
replacements.forEach(({ from, to }) => {
  const regex1 = new RegExp(`references:\\s*\\[${from}\\]`, 'g');
  const regex2 = new RegExp(`references:\\s*\\[(\\w+),\\s*${from}\\]`, 'g');
  const regex3 = new RegExp(`references:\\s*\\[${from},\\s*(\\w+)\\]`, 'g');

  schema = schema.replace(regex1, `references: [${to}]`);
  schema = schema.replace(regex2, `references: [$1, ${to}]`);
  schema = schema.replace(regex3, `references: [${to}, $1]`);
});

// 修复 @@index 中的 map 名称
schema = schema.replace(/map:\s*"([^"]+)"/g, (match, mapName) => {
  if (mapName.includes('_')) {
    // 将 map 名称中的下划线转换为驼峰
    const camelCaseMap = mapName.replace(/_([a-z])/g, (m, l) => l.toUpperCase());
    return `map: "${camelCaseMap}"`;
  }
  return match;
});

// 写回文件
fs.writeFileSync(schemaPath, schema, 'utf8');

console.log('\n✅ Schema 关系字段引用修复完成！');
console.log('所有 fields 和 references 中的下划线命名已转换为驼峰命名。');