-- ==============================================================
-- NEXUS LLM • SUPABASE DATABASE SCHEMA
-- ==============================================================
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql/new
-- ==============================================================

-- 1. Create Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL DEFAULT 'New Conversation',
    provider TEXT DEFAULT 'mock',
    model TEXT DEFAULT 'mock-llm-v1',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    provider TEXT,
    model TEXT,
    latency_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Indexes for High Performance Querying
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at ASC);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 5. Define Permissive Policies for Anon & Authenticated Users
-- (You can restrict these further if implementing Supabase Auth)
CREATE POLICY "Allow anon read conversations" 
    ON public.conversations FOR SELECT 
    USING (true);

CREATE POLICY "Allow anon insert conversations" 
    ON public.conversations FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Allow anon update conversations" 
    ON public.conversations FOR UPDATE 
    USING (true);

CREATE POLICY "Allow anon delete conversations" 
    ON public.conversations FOR DELETE 
    USING (true);

CREATE POLICY "Allow anon read messages" 
    ON public.messages FOR SELECT 
    USING (true);

CREATE POLICY "Allow anon insert messages" 
    ON public.messages FOR INSERT 
    WITH CHECK (true);

-- 6. Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_conversations_updated_at ON public.conversations;
CREATE TRIGGER set_conversations_updated_at
    BEFORE UPDATE ON public.conversations
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at();
