import type { Express, Request, Response } from 'express';
import { createSession, createUser, getFirstUser, getSessionByToken, hasUsers, revokeSession, verifyUser } from '../db/database.js';

export function registerUserRoutes(app: Express) {
	// Get user status
	app.get('/api/users/status', (_req: Request, res: Response) => {
		const exists = hasUsers();
		const user = exists ? getFirstUser() : null;

		return res.status(200).json({
			hasUser: exists,
			user: user
				? {
						id: user.id,
						firstName: user.first_name,
						lastName: user.last_name,
						name: user.name,
						isAdmin: !!user.is_admin,
						userCode: user.user_code,
				  }
				: null,
		});
	});

	// Create a new user (only if none exist)
	app.post('/api/users', (req: Request, res: Response) => {
		const { firstName, lastName, pin } = req.body || {};

		if (!firstName || !lastName || !pin) {
			return res
				.status(400)
				.json({ error: 'invalid_user', message: 'firstName, lastName, and a 4-digit pin are required' });
		}

		if (hasUsers()) {
			return res.status(409).json({ error: 'user_exists', message: 'A user already exists' });
		}

		try {
			const user = createUser(firstName, lastName, pin, true);
			return res.status(201).json({
				user: {
					id: user.id,
					firstName: user.first_name,
					lastName: user.last_name,
					name: user.name,
					isAdmin: !!user.is_admin,
					userCode: user.user_code,
				},
			});
		} catch (err) {
			console.error('Error creating user:', err);
			return res.status(500).json({ error: 'internal_error' });
		}
	});

	// User login
	app.post('/api/users/login', (req: Request, res: Response) => {
		const { userCode, pin, rememberMe } = req.body || {};
		if (!userCode || !pin) {
			return res.status(400).json({ error: 'missing_credentials', message: 'userCode and pin are required' });
		}

		const user = verifyUser(String(userCode), String(pin));
		if (!user) {
			return res.status(401).json({ error: 'invalid_credentials', message: 'Invalid ID or PIN' });
		}

		const sessionToken = rememberMe ? createSession(user.id) : undefined;

		return res.status(200).json({
			user: {
				id: user.id,
				firstName: user.first_name,
				lastName: user.last_name,
				name: user.name,
				isAdmin: !!user.is_admin,
				userCode: user.user_code,
			},
			sessionToken,
		});
	});

	// Session rehydration
	app.get('/api/users/session', (req: Request, res: Response) => {
		const token =
			(typeof req.headers['x-session-token'] === 'string' && req.headers['x-session-token']) ||
			(typeof req.query.token === 'string' && req.query.token);
		if (!token) {
			return res.status(400).json({ error: 'missing_token', message: 'Session token is required' });
		}
		const user = getSessionByToken(token);
		if (!user) {
			return res.status(401).json({ error: 'invalid_session', message: 'Session not found or expired' });
		}
		return res.status(200).json({
			user: {
				id: user.id,
				firstName: user.first_name,
				lastName: user.last_name,
				name: user.name,
				isAdmin: !!user.is_admin,
				userCode: user.user_code,
			},
		});
	});

	// Logout current session
	app.post('/api/users/logout', (req: Request, res: Response) => {
		const token =
			(typeof req.headers['x-session-token'] === 'string' && req.headers['x-session-token']) ||
			(typeof req.body?.sessionToken === 'string' && req.body.sessionToken);
		if (token) {
			revokeSession(token);
		}
		return res.status(200).json({ ok: true });
	});
}
