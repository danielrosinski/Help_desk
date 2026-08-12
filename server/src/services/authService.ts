import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma.js'
import { AppError } from '../lib/errors.js'

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, include: { department: true } })
  if (!user?.active || !await bcrypt.compare(password, user.passwordHash)) throw new AppError(401, 'E-mail ou senha inválidos.')
  const token = jwt.sign({ id: user.id, role: user.role, departmentId: user.departmentId }, process.env.JWT_SECRET!, { expiresIn: '8h' })
  const { passwordHash: _, ...safeUser } = user
  return { token, user: safeUser }
}
