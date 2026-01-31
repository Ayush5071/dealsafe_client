import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import chatHistoryDb from '@/lib/chatHistoryDb';

/**
 * Chat History API
 * Manage chat sessions and persistence
 */

// GET - Fetch user's chat sessions or specific session
export async function GET(request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('sessionId');

        if (sessionId) {
            // Get specific session with messages
            const chatSession = await chatHistoryDb.getSession(parseInt(sessionId));

            if (!chatSession) {
                return NextResponse.json({ error: 'Session not found' }, { status: 404 });
            }

            return NextResponse.json({ success: true, session: chatSession });
        } else {
            // Get all user sessions
            const sessions = await chatHistoryDb.getUserSessions(session.user.email);
            return NextResponse.json({ success: true, sessions });
        }
    } catch (error) {
        console.error('Chat History GET error:', error);
        return NextResponse.json({
            error: 'Failed to fetch chat history',
            details: error?.message
        }, { status: 500 });
    }
}

// POST - Create new session or add message
export async function POST(request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { action, sessionId, title, role, content } = body;

        if (action === 'create') {
            // Create new session
            const newSessionId = await chatHistoryDb.createSession(
                session.user.email,
                title || 'New Chat'
            );

            return NextResponse.json({
                success: true,
                sessionId: newSessionId
            });
        } else if (action === 'addMessage') {
            // Add message to session
            if (!sessionId || !role || !content) {
                return NextResponse.json({
                    error: 'sessionId, role, and content are required'
                }, { status: 400 });
            }

            await chatHistoryDb.addMessage(sessionId, role, content);

            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({
                error: 'Invalid action'
            }, { status: 400 });
        }
    } catch (error) {
        console.error('Chat History POST error:', error);
        return NextResponse.json({
            error: 'Failed to save chat',
            details: error?.message
        }, { status: 500 });
    }
}

// DELETE - Delete session
export async function DELETE(request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('sessionId');

        if (!sessionId) {
            return NextResponse.json({
                error: 'sessionId is required'
            }, { status: 400 });
        }

        await chatHistoryDb.deleteSession(parseInt(sessionId));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Chat History DELETE error:', error);
        return NextResponse.json({
            error: 'Failed to delete session',
            details: error?.message
        }, { status: 500 });
    }
}
