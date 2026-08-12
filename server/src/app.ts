import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { api } from './routes/index.js'
import { errorHandler } from './lib/errors.js'

export const app = express()

app.use(cors({ origin: process.env.CLIENT_URL?.split(',') ?? true }))
app.use(express.json({ limit: '1mb' }))
app.get('/health', (_req, res) => res.json({ status: 'ok' }))
app.use('/api', api)
app.use((_req, res) => res.status(404).json({ message: 'Rota não encontrada.' }))
app.use(errorHandler)

export default app
