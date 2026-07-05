import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const categories = await Promise.all([
    prisma.category.upsert({ where: { slug: 'news' }, update: {}, create: { name: 'News', slug: 'news', description: 'Latest news from Rwanda and around the world', color: '#DC2626' } }),
    prisma.category.upsert({ where: { slug: 'politics' }, update: {}, create: { name: 'Politics', slug: 'politics', description: 'Political news and government updates', color: '#7C3AED' } }),
    prisma.category.upsert({ where: { slug: 'business' }, update: {}, create: { name: 'Business', slug: 'business', description: 'Business and economy news', color: '#059669' } }),
    prisma.category.upsert({ where: { slug: 'technology' }, update: {}, create: { name: 'Technology', slug: 'technology', description: 'Tech news and innovation', color: '#4F46E5' } }),
    prisma.category.upsert({ where: { slug: 'sports' }, update: {}, create: { name: 'Sports', slug: 'sports', description: 'Sports news and updates', color: '#16A34A' } }),
    prisma.category.upsert({ where: { slug: 'entertainment' }, update: {}, create: { name: 'Entertainment', slug: 'entertainment', description: 'Entertainment and celebrity news', color: '#EA580C' } }),
    prisma.category.upsert({ where: { slug: 'health' }, update: {}, create: { name: 'Health', slug: 'health', description: 'Health and wellness', color: '#0891B2' } }),
    prisma.category.upsert({ where: { slug: 'world' }, update: {}, create: { name: 'World', slug: 'world', description: 'International news', color: '#2563EB' } }),
    prisma.category.upsert({ where: { slug: 'opinion' }, update: {}, create: { name: 'Opinion', slug: 'opinion', description: 'Editorials and opinions', color: '#DB2777' } }),
    prisma.category.upsert({ where: { slug: 'culture' }, update: {}, create: { name: 'Culture', slug: 'culture', description: 'Culture and lifestyle', color: '#BE185D' } }),
  ]);

  console.log(`✅ Created ${categories.length} categories`);

  const hash = await bcrypt.hash('Admin@2024!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@umunsi.com' },
    update: {},
    create: { name: 'Admin Umunsi', email: 'admin@umunsi.com', passwordHash: hash, role: 'ADMIN' },
  });

  const authorHash = await bcrypt.hash('Author@2024!', 12);
  const author = await prisma.user.upsert({
    where: { email: 'author@umunsi.com' },
    update: {},
    create: { name: 'Umunsi Author', email: 'author@umunsi.com', passwordHash: authorHash, role: 'AUTHOR' },
  });

  console.log(`✅ Created users: ${admin.name}, ${author.name}`);
  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
