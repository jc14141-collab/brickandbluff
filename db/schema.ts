import {sqliteTable,text,integer,index} from 'drizzle-orm/sqlite-core';
export const rooms=sqliteTable('game_rooms',{
 id:text('id').primaryKey(),host:text('host').notNull(),version:integer('version').notNull().default(0),state:text('state').notNull(),expires:integer('expires').notNull(),created:integer('created').notNull()
},t=>[index('room_expiry').on(t.expires),index('room_host').on(t.host)]);
export const accessAttempts=sqliteTable('access_attempts',{
 id:text('id').primaryKey(),attempts:integer('attempts').notNull(),started:integer('started').notNull()
},t=>[index('access_attempt_expiry').on(t.started)]);

export const clubState=sqliteTable('club_state',{id:integer('id').primaryKey(),version:integer('version').notNull().default(0),state:text('state').notNull()});
