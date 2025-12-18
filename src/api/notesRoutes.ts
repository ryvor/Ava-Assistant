import type { Express, Request, Response } from 'express';
import { createNote, deleteNote, getNotes, getSessionByToken, updateNote } from '../db/database.js';

function getUserFromRequest(req: Request) {
	const token =
		(typeof req.headers['x-session-token'] === 'string' && req.headers['x-session-token']) ||
		(typeof req.query.token === 'string' && req.query.token);
	if (!token) return null;
	return getSessionByToken(token);
}

export function registerNotesRoutes(app: Express) {
	app.get('/api/notes', (req: Request, res: Response) => {
		const user = getUserFromRequest(req);
		if (!user) return res.status(401).json({ error: 'invalid_session' });
		const notes = getNotes(user.id);
		return res.status(200).json({ notes });
	});

	app.post('/api/notes', (req: Request, res: Response) => {
		const user = getUserFromRequest(req);
		if (!user) return res.status(401).json({ error: 'invalid_session' });
		const { title = 'New note', body = '', position = 0 } = req.body || {};
		const note = createNote(user.id, String(title), String(body), Number(position) || 0);
		return res.status(201).json({ note });
	});

	app.put('/api/notes/:id', (req: Request, res: Response) => {
		const user = getUserFromRequest(req);
		if (!user) return res.status(401).json({ error: 'invalid_session' });
		const id = Number(req.params.id);
		if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid_id' });
		const { title = '', body = '', position = 0 } = req.body || {};
		const ok = updateNote(user.id, id, String(title), String(body), Number(position) || 0);
		if (!ok) return res.status(404).json({ error: 'not_found' });
		return res.status(200).json({ ok: true });
	});

	app.delete('/api/notes/:id', (req: Request, res: Response) => {
		const user = getUserFromRequest(req);
		if (!user) return res.status(401).json({ error: 'invalid_session' });
		const id = Number(req.params.id);
		if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid_id' });
		const ok = deleteNote(user.id, id);
		if (!ok) return res.status(404).json({ error: 'not_found' });
		return res.status(200).json({ ok: true });
	});
}
