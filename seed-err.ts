// packages/server/prisma/seed.ts
// Seed скрипт для создания начальных данных

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { generateLicenseKey } from '@kiosk/shared';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');
  
  // 1. Создать организацию
  console.log('📦 Creating organization...');
  const organization = await prisma.organization.upsert({
    where: { name: 'Demo Organization' },
    update: {},
    create: {
      name: 'Demo Organization',
      contactEmail: 'contact@demo.org',
      contactPhone: '+1234567890'
    }
  });
  console.log(`✅ Organization created: ${organization.name} (${organization.id})`);
  
  // 2. Создать admin пользователя
  console.log('👤 Creating admin user...');
  const adminEmail = process.env.ADMIN_DEFAULT_EMAIL || 'admin@kiosk.local';
  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'Admin123!';
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      role: 'ADMIN'
    },
    create: {
      email: adminEmail,
      passwordHash,
      role: 'ADMIN',
      organizationId: organization.id
    }
  });
  console.log(`✅ Admin user created: ${adminUser.email}`);
  console.log(`   Password: ${adminPassword}`);
  console.log(`   ⚠️  CHANGE THIS PASSWORD IN PRODUCTION!`);
  
  // 3. Создать тестовые лицензии
  console.log('🔑 Creating test licenses...');
  
  // Basic License
  const basicLicense = await prisma.license.upsert({
    where: { licenseKey: generateLicenseKey() },
    update: {},
    create: {
      licenseKey: generateLicenseKey(),
      organizationId: organization.id,
      plan: 'BASIC',
      status: 'ACTIVE',
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
    }
  });
  console.log(`✅ Basic license: ${basicLicense.licenseKey}`);
  
  // Pro License
  const proLicense = await prisma.license.upsert({
    where: { licenseKey: generateLicenseKey() },
    update: {},
    create: {
      licenseKey: generateLicenseKey(),
      organizationId: organization.id,
      plan: 'PRO',
      status: 'ACTIVE',
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    }
  });
  console.log(`✅ Pro license: ${proLicense.licenseKey}`);
  
  // Max License
  const maxLicense = await prisma.license.upsert({
    where: { licenseKey: generateLicenseKey() },
    update: {},
    create: {
      licenseKey: generateLicenseKey(),
      organizationId: organization.id,
      plan: 'MAX',
      status: 'ACTIVE',
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    }
  });
  console.log(`✅ Max license: ${maxLicense.licenseKey}`);
  
  // 4. Создать тестовое устройство (опционально)
  console.log('💻 Creating test device...');
  const testDevice = await prisma.device.create({
    data: {
      deviceId: 'TEST-DEVICE-001',
      licenseId: proLicense.id,
      appType: 'EDITOR',
      deviceName: 'Test Editor Device',
      osInfo: {
        platform: 'linux',
        release: 'Ubuntu 24.04',
        arch: 'x64'
      },
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
