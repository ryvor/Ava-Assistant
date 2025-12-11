import type { Express, Request, Response } from 'express';
import { getAvaReply } from '../model/decisionEngine.js';
import { debugLog } from '../utils/debug.js';

export function registerChatRoutes(app: Express) {
	app.post('/api/chat', async (req: Request, res: Response) => {
		try {
			const { message, history } = req.body;

			if (!message || typeof message !== 'string') {
				return res.status(400).json({ error: 'message is required' });
			}

			debugLog('USER:', message);

			const shortHistory = "I saw pizza recipes earlier. there was one with tomatoes, cheese, and basil. and another with pepperoni and mushrooms. my favorite was the margherita pizza.";
			typeof history === 'string' ? history : '';

			const raw = await getAvaReply(message, shortHistory);

			debugLog('MODEL RAW REPLY:', raw);

			// Just send the raw model output so you can see it
			return res.status(200).json({ reply: raw });
		} catch (err) {
			console.error('Error in /api/plan:', err);
			return res.status(500).json({ error: 'internal_error' });
		}
	});
}