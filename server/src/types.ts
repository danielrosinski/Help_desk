import type { UserRole } from '@prisma/client'
import type { Request } from 'express'

export interface AuthUser { id: string; role: UserRole; departmentId: string | null }
export interface AuthRequest extends Request { user?: AuthUser }
