/*
  # Create conversations table for voice bot

  1. New Tables
    - `conversations`
      - `id` (uuid, primary key) - Unique conversation identifier
      - `session_id` (text) - Session identifier for grouping messages
      - `user_message` (text) - User's spoken input
      - `bot_response` (text) - Bot's generated response
      - `created_at` (timestamptz) - Timestamp of the conversation
      - `metadata` (jsonb) - Additional data like sentiment, duration, etc.
  
  2. Security
    - Enable RLS on `conversations` table
    - Add policy for public insert (for demo purposes)
    - Add policy for public select (for demo purposes)
    
  3. Indexes
    - Add index on session_id for faster queries
    - Add index on created_at for chronological sorting
*/

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  user_message text NOT NULL,
  bot_response text NOT NULL,
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);

-- Enable Row Level Security
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert conversations (for demo purposes)
CREATE POLICY "Anyone can insert conversations"
  ON conversations
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anyone to view conversations (for demo purposes)
CREATE POLICY "Anyone can view conversations"
  ON conversations
  FOR SELECT
  TO anon
  USING (true);