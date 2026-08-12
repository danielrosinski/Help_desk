import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'

export class AppError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) return res.status(400).json({ message: error.issues[0]?.message ?? 'Dados inválidos.' })
  if (error instanceof AppError) return res.status(error.status).json({ message: error.message })
  console.error(error)
  return res.status(500).json({ message: 'Não foi possível concluir a operação.' })
}
