import asyncio
import asyncpg
import sys

DATABASE_URL = "postgresql://postgres:KroGramSecurePass!2026@db.fjiufsyrzoymdhrabnog.supabase.co:5432/postgres"

sql_commands = """
-- Drop existing tables
DROP TABLE IF EXISTS friend_requests CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS user_dm_channel CASCADE;
DROP TABLE IF EXISTS channels CASCADE;
DROP TABLE IF EXISTS user_server CASCADE;
DROP TABLE IF EXISTS servers CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    phone VARCHAR UNIQUE NOT NULL,
    username VARCHAR UNIQUE,
    avatar_url VARCHAR,
    last_verify_code VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Servers Table
CREATE TABLE servers (
    id SERIAL PRIMARY KEY,
    name VARCHAR,
    icon_url VARCHAR,
    owner_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create User-Server Many-to-Many
CREATE TABLE user_server (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    server_id INTEGER REFERENCES servers(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, server_id)
);

-- Create Channels Table
CREATE TABLE channels (
    id SERIAL PRIMARY KEY,
    name VARCHAR,
    type VARCHAR DEFAULT 'text',
    server_id INTEGER REFERENCES servers(id) ON DELETE CASCADE,
    is_dm BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create User-DM Channel Many-to-Many
CREATE TABLE user_dm_channel (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    channel_id INTEGER REFERENCES channels(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, channel_id)
);

-- Create Messages Table
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    content TEXT,
    media_url VARCHAR,
    media_type VARCHAR DEFAULT 'text',
    sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    channel_id INTEGER REFERENCES channels(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Friend Requests Table
CREATE TABLE friend_requests (
    id SERIAL PRIMARY KEY,
    from_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    to_phone VARCHAR,
    status VARCHAR DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Realtime for relevant tables!
-- In Supabase, realtime is enabled via publication 'supabase_realtime'
-- First drop publication if exists, then create and add tables
BEGIN;
  -- Add tables to the realtime publication
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  ALTER PUBLICATION supabase_realtime ADD TABLE channels;
  ALTER PUBLICATION supabase_realtime ADD TABLE friend_requests;
COMMIT;
"""

async def run():
    print("Connecting to Supabase DB...")
    try:
        conn = await asyncpg.connect(DATABASE_URL)
        print("Connected! Executing schema...")
        await conn.execute(sql_commands)
        print("Schema successfully applied!")
        await conn.close()
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(run())
