const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUser() {
  try {
    const user = await prisma.users.findUnique({
      where: { id: 'cmi4nwm5j50010e15rbuagpog' },
      select: { id: true, nickname: true, level: true, status: true, pointsBalance: true }
    });
    console.log('User found:', user);

    if (!user) {
      // 查找第一个用户
      const firstUser = await prisma.users.findFirst({
        select: { id: true, nickname: true, level: true, status: true, pointsBalance: true }
      });
      console.log('First user:', firstUser);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();