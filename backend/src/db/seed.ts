import { db, pool } from './client.js';
import { users, sportsActivities, careProviders, events } from './schema.js';
import { hashPassword } from '../services/authService.js';

async function seed() {
  console.log('Starting seed...');

  const passwordHash = await hashPassword('password123');

  console.log('Seeding users...');
  const [admin] = await db.insert(users).values([
    { email: 'admin@wevsocial.com', displayName: 'Admin User', role: 'ADMIN', passwordHash },
    { email: 'host@wevsocial.com', displayName: 'Host User', role: 'HOST', passwordHash },
    { email: 'guest@wevsocial.com', displayName: 'Guest User', role: 'GUEST', passwordHash },
    { email: 'admin@example.com', displayName: 'Admin User', role: 'ADMIN', passwordHash },
    { email: 'host1@example.com', displayName: 'Host User', role: 'HOST', passwordHash },
    { email: 'guest1@example.com', displayName: 'Guest User', role: 'GUEST', passwordHash },
  ]).onConflictDoNothing().returning();

  console.log('Seeding sports activities...');
  const adminId = admin ? admin.id : undefined;
  await db.insert(sportsActivities).values([
    { title: 'Soccer Match', sportType: 'soccer', location: 'Central Park', latitude: 40.7812, longitude: -73.9665, startTime: new Date(Date.now() + 86400000), endTime: new Date(Date.now() + 93600000), capacity: 22, createdBy: adminId },
    { title: 'Badminton Doubles', sportType: 'badminton', location: 'Downtown Gym', latitude: 40.7128, longitude: -74.0060, startTime: new Date(Date.now() + 172800000), endTime: new Date(Date.now() + 180000000), capacity: 4, createdBy: adminId },
    { title: 'Ping Pong Tourney', sportType: 'pingpong', location: 'Rec Center', latitude: 40.7306, longitude: -73.9352, startTime: new Date(Date.now() + 259200000), endTime: new Date(Date.now() + 266400000), capacity: 16, createdBy: adminId },
    { title: 'Tennis Singles', sportType: 'tennis', location: 'Flushing Meadows', latitude: 40.7498, longitude: -73.8450, startTime: new Date(Date.now() + 345600000), endTime: new Date(Date.now() + 352800000), capacity: 2, createdBy: adminId },
    { title: 'Pickup Basketball', sportType: 'basketball', location: 'West 4th St', latitude: 40.7311, longitude: -74.0009, startTime: new Date(Date.now() + 432000000), endTime: new Date(Date.now() + 439200000), capacity: 10, createdBy: adminId },
  ]).onConflictDoNothing();

  console.log('Seeding care providers...');
  await db.insert(careProviders).values([
    { name: 'Alice Care', serviceType: 'childcare', exactLat: 40.7200, exactLng: -73.9900, address: '123 Main St, NY', obfuscationSeed: 12345, hourlyRate: 2500, verified: true, bio: 'Experienced nanny.' },
    { name: 'Bob Senior Care', serviceType: 'eldercare', exactLat: 40.7500, exactLng: -73.9800, address: '456 Broadway, NY', obfuscationSeed: 67890, hourlyRate: 3000, verified: true, bio: 'Certified eldercare specialist.' },
    { name: 'Charlie Childcare', serviceType: 'childcare', exactLat: 40.7800, exactLng: -73.9500, address: '789 Park Ave, NY', obfuscationSeed: 11111, hourlyRate: 2000, verified: true, bio: 'Loves kids.' },
  ]).onConflictDoNothing();

  console.log('Seeding events...');
  await db.insert(events).values([
    { title: 'Yoga Class', location: 'Studio 1', startTime: new Date(Date.now() + 86400000), endTime: new Date(Date.now() + 90000000), capacity: 30, description: 'Morning yoga' },
    { title: 'Art Workshop', location: 'Gallery 2', startTime: new Date(Date.now() + 172800000), endTime: new Date(Date.now() + 180000000), capacity: 20, description: 'Painting' },
    { title: 'Coding Meetup', location: 'Tech Hub', startTime: new Date(Date.now() + 259200000), endTime: new Date(Date.now() + 266400000), capacity: 50, description: 'JS meetup' },
    { title: 'Book Club', location: 'Library', startTime: new Date(Date.now() + 345600000), endTime: new Date(Date.now() + 352800000), capacity: 15, description: 'Sci-fi month' },
    { title: 'Cooking Class', location: 'Kitchen', startTime: new Date(Date.now() + 432000000), endTime: new Date(Date.now() + 439200000), capacity: 12, description: 'Pasta making' },
  ]).onConflictDoNothing();

  console.log('Seed complete!');
  await pool.end();
}

seed().catch(console.error);
