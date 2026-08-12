import 'dotenv/config'
import { app } from './app.js'

if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) throw new Error('DATABASE_URL e JWT_SECRET são obrigatórios.')
app.listen(Number(process.env.PORT ?? 3333),()=>console.log(`API disponível na porta ${process.env.PORT ?? 3333}`))
