import type { NextFunction, Response } from 'express'
import jwt from 'jsonwebtoken'
import type { UserRole } from '@prisma/client'
import type { AuthRequest, AuthUser } from '../types.js'
import { AppError } from '../lib/errors.js'

export function authenticate(req: AuthRequest, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer /, '')
  if (!token) return next(new AppError(401, 'Autenticação necessária.'))
  try { req.user = jwt.verify(token, process.env.JWT_SECRET!) as AuthUser; next() }
  catch { next(new AppError(401, 'Sessão inválida ou expirada.')) }
}

export const authorize = (...roles: UserRole[]) => (req: AuthRequest, _res: Response, next: NextFunction) => {
  if (!req.user || !roles.includes(req.user.role)) return next(new AppError(403, 'Você não possui permissão para acessar esta página.'))
  next()
}
