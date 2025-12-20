import type { Express, Request, Response } from 'express';
import { getAvaReply } from '../core/decisionEngine.js';
import { debugLog } from '../utils/debug.js';
import { getMessagesPage, getPrimaryUserId, getRecentMessages, getSessionByToken, hasUsers, recordMessage } from '../db/database.js';
import { executeCreateNote } from '../tools/create_note.js';

type QueueItem = {
	id: string;
	userId: number;
	message: string;
	createdAt: number;
	res?: Response;
	canceled: boolean;
	blocking: boolean;
};

const messageQueue: QueueItem[] = [];
const activeItems = new Set<QueueItem>();
let blockingCount = 0;

function getUserIdFromRequest(req: Request): number | undefined {
	const token =
		(typeof req.headers['x-session-token'] === 'string' && req.headers['x-session-token']) ||
		(typeof req.query.token === 'string' && req.query.token);
	if (token) {
		const user = getSessionByToken(token);
		if (user?.id) return user.id;
	}
	return getPrimaryUserId();
}

function cancelQueuedForUser(userId: number) {
	for (let i = messageQueue.length - 1; i >= 0; i -= 1) {
		const item = messageQueue[i];
		if (item.userId !== userId) continue;
		item.canceled = true;
		if (item.res && !item.res.headersSent) {
			item.res.status(409).json({ error: 'canceled', message: 'Message superseded by a newer one.' });
		}
		messageQueue.splice(i, 1);
	}
}

function cancelActiveForUser(userId: number) {
	for (const item of activeItems) {
		if (item.userId !== userId || item.canceled) continue;
		item.canceled = true;
		if (item.blocking) {
			item.blocking = false;
			blockingCount = Math.max(0, blockingCount - 1);
		}
		if (item.res && !item.res.headersSent) {
			item.res.status(409).json({ error: 'canceled', message: 'Message superseded by a newer one.' });
		}
	}
}

function enqueueMessage(userId: number, message: string, res?: Response) {
	cancelActiveForUser(userId);
	cancelQueuedForUser(userId);
	const item: QueueItem = {
		id: `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		userId,
		message,
		createdAt: Date.now(),
		res,
		canceled: false,
		blocking: false,
	};
	messageQueue.push(item);
	processQueue();
}

function hasActiveOrQueued(userId: number): boolean {
	if (messageQueue.some((item) => item.userId === userId && !item.canceled)) return true;
	for (const item of activeItems) {
		if (item.userId === userId && !item.canceled) return true;
	}
	return false;
}

async function processQueue() {
	if (blockingCount > 0) return;
	while (messageQueue.length) {
		const next = messageQueue.shift();
		if (!next || next.canceled) continue;
		next.blocking = true;
		blockingCount = 1;
		activeItems.add(next);
		void runQueueItem(next);
		return;
	}
}

async function runQueueItem(item: QueueItem) {
	try {
		const recentMessages = getRecentMessages(30, item.userId);
		const shortHistory = recentMessages
			.map((entry) => `${entry.sender === 'ava' ? 'Ava' : 'User'}: ${entry.message}`)
			.join('\n');

		const { json, promptTokens, responseTokens, elapsedSec, tps } = await getAvaReply(item.message, shortHistory);
		if (item.canceled) return;

		debugLog("info", `User message tokens sent: ${promptTokens}`);
		debugLog("info", `Message generated. Tokens sent: ${promptTokens}, Response tokens: ${responseTokens}, Time: ${elapsedSec.toFixed(2)}s, TPS: ${tps}`);

		if (!json || typeof json !== 'object' || typeof (json as any).reply !== 'string') {
			debugLog("warn", 'Invalid model response for queued message.');
			if (item.res && !item.res.headersSent) {
				item.res.status(502).json({ error: 'bad_model_response', message: 'Model returned invalid data' });
			}
			return;
		}

		// Handle tool execution (CREATE_NOTE)
		if ((json as any).tool === "CREATE_NOTE") {
			const noteReply = executeCreateNote(item.userId, json as any, item.message, shortHistory);
			(json as any).reply = noteReply.reply;
			(json as any).reason = noteReply.reason ?? (json as any).reason;
			// Augment parameters with created note id if available
			(json as any).parameters = {
				...(json as any).parameters,
				noteId: noteReply.noteId ?? (json as any).parameters?.noteId,
			};
		}

		recordMessage(
			'ava',
			(json as any).reply,
			item.userId,
			(json as any).reason || '',
			JSON.stringify((json as any).parameters) || ''
		);

		if (item.res && !item.res.headersSent) {
			item.res.status(200).json(json);
		}
	} catch (err) {
		debugLog("warn", 'Queue processing failed:', err);
		if (item.res && !item.res.headersSent) {
			item.res.status(500).json({ error: 'internal_error' });
		}
	} finally {
		activeItems.delete(item);
		if (item.blocking) {
			item.blocking = false;
			blockingCount = Math.max(0, blockingCount - 1);
		}
		processQueue();
	}
}

function ensurePendingReply(userId: number) {
	if (hasActiveOrQueued(userId)) return;
	const recentMessages = getRecentMessages(30, userId);
	if (!recentMessages.length) return;
	const last = recentMessages[recentMessages.length - 1];
	if (last.sender !== 'user') return;
	enqueueMessage(userId, last.message);
}

type NoteResult = { reply: string; reason?: string; noteId?: number };

export function registerChatRoutes(app: Express) {
	// POST /api/chat - get Ava's reply to a user message
	app.post('/api/chat', async (req: Request, res: Response) => {
		try {
			const { message } = req.body;

			if (!message || typeof message !== 'string') {
				return res.status(400).json({ error: 'message is required' });
			}

			if (!hasUsers()) {
				return res.status(403).json({ error: 'no_user', message: 'Create an admin user before chatting' });
			}

			const userId = getUserIdFromRequest(req);
			if (!userId) {
				return res.status(500).json({ error: 'internal_error', message: 'No user found' });
			}

			const cleanMsg = String(message).slice(0, 300);
			debugLog("info", 'USER message received');
			debugLog("debug", cleanMsg);

			recordMessage('user', cleanMsg, userId);
			enqueueMessage(userId, cleanMsg, res);
			return;
		} catch (err) {
			console.error('Error in /api/chat:', err);
			return res.status(500).json({ error: 'internal_error' });
		}
	});

	// GET /api/chat/history?offset=0&limit=30 - paginated chat history
	app.get('/api/chat/history', (req: Request, res: Response) => {
		if (!hasUsers()) {
			return res.status(403).json({ error: 'no_user', message: 'Create an admin user before chatting' });
		}
		const userId = getUserIdFromRequest(req);
		if (!userId) {
			return res.status(500).json({ error: 'internal_error', message: 'No user found' });
		}
		ensurePendingReply(userId);
		const offset = Number.parseInt(String(req.query.offset ?? '0'), 10) || 0;
		const limit = Number.parseInt(String(req.query.limit ?? '30'), 10) || 30;
		const { rows, total } = getMessagesPage(offset, limit, userId);
		const nextOffset = offset + rows.length;
		const hasMore = nextOffset < total;
		return res.status(200).json({
			messages: rows,
			total,
			nextOffset,
			hasMore,
		});
	});
}
