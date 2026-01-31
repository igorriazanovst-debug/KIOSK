// packages/server/prisma/seed.ts
// Seed скрипт для создания начальных данных

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

// Импортируем из относительного пути вместо алиаса
import { generateLicenseKey } from '../../shared/dist/utils/license';
import { PLAN_CONFIGS } from '../../shared/dist/constants/plans';
import { Plan } from '../../shared/dist/types/license';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');
  
  const adminEmail = process.env.ADMIN_DEFAULT_EMAIL || 'admin@kiosk.local';
  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'Admin123!';
  
  // 1. Проверяем существует ли admin
  let adminUser = await prisma.user.findUnique({
    where: { email: adminEmail }
  });
  
  let organization;
  
  if (adminUser) {
    console.log(`ℹ️  Admin user already exists: ${adminUser.email}`);
    
    // Найти организацию пользователя
    if (adminUser.organizationId) {
      organization = await prisma.organization.findUnique({
        where: { id: adminUser.organizationId }
      });
    }
    
    if (!organization) {
      console.log('⚠️  Organization not found for existing admin. Please check your database.');
      process.exit(1);
    }
  } else {
    // Создаём через raw SQL чтобы обойти циклическую зависимость
    console.log('👤 Creating admin user and organization...');
    
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const userId = crypto.randomUUID();
    const orgId = crypto.randomUUID();
    
    // Создаём организацию
    await prisma.$executeRaw`
      INSERT INTO "Organization" (id, name, "ownerUserId", "createdAt", "updatedAt")
      VALUES (${orgId}, 'Demo Organization', ${userId}, NOW(), NOW())
    `;
    
    // Создаём пользователя
    await prisma.$executeRaw`
      INSERT INTO "User" (id, email, "passwordHash", role, "organizationId", "createdAt", "updatedAt")
      VALUES (${userId}, ${adminEmail}, ${passwordHash}, 'ADMIN', ${orgId}, NOW(), NOW())
    `;
    
    console.log(`✅ Admin user created: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   ⚠️  CHANGE THIS PASSWORD IN PRODUCTION!`);
    
    // Получаем созданные записи
    adminUser = await prisma.user.findUnique({
      where: { email: adminEmail }
    });
    
    organization = await prisma.organization.findUnique({
      where: { id: orgId }
    });
    
    console.log(`✅ Organization created: ${organization!.name} (${organization!.id})`);
  }
  
  // 2. Создать тестовые лицензии
  console.log('🔑 Creating test licenses...');
  
  const now = new Date();
  const oneYearLater = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  
  // Проверяем существующие лицензии
  const existingLicenses = await prisma.license.findMany({
    where: { organizationId: organization!.id }
  });
  
  let basicLicense, proLicense, maxLicense;
  
  if (existingLicenses.length >= 3) {
    console.log(`ℹ️  Licenses already exist for this organization`);
    basicLicense = existingLicenses.find(l => l.plan === 'BASIC') || existingLicenses[0];
    proLicense = existingLicenses.find(l => l.plan === 'PRO') || existingLicenses[1];
    maxLicense = existingLicenses.find(l => l.plan === 'MAX') || existingLicenses[2];
  } else {
    // Basic License
    const basicConfig = PLAN_CONFIGS[Plan.Basic];
    basicLicense = await prisma.license.create({
      data: {
        licenseKey: generateLicenseKey(),
        organizationId: organization!.id,
        plan: 'BASIC',
        status: 'ACTIVE',
        seatsEditor: basicConfig.seatsEditor,
        seatsPlayer: basicConfig.seatsPlayer,
        validFrom: now,
        validUntil: oneYearLater
      }
    });
    console.log(`✅ Basic license: ${basicLicense.licenseKey}`);
    
    // Pro License
    const proConfig = PLAN_CONFIGS[Plan.Pro];
    proLicense = await prisma.license.create({
      data: {
        licenseKey: generateLicenseKey(),
        organizationId: organization!.id,
        plan: 'PRO',
        status: 'ACTIVE',
        seatsEditor: proConfig.seatsEditor,
        seatsPlayer: proConfig.seatsPlayer,
        validFrom: now,
        validUntil: oneYearLater
      }
    });
    console.log(`✅ Pro license: ${proLicense.licenseKey}`);
    
    // Max License
    const maxConfig = PLAN_CONFIGS[Plan.Max];
    maxLicense = await prisma.license.create({
      data: {
        licenseKey: generateLicenseKey(),
        organizationId: organization!.id,
        plan: 'MAX',
        status: 'ACTIVE',
        seatsEditor: maxConfig.seatsEditor,
        seatsPlayer: maxConfig.seatsPlayer,
        validFrom: now,
        validUntil: oneYearLater
      }
    });
    console.log(`✅ Max license: ${maxLicense.licenseKey}`);
  }
  
  // 3. Создать тестовое устройство (опционально)
  const existingDevice = await prisma.device.findUnique({
    where: { deviceId: 'TEST-DEVICE-001' }
  });
  
  let testDevice;
  if (existingDevice) {
    console.log(`ℹ️  Test device already exists: ${existingDevice.deviceId}`);
    testDevice = existingDevice;
  } else {
    console.log('💻 Creating test device...');
    testDevice = await prisma.device.create({
      data: {
        deviceId: 'TEST-DEVICE-001',
        licenseId: proLicense.id,
        appType: 'EDITOR',
        deviceName: 'Test Editor Device',
        osInfo: JSON.stringify({
          platform: 'linux',
          release: 'Ubuntu 24.04',
          arch: 'x64'
        }),
        status: 'ACTIVE'
      }
    });
    console.log(`✅ Test device created: ${testDevice.deviceId}`);
  }
  
  console.log('');
  console.log('════════════════════════════════════════════════════════');
  console.log('🎉 Database seeded successfully!');
  console.log('════════════════════════════════════════════════════════');
  console.log('');
  console.log('📋 Test Credentials:');
  console.log(`   Email:    ${adminEmail}`);
  console.log(`   Password: ${adminPassword}`);
  console.log('');
  console.log('🔑 Test License Keys:');
  console.log(`   Basic: ${basicLicense.licenseKey}`);
  console.log(`   Pro:   ${proLicense.licenseKey}`);
  console.log(`   Max:   ${maxLicense.licenseKey}`);
  console.log('');
  console.log('💻 Test Device:');
  console.log(`   Device ID: ${testDevice.deviceId}`);
  console.log(`   App Type:  ${testDevice.appType}`);
  console.log('');
  console.log('⚠️  Remember to change the admin password in production!');
  console.log('');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error seeding database:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
