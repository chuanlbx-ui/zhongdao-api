#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testUserFields() {
  try {
    console.log('Testing User model fields...')

    // Try to create a simple user first
    const testUser = await prisma.user.create({
      data: {
        openid: `test_openid_${Date.now()}`,
        nickname: 'Test User',
        phone: `1${Date.now().toString().slice(-10)}`,
        level: 'NORMAL',
        status: 'ACTIVE',
      },
      select: {
        id: true,
        openid: true,
        nickname: true,
        phone: true,
        level: true,
        status: true,
      }
    })

    console.log('✓ Successfully created test user:', testUser)

    // Try to find the user and see all available fields
    const foundUser = await prisma.user.findUnique({
      where: { id: testUser.id },
    })

    console.log('✓ User fields available:', Object.keys(foundUser || {}))

    // Clean up
    await prisma.user.delete({
      where: { id: testUser.id }
    })

    console.log('✓ Test completed successfully')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testUserFields()