import {sqliteTable,text,integer,index} from 'drizzle-orm/sqlite-core';
export const rooms=sqliteTable('game_rooms',{
 id:text('id').primaryKey(),host:text('host').notNull(),version:integer('version').notNull().default(0),state:text('state').notNull(),expires:integer('expires').notNull(),created:integer('created').notNull()
},t=>[index('room_expiry').on(t.expires),index('room_host').on(t.host)]);
export const accessAttempts=sqliteTable('access_attempts',{
 id:text('id').primaryKey(),attempts:integer('attempts').notNull(),started:integer('started').notNull()
},t=>[index('access_attempt_expiry').on(t.started)]);

export const clubState=sqliteTable('club_state',{id:integer('id').primaryKey(),version:integer('version').notNull().default(0),state:text('state').notNull()});

export const maintenanceReceipts=sqliteTable('maintenance_receipts',{id:text('id').primaryKey(),playerId:text('player_id').notNull(),playerName:text('player_name').notNull(),refunded:integer('refunded').notNull(),previousBank:integer('previous_bank').notNull(),correctedBank:integer('corrected_bank').notNull(),previousNet:integer('previous_guandan_net').notNull(),correctedNet:integer('corrected_guandan_net').notNull(),createdAt:integer('created_at').notNull()});
