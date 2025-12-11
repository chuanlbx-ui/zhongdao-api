const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'mysql://dev_user:dev_password_123@127.0.0.1:3306/zhongdao_mall_dev?authPlugin=mysql_native_password'
    }
  }
});

async function testTables() {
  try {
    console.log('Testing Prisma tables...');

    // Test with singular form
    try {
      const count1 = await prisma.productCategory.count();
      console.log('✅ productCategory (singular) works, count:', count1);
    } catch (error) {
      console.log('❌ productCategory (singular) failed:', error.message);
    }

    // Test with plural form
    try {
      const count2 = await prisma.productCategories.count();
      console.log('✅ productCategories (plural) works, count:', count2);
    } catch (error) {
      console.log('❌ productCategories (plural) failed:', error.message);
    }

    // Test products table
    try {
      const count3 = await prisma.products.count();
      console.log('✅ products works, count:', count3);
    } catch (error) {
      console.log('❌ products failed:', error.message);
    }

    // Test productTags table
    try {
      const count4 = await prisma.productTags.count();
      console.log('✅ productTags works, count:', count4);
    } catch (error) {
      console.log('❌ productTags failed:', error.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testTables();