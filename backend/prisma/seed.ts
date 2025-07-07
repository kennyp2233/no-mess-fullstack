import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding database...');

    // Clear existing data (only for development)
    await prisma.houseUser.deleteMany();
    await prisma.receipt.deleteMany();
    await prisma.house.deleteMany();
    await prisma.user.deleteMany();

    // Create test users
    const hashedPassword = await bcrypt.hash('password123', 10);

    const testUser = await prisma.user.create({
        data: {
            email: 'test@example.com',
            name: 'Test User',
            password: hashedPassword,
        },
    });

    const adminUser = await prisma.user.create({
        data: {
            email: 'admin@example.com',
            name: 'Admin User',
            password: hashedPassword,
        },
    });

    const tenantUser = await prisma.user.create({
        data: {
            email: 'tenant@example.com',
            name: 'Tenant User',
            password: hashedPassword,
        },
    });

    console.log('Created test users:', [testUser.email, adminUser.email, tenantUser.email]);

    // Create test houses
    const house1 = await prisma.house.create({
        data: {
            name: 'Casa Principal',
            description: 'Casa principal con 3 habitaciones y 2 baños',
        },
    });

    const house2 = await prisma.house.create({
        data: {
            name: 'Apartamento Centro',
            description: 'Moderno apartamento en el centro de la ciudad',
        },
    });

    const house3 = await prisma.house.create({
        data: {
            name: 'Casa de Campo',
            description: 'Hermosa casa de campo con jardín y piscina',
        },
    });

    const house4 = await prisma.house.create({
        data: {
            name: 'Estudio Moderno',
            description: 'Estudio completamente amueblado para una persona',
        },
    });

    const house5 = await prisma.house.create({
        data: {
            name: 'Villa Familiar',
            description: 'Amplia villa familiar con múltiples habitaciones',
        },
    });

    console.log('Created test houses:', [house1.name, house2.name, house3.name, house4.name, house5.name]);

    // Create user-house relationships
    await prisma.houseUser.create({
        data: {
            userId: testUser.id,
            houseId: house1.id,
            role: 'ADMIN',
        },
    });

    await prisma.houseUser.create({
        data: {
            userId: adminUser.id,
            houseId: house2.id,
            role: 'ADMIN',
        },
    });

    await prisma.houseUser.create({
        data: {
            userId: tenantUser.id,
            houseId: house1.id,
            role: 'MEMBER',
        },
    });

    await prisma.houseUser.create({
        data: {
            userId: adminUser.id,
            houseId: house3.id,
            role: 'ADMIN',
        },
    });

    await prisma.houseUser.create({
        data: {
            userId: testUser.id,
            houseId: house4.id,
            role: 'MEMBER',
        },
    });

    console.log('Created user-house relationships');

    // Create test receipts
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    // Electricity bill for Casa Principal (January)
    await prisma.receipt.create({
        data: {
            title: 'Electricity Bill - January',
            description: 'Monthly electricity consumption',
            amount: 145.50,
            date: new Date(currentYear, 0, 15), // January 15th
            status: 'APPROVED',
            userId: testUser.id,
            houseId: house1.id,
        },
    });

    // Water bill for Casa Principal (January)
    await prisma.receipt.create({
        data: {
            title: 'Water Bill - January',
            description: 'Monthly water consumption',
            amount: 75.30,
            date: new Date(currentYear, 0, 20), // January 20th
            status: 'APPROVED',
            userId: testUser.id,
            houseId: house1.id,
        },
    });

    // Internet bill for Casa Principal (February)
    await prisma.receipt.create({
        data: {
            title: 'Internet Bill - February',
            description: 'Monthly internet service',
            amount: 89.99,
            date: new Date(currentYear, 1, 5), // February 5th
            status: 'PENDING',
            userId: testUser.id,
            houseId: house1.id,
        },
    });

    // Gas bill for Apartamento Centro (January)
    await prisma.receipt.create({
        data: {
            title: 'Gas Bill - January',
            description: 'Monthly gas consumption',
            amount: 65.20,
            date: new Date(currentYear, 0, 10), // January 10th
            status: 'APPROVED',
            userId: adminUser.id,
            houseId: house2.id,
        },
    });

    // Electricity bill for Apartamento Centro (February)
    await prisma.receipt.create({
        data: {
            title: 'Electricity Bill - February',
            description: 'Monthly electricity consumption',
            amount: 120.75,
            date: new Date(currentYear, 1, 15), // February 15th
            status: 'PENDING',
            userId: adminUser.id,
            houseId: house2.id,
        },
    });

    // Maintenance fee for Casa de Campo
    await prisma.receipt.create({
        data: {
            title: 'Property Maintenance',
            description: 'Garden and pool maintenance',
            amount: 250.00,
            date: new Date(currentYear, 0, 25), // January 25th
            status: 'REJECTED',
            userId: adminUser.id,
            houseId: house3.id,
        },
    });

    // Rent for Estudio Moderno
    await prisma.receipt.create({
        data: {
            title: 'Monthly Rent',
            description: 'Rent payment for February',
            amount: 800.00,
            date: new Date(currentYear, 1, 1), // February 1st
            status: 'APPROVED',
            userId: testUser.id,
            houseId: house4.id,
        },
    });

    // Recent receipt for testing current month
    await prisma.receipt.create({
        data: {
            title: 'Electricity Bill - Current Month',
            description: 'Current month electricity bill',
            amount: 156.80,
            date: new Date(currentYear, currentMonth, 10),
            status: 'PENDING',
            userId: testUser.id,
            houseId: house1.id,
        },
    });

    console.log('Created test receipts');

    console.log('Seeding completed.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
