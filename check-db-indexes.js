import { prisma } from './src/shared/database/client.js';

async function checkDatabaseIndexes() {
  console.log('🔍 检查数据库索引状态...\n');

  try {
    // 检查productCategories表的索引
    console.log('📋 productCategories表索引:');
    const categoryIndexes = await prisma.$queryRaw`
      SHOW INDEX FROM productCategories
    `;

    console.log('索引数量:', categoryIndexes.length);
    categoryIndexes.forEach((idx, i) => {
      console.log(`  ${i + 1}. ${idx.Key_name} (${idx.Index_type}): ${idx.Column_name}`);
    });

    // 检查products表的索引
    console.log('\n📦 products表索引:');
    const productIndexes = await prisma.$queryRaw`
      SHOW INDEX FROM products
    `;

    console.log('索引数量:', productIndexes.length);
    productIndexes.forEach((idx, i) => {
      console.log(`  ${i + 1}. ${idx.Key_name} (${idx.Index_type}): ${idx.Column_name}`);
    });

    // 检查productTags表的索引
    console.log('\n🏷️  productTags表索引:');
    const tagIndexes = await prisma.$queryRaw`
      SHOW INDEX FROM productTags
    `;

    console.log('索引数量:', tagIndexes.length);
    tagIndexes.forEach((idx, i) => {
      console.log(`  ${i + 1}. ${idx.Key_name} (${idx.Index_type}): ${idx.Column_name}`);
    });

    // 检查productSpecs表的索引
    console.log('\n⚙️  productSpecs表索引:');
    const specIndexes = await prisma.$queryRaw`
      SHOW INDEX FROM productSpecs
    `;

    console.log('索引数量:', specIndexes.length);
    specIndexes.forEach((idx, i) => {
      console.log(`  ${i + 1}. ${idx.Key_name} (${idx.Index_type}): ${idx.Column_name}`);
    });

    // 检查表的数据量
    console.log('\n📊 表数据量统计:');
    const [categoryCount, productCount, tagCount, specCount] = await Promise.all([
      prisma.productCategories.count(),
      prisma.products.count(),
      prisma.productTags.count(),
      prisma.productSpecs.count()
    ]);

    console.log(`  productCategories: ${categoryCount} 条记录`);
    console.log(`  products: ${productCount} 条记录`);
    console.log(`  productTags: ${tagCount} 条记录`);
    console.log(`  productSpecs: ${specCount} 条记录`);

    // 检查是否有我们期望的索引
    console.log('\n✅ 期望的索引检查:');
    const expectedIndexes = [
      'idx_categories_level_sort',
      'idx_categories_parent_active',
      'idx_categories_active_sort',
      'idx_products_status_featured',
      'idx_products_status_category',
      'idx_products_name',
      'idx_tags_name_sort'
    ];

    for (const expectedIndex of expectedIndexes) {
      const exists = categoryIndexes.some(idx => idx.Key_name === expectedIndex) ||
                   productIndexes.some(idx => idx.Key_name === expectedIndex) ||
                   tagIndexes.some(idx => idx.Key_name === expectedIndex);

      console.log(`  ${exists ? '✅' : '❌'} ${expectedIndex}`);
    }

  } catch (error) {
    console.error('❌ 检查索引失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabaseIndexes().catch(console.error);