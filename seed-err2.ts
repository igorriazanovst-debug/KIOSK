// packages/server/prisma/seed.ts
// Seed скрипт для создания начальных данных

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { generateLicenseKey, PLAN_CONFIGS, Plan } from '@kiosk/shared';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');
  
  // 1. Создать admin пользователя и организацию вместе
  console.log('👤 Creating admin user and organization...');
  const adminEmail = process.env.ADMIN_DEFAULT_EMAIL || 'admin@kiosk.local';
  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'Admin123!';
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  
  // Проверяем существует ли уже admin
  let adminUser = await prisma.user.findUnique({
    where: { email: adminEmail },
    include: { organization: true }
  });
  
  let organization;
  
  if (adminUser) {
    console.log(`ℹ️  Admin user already exists: ${adminUser.email}`);
    organization = adminUser.organization;
  } else {
    // Создаём пользователя с организацией
    adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        role: 'ADMIN',
        organization: {
          create: {
            name: 'Demo Organization'
          }
        }
      },
      include: { organization: true }
    });
    
    organization = adminUser.organization!;
    
    console.log(`✅ Admin user created: ${adminUser.email}`);
    console.log(`✅ Organization created: ${organization.name} (${organization.id})`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   ⚠️  CHANGE THIS PASSWORD IN PRODUCTION!`);
  }
  
  // 2. Создать тестовые лицензии
  console.log('🔑 Creating test licenses...');
  
  const now = new Date();
  const oneYearLater = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  
  // Basic License
  const basicConfig = PLAN_CONFIGS[Plan.Basic];
  const basicLicense = await prisma.license.create({
    data: {
      licenseKey: generateLicenseKey(),
      organizationId: organization.id,
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
  const proLicense = await prisma.license.create({
    data: {
      licenseKey: generateLicenseKey(),
      organizationId: organization.id,
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
  const maxLicense = await prisma.license.create({
    data: {
      licenseKey: generateLicenseKey(),
      organizationId: organization.id,
      plan: 'MAX',
      status: 'ACTIVE',
      seatsEditor: maxConfig.seatsEditor,
      seatsPlayer: maxConfig.seatsPlayer,
      validFrom: now,
      validUntil: oneYearLater
    }
  });
  console.log(`✅ Max license: ${maxLicense.licenseKey}`);
  
  // 3. Создать тестовое устройство (опционально)
  console.log('💻 Creating test device...');
  const testDevice = await prisma.device.create({
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
