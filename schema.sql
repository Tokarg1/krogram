DROP TABLE IF EXISTS friend_requests CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS user_dm_channel CASCADE;
DROP TABLE IF EXISTS channels CASCADE;
DROP TABLE IF EXISTS user_server CASCADE;
DROP TABLE IF EXISTS servers CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    phone VARCHAR UNIQUE NOT NULL,
    username VARCHAR UNIQUE,
    avatar_url VARCHAR,
    last_verify_code VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE servers (
    id SERIAL PRIMARY KEY,
    name VARCHAR,
    icon_url VARCHAR,
    owner_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE user_server (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    server_id INTEGER REFERENCES servers(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, server_id)
);

CREATE TABLE channels (
    id SERIAL PRIMARY KEY,
    name VARCHAR,
    type VARCHAR DEFAULT 'text',
    server_id INTEGER REFERENCES servers(id) ON DELETE CASCADE,
    is_dm BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE user_dm_channel (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    channel_id INTEGER REFERENCES channels(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, channel_id)
);

CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    content TEXT,
    media_url VARCHAR,
    media_type VARCHAR DEFAULT 'text',
    sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    channel_id INTEGER REFERENCES channels(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE friend_requests (
    id SERIAL PRIMARY KEY,
    from_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    to_phone VARCHAR,
    status VARCHAR DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE messages, channels, friend_requests;
COMMIT;
