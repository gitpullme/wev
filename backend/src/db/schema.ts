import { pgTable, uuid, text, timestamp, integer, boolean, doublePrecision } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  role: text('role').notNull().default('GUEST'), // 'GUEST', 'HOST', 'ADMIN'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  tokenHash: text('token_hash').notNull(),
  familyId: uuid('family_id').notNull(),
  revoked: boolean('revoked').default(false),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const sportsActivities = pgTable('sports_activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  sportType: text('sport_type').notNull(),
  description: text('description'),
  location: text('location').notNull(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  capacity: integer('capacity').notNull(),
  bookedCount: integer('booked_count').default(0),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

export const sportsBookings = pgTable('sports_bookings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  activityId: uuid('activity_id').notNull().references(() => sportsActivities.id),
  status: text('status').notNull().default('PENDING'), // 'PENDING', 'CONFIRMED', 'CANCELLED', 'CONFLICT_REJECTED'
  clientId: text('client_id'),
  createdAt: timestamp('created_at').defaultNow(),
  syncedAt: timestamp('synced_at'),
});

export const careProviders = pgTable('care_providers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  serviceType: text('service_type').notNull(), // 'childcare' | 'eldercare'
  bio: text('bio'),
  exactLat: doublePrecision('exact_lat').notNull(),
  exactLng: doublePrecision('exact_lng').notNull(),
  address: text('address').notNull(),
  obfuscationSeed: integer('obfuscation_seed').notNull(),
  verified: boolean('verified').default(true),
  hourlyRate: integer('hourly_rate').notNull(), // cents
  createdAt: timestamp('created_at').defaultNow(),
});

export const careBookings = pgTable('care_bookings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  providerId: uuid('provider_id').notNull().references(() => careProviders.id),
  status: text('status').notNull().default('PENDING'), // 'PENDING', 'CONFIRMED', 'CANCELLED', 'CONFLICT_REJECTED'
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  clientId: text('client_id'),
  createdAt: timestamp('created_at').defaultNow(),
  syncedAt: timestamp('synced_at'),
});

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  location: text('location').notNull(),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  capacity: integer('capacity'),
  createdAt: timestamp('created_at').defaultNow(),
});
