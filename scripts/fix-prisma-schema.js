/**
 * 修复 Prisma schema 字段命名脚本
 * 将 snake_case 转换为 camelCase
 */

const fs = require('fs');
const path = require('path');

// 读取 schema 文件
const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

// 需要转换的字段映射（snake_case -> camelCase）
const fieldMappings = {
  // 通用字段
  'created_at': 'createdAt',
  'updated_at': 'updatedAt',
  'deleted_at': 'deletedAt',
  'created_by': 'createdBy',
  'updated_by': 'updatedBy',
  'deleted_by': 'deletedBy',

  // users 表
  'avatar_url': 'avatarUrl',
  'real_name': 'realName',
  'phone_number': 'phoneNumber',
  'parent_id': 'parentId',
  'referee_id': 'refereeId',
  'team_path': 'teamPath',
  'team_level': 'teamLevel',
  'total_sales': 'totalSales',
  'total_bottles': 'totalBottles',
  'direct_sales': 'directSales',
  'team_sales': 'teamSales',
  'direct_count': 'directCount',
  'team_count': 'teamCount',
  'cloud_shop_level': 'cloudShopLevel',
  'has_wutong_shop': 'hasWutongShop',
  'points_balance': 'pointsBalance',
  'points_frozen': 'pointsFrozen',
  'referral_code': 'referralCode',
  'user_number': 'userNumber',
  'last_login_at': 'lastLoginAt',
  'last_login_ip': 'lastLoginIp',
  'login_attempts': 'loginAttempts',
  'locked_until': 'lockedUntil',

  // shops 表
  'shop_name': 'shopName',
  'shop_type': 'shopType',
  'owner_id': 'ownerId',
  'parent_shop_id': 'parentShopId',
  'total_products': 'totalProducts',
  'active_products': 'activeProducts',
  'shop_level': 'shopLevel',
  'total_orders': 'totalOrders',
  'total_revenue': 'totalRevenue',

  // products 表
  'product_name': 'productName',
  'category_id': 'categoryId',
  'base_price': 'basePrice',
  'stock_quantity': 'stockQuantity',
  'min_purchase': 'minPurchase',
  'max_purchase': 'maxPurchase',
  'is_featured': 'isFeatured',
  'sort_order': 'sortOrder',
  'view_count': 'viewCount',
  'sales_count': 'salesCount',

  // orders 表
  'order_no': 'orderNo',
  'user_id': 'userId',
  'shop_id': 'shopId',
  'total_amount': 'totalAmount',
  'discount_amount': 'discountAmount',
  'paid_amount': 'paidAmount',
  'payment_method': 'paymentMethod',
  'payment_status': 'paymentStatus',
  'order_status': 'orderStatus',
  'shipping_address': 'shippingAddress',
  'tracking_number': 'trackingNumber',
  'shipped_at': 'shippedAt',
  'delivered_at': 'deliveredAt',
  'cancelled_at': 'cancelledAt',

  // points_transactions 表
  'transaction_no': 'transactionNo',
  'from_user_id': 'fromUserId',
  'to_user_id': 'toUserId',
  'transaction_type': 'transactionType',
  'points_amount': 'pointsAmount',
  'balance_before': 'balanceBefore',
  'balance_after': 'balanceAfter',
  'reference_id': 'referenceId',
  'reference_type': 'referenceType',
  'processed_at': 'processedAt',
  'expires_at': 'expiresAt',

  // inventory_items 表
  'product_id': 'productId',
  'spec_id': 'specId',
  'warehouse_type': 'warehouseType',
  'current_stock': 'currentStock',
  'available_stock': 'availableStock',
  'reserved_stock': 'reservedStock',
  'min_threshold': 'minThreshold',
  'max_capacity': 'maxCapacity',
  'last_restocked_at': 'lastRestockedAt',

  // inventory_stocks 表
  'item_id': 'itemId',
  'quantity_change': 'quantityChange',
  'stock_before': 'stockBefore',
  'stock_after': 'stockAfter',
  'operation_type': 'operationType',
  'operation_reason': 'operationReason',
  'operator_id': 'operatorId',
  'related_order_id': 'relatedOrderId',

  // system_configs 表
  'last_modified_by': 'lastModifiedBy',
  'is_editable': 'isEditable',
  'is_system': 'isSystem',

  // gift_records 表
  'order_id': 'orderId',
  'gifted_quantity': 'giftedQuantity',
  'gift_value': 'giftValue',
  'status_changed_at': 'statusChangedAt',
  'processed_by': 'processedBy',

  // team_members 表
  'team_id': 'teamId',
  'member_role': 'memberRole',
  'upline_id': 'uplineId',
  'referee_id': 'refereeId',
  'performance_score': 'performanceScore',
  'joined_at': 'joinedAt',
  'activated_at': 'activatedAt',

  // commission_calculations 表
  'calculation_period': 'calculationPeriod',
  'personal_commission': 'personalCommission',
  'team_commission': 'teamCommission',
  'referral_commission': 'referralCommission',
  'bonus_commission': 'bonusCommission',
  'calculation_status': 'calculationStatus',
  'settlement_date': 'settlementDate',

  // payment_records 表
  'payment_no': 'paymentNo',
  'gateway_type': 'gatewayType',
  'gateway_transaction_id': 'gatewayTransactionId',
  'gateway_response': 'gatewayResponse',
  'verified_at': 'verifiedAt',
  'failed_reason': 'failedReason',
  'refund_id': 'refundId',

  // payment_refunds 表
  'refund_no': 'refundNo',
  'original_payment_id': 'originalPaymentId',
  'refund_amount': 'refundAmount',
  'refund_reason': 'refundReason',
  'refund_status': 'refundStatus',
  'processed_by': 'processedBy',
  'refunded_at': 'refundedAt',

  // 其他通用字段
  'user_id': 'userId',
  'shop_id': 'shopId',
  'product_id': 'productId',
  'order_id': 'orderId',
  'category_id': 'categoryId',
  'parent_id': 'parentId',
  'team_id': 'teamId',
  'member_id': 'memberId',
  'config_id': 'configId',
  'log_id': 'logId',
  'alert_id': 'alertId',
  'record_id': 'recordId',
  'spec_id': 'specId',
  'tag_id': 'tagId',
  'link_id': 'linkId',
  'item_id': 'itemId',
  'stock_id': 'stockId',
  'batch_id': 'batchId',
  'task_id': 'taskId',
  'file_id': 'fileId',
  'image_id': 'imageId',
  'comment_id': 'commentId',
  'review_id': 'reviewId',
  'rating_id': 'ratingId',
  'permission_id': 'permissionId',
  'role_id': 'roleId',
  'menu_id': 'menuId',
  'setting_id': 'settingId',
  'template_id': 'templateId',
  'message_id': 'messageId',
  'notification_id': 'notificationId',
  'email_id': 'emailId',
  'sms_id': 'smsId',
  'log_type': 'logType',
  'alert_type': 'alertType',
  'stock_type': 'stockType',
  'warehouse_type': 'warehouseType',
  'order_type': 'orderType',
  'payment_type': 'paymentType',
  'refund_type': 'refundType',
  'transaction_type': 'transactionType',
  'operation_type': 'operationType',
  'user_type': 'userType',
  'shop_type': 'shopType',
  'product_type': 'productType',
  'category_type': 'categoryType',
  'tag_type': 'tagType',
  'spec_type': 'specType',
  'gift_type': 'giftType',
  'team_type': 'teamType',
  'role_type': 'roleType',
  'status_type': 'statusType',
  'config_type': 'configType',
  'error_type': 'errorType',
  'event_type': 'eventType',
  'action_type': 'actionType'
};

// 转换函数
function toCamelCase(str) {
  return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
}

// 修复 schema 中的字段名
let modifiedCount = 0;
schema = schema.replace(/(\s+)\w+_\w+/g, (match) => {
  const fieldName = match.trim();
  if (fieldMappings[fieldName]) {
    modifiedCount++;
    return match.replace(fieldName, fieldMappings[fieldName]);
  }
  // 对于未在映射中的字段，自动转换
  if (fieldName.includes('_')) {
    modifiedCount++;
    return match.replace(fieldName, toCamelCase(fieldName));
  }
  return match;
});

// 修复关系字段中的引用
schema = schema.replace(/references:\s*\[(\w+)_(\w+)\]/g, (match, p1, p2) => {
  const fieldName = `${p1}_${p2}`;
  if (fieldMappings[fieldName]) {
    return `references: [${fieldMappings[fieldName]}]`;
  }
  return match;
});

// 写回文件
fs.writeFileSync(schemaPath, schema, 'utf8');

console.log(`\n✅ Schema 字段命名修复完成！`);
console.log(`📊 共修改了 ${modifiedCount} 个字段`);
console.log(`📁 文件路径: ${schemaPath}`);
console.log('\n请检查修改后的 schema 文件，确认所有字段名已正确转换为 camelCase。');