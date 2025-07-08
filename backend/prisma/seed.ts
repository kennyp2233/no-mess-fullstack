import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando proceso de seed completo...');
  
  try {
    // Clear existing data in correct order (respecting foreign key constraints)
    console.log('🧹 Clearing existing data...');
    await prisma.notification.deleteMany({});
    await prisma.budget.deleteMany({});
    await prisma.minutes.deleteMany({});
    await prisma.vote.deleteMany({});
    await prisma.proposal.deleteMany({});
    await prisma.voting.deleteMany({});
    await prisma.assembly.deleteMany({});
    await prisma.transaction.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.account.deleteMany({});
    await prisma.houseUser.deleteMany({});
    await prisma.house.deleteMany({});
    await prisma.user.deleteMany({});
    console.log('✅ Datos existentes eliminados');

    console.log('🌱 Seeding database...');

    // Hash password for all users
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // Create users with various roles
    const users = await Promise.all([
      prisma.user.create({
        data: {
          name: 'Admin Principal',
          email: 'admin@condominio.com',
          password: hashedPassword,
          phone: '+57 300 123 4567',
          role: 'ADMIN',
        },
      }),
      prisma.user.create({
        data: {
          name: 'María García Presidente',
          email: 'maria.garcia@email.com',
          password: hashedPassword,
          phone: '+57 301 234 5678',
          role: 'PRESIDENT',
        },
      }),
      prisma.user.create({
        data: {
          name: 'Carlos López Tesorero',
          email: 'carlos.lopez@email.com',
          password: hashedPassword,
          phone: '+57 302 345 6789',
          role: 'TREASURER',
        },
      }),
      prisma.user.create({
        data: {
          name: 'Ana Martínez Secretaria',
          email: 'ana.martinez@email.com',
          password: hashedPassword,
          phone: '+57 303 456 7890',
          role: 'SECRETARY',
        },
      }),
      prisma.user.create({
        data: {
          name: 'Juan Pérez Residente',
          email: 'juan.perez@email.com',
          password: hashedPassword,
          phone: '+57 304 567 8901',
          role: 'RESIDENT',
        },
      }),
      prisma.user.create({
        data: {
          name: 'Laura Rodríguez',
          email: 'laura.rodriguez@email.com',
          password: hashedPassword,
          phone: '+57 305 678 9012',
          role: 'RESIDENT',
        },
      }),
      prisma.user.create({
        data: {
          name: 'Diego Hernández',
          email: 'diego.hernandez@email.com',
          password: hashedPassword,
          phone: '+57 306 789 0123',
          role: 'RESIDENT',
        },
      }),
    ]);

    console.log(`✅ Created ${users.length} users`);

    // Create houses with different financial situations
    const houses = await Promise.all([
      prisma.house.create({
        data: {
          name: 'Edificio Torres del Sol',
          description: 'Conjunto residencial de lujo con 25 apartamentos, piscina olímpica, gimnasio, salón social y amplias zonas verdes. Ubicado en el norte de la ciudad.',
          address: 'Calle 123 #45-67, Chapinero, Bogotá',
          balance: 15750000, // Balance positivo
        },
      }),
      prisma.house.create({
        data: {
          name: 'Condominio Villa Verde',
          description: 'Conjunto cerrado de 40 casas unifamiliares con vigilancia 24 horas, parque infantil, cancha de tenis y zona BBQ.',
          address: 'Carrera 50 #80-90, El Poblado, Medellín',
          balance: -2850000, // Balance negativo - necesita recuperación
        },
      }),
      prisma.house.create({
        data: {
          name: 'Residencial Los Álamos',
          description: 'Torre residencial de 15 pisos con 60 apartamentos, zona comercial en el primer piso y parqueadero subterráneo.',
          address: 'Avenida 6 #25-40, Ciudad Jardín, Cali',
          balance: 8200000, // Balance moderado
        },
      }),
    ]);

    console.log(`✅ Created ${houses.length} houses`);

    // Create house-user relationships with specific roles
    const houseUsers = await Promise.all([
      // Edificio Torres del Sol - Equipo completo de administración
      prisma.houseUser.create({
        data: { userId: users[0].id, houseId: houses[0].id, role: 'ADMIN' },
      }),
      prisma.houseUser.create({
        data: { userId: users[1].id, houseId: houses[0].id, role: 'PRESIDENT' },
      }),
      prisma.houseUser.create({
        data: { userId: users[2].id, houseId: houses[0].id, role: 'TREASURER' },
      }),
      prisma.houseUser.create({
        data: { userId: users[3].id, houseId: houses[0].id, role: 'SECRETARY' },
      }),
      prisma.houseUser.create({
        data: { userId: users[4].id, houseId: houses[0].id, role: 'RESIDENT' },
      }),
      
      // Condominio Villa Verde - Administración básica
      prisma.houseUser.create({
        data: { userId: users[0].id, houseId: houses[1].id, role: 'ADMIN' },
      }),
      prisma.houseUser.create({
        data: { userId: users[5].id, houseId: houses[1].id, role: 'PRESIDENT' },
      }),
      prisma.houseUser.create({
        data: { userId: users[2].id, houseId: houses[1].id, role: 'TREASURER' },
      }),
      prisma.houseUser.create({
        data: { userId: users[6].id, houseId: houses[1].id, role: 'RESIDENT' },
      }),
      
      // Residencial Los Álamos
      prisma.houseUser.create({
        data: { userId: users[0].id, houseId: houses[2].id, role: 'ADMIN' },
      }),
      prisma.houseUser.create({
        data: { userId: users[4].id, houseId: houses[2].id, role: 'PRESIDENT' },
      }),
      prisma.houseUser.create({
        data: { userId: users[6].id, houseId: houses[2].id, role: 'RESIDENT' },
      }),
    ]);

    console.log(`✅ Created ${houseUsers.length} house-user relationships`);

    // Create accounts for each house
    const accounts = await Promise.all([
      // Torres del Sol - Múltiples cuentas
      prisma.account.create({
        data: {
          name: 'Cuenta Principal de Administración',
          description: 'Cuenta principal para gastos operativos y mantenimiento del edificio',
          balance: 12500000,
          houseId: houses[0].id,
        },
      }),
      prisma.account.create({
        data: {
          name: 'Fondo de Reserva',
          description: 'Fondo especial para emergencias y reparaciones mayores',
          balance: 8000000,
          houseId: houses[0].id,
        },
      }),
      prisma.account.create({
        data: {
          name: 'Fondo de Mejoras',
          description: 'Cuenta destinada a proyectos de mejoramiento de zonas comunes',
          balance: 3250000,
          houseId: houses[0].id,
        },
      }),
      
      // Villa Verde - Cuenta principal con déficit
      prisma.account.create({
        data: {
          name: 'Cuenta Principal',
          description: 'Cuenta principal del condominio para operaciones diarias',
          balance: -2850000, // Déficit que debe recuperarse
          houseId: houses[1].id,
        },
      }),
      
      // Los Álamos - Cuenta única
      prisma.account.create({
        data: {
          name: 'Cuenta General',
          description: 'Cuenta general para administración del edificio',
          balance: 8200000,
          houseId: houses[2].id,
        },
      }),
    ]);

    console.log(`✅ Created ${accounts.length} accounts`);

    // Create projects in different stages
    const projects = await Promise.all([
      prisma.project.create({
        data: {
          title: 'Remodelación integral de la piscina',
          description: 'Renovación completa de la piscina incluyendo nuevo sistema de filtrado, azulejos antideslizantes, iluminación LED subacuática y área de descanso moderna.',
          budget: 12000000,
          status: 'PROPOSED',
          houseId: houses[0].id,
        },
      }),
      prisma.project.create({
        data: {
          title: 'Modernización del gimnasio',
          description: 'Adquisición de nuevos equipos de ejercicio, renovación de pisos y mejora del sistema de ventilación.',
          budget: 8500000,
          status: 'APPROVED',
          startDate: new Date('2025-02-01'),
          houseId: houses[0].id,
        },
      }),
      prisma.project.create({
        data: {
          title: 'Sistema de videovigilancia avanzado',
          description: 'Instalación de cámaras 4K en todas las zonas comunes con sistema de grabación por 30 días y acceso remoto.',
          budget: 6500000,
          status: 'IN_PROGRESS',
          startDate: new Date('2025-01-15'),
          houseId: houses[1].id,
        },
      }),
      prisma.project.create({
        data: {
          title: 'Renovación de fachada',
          description: 'Pintura completa de la fachada del edificio y reparación de grietas menores.',
          budget: 4200000,
          status: 'COMPLETED',
          startDate: new Date('2024-11-01'),
          endDate: new Date('2024-12-20'),
          houseId: houses[2].id,
        },
      }),
    ]);

    console.log(`✅ Created ${projects.length} projects`);

    console.log('🎉 Seed completed successfully!');
    console.log('\n📊 DATABASE SUMMARY:');
    console.log('====================');
    console.log(`👥 Users: ${users.length}`);
    console.log(`🏠 Houses: ${houses.length}`);
    console.log(`🔗 House-User relationships: ${houseUsers.length}`);
    console.log(`🏦 Accounts: ${accounts.length}`);
    console.log(`🚧 Projects: ${projects.length}`);
    
    console.log('\n🔑 LOGIN CREDENTIALS:');
    console.log('====================');
    console.log('Email: admin@condominio.com');
    console.log('Password: admin123');
    console.log('Role: ADMIN (all houses)');
    console.log('\nOther test accounts:');
    console.log('- maria.garcia@email.com (President - Torres del Sol)');
    console.log('- carlos.lopez@email.com (Treasurer - Multiple houses)');
    console.log('- ana.martinez@email.com (Secretary - Torres del Sol)');
    console.log('All passwords: admin123');
    
    console.log('\n💰 FINANCIAL STATUS:');
    console.log('====================');
    console.log('📈 Torres del Sol: $15,750,000 (Healthy)');
    console.log('📉 Villa Verde: -$2,850,000 (Deficit - Crisis)');
    console.log('📊 Los Álamos: $8,200,000 (Stable)');
    
  } catch (error) {
    console.error('❌ Error durante el seed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
