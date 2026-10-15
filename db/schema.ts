import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const rooms = sqliteTable('quick_rooms', {
  id: text('id').primaryKey(), code: text('code').notNull(),
  host: text('host').notNull(), peer: text('peer').notNull(),
  map: text('map').notNull(), phase: text('phase').notNull(),
  protocol: text('protocol').notNull(), created: integer('created').notNull(),
  heartbeat: integer('heartbeat').notNull(),
}, t => [index('quick_rooms_available').on(t.protocol, t.phase, t.heartbeat)]);
export const seats = sqliteTable('quick_seats', {
  token: text('token').primaryKey(),
  room: text('room').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  peer: text('peer').notNull(), expires: integer('expires').notNull(),
  connected: integer('connected').notNull().default(0),
}, t => [index('quick_seats_room').on(t.room, t.expires)]);
export const limits = sqliteTable('quick_limits', {
  key: text('key').primaryKey(), count: integer('count').notNull(),
  expires: integer('expires').notNull(),
});
