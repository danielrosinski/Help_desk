import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { TicketPriority, TicketStatus, UserRole } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authenticate, authorize } from '../middlewares/auth.js'
import { login } from '../services/authService.js'
import * as tickets from '../services/ticketService.js'
import type { AuthRequest } from '../types.js'
import { AppError } from '../lib/errors.js'

export const api = Router()
const wrap = (fn: Function) => (req:any,res:any,next:any) => Promise.resolve(fn(req,res,next)).catch(next)

api.post('/auth/login', wrap(async (req:any,res:any) => {
  const data=z.object({email:z.string().email('Informe um e-mail válido.'),password:z.string().min(6,'Informe a senha.')}).parse(req.body)
  res.json(await login(data.email,data.password))
}))
api.get('/auth/me',authenticate,wrap(async(req:AuthRequest,res:any)=>{
  const user=await prisma.user.findUnique({where:{id:req.user!.id},include:{department:true},omit:{passwordHash:true}})
  res.json(user)
}))

api.get('/tickets',authenticate,wrap(async(req:AuthRequest,res:any)=>res.json(await tickets.listTickets(req.user!,req.query as Record<string,string>))))
api.post('/tickets',authenticate,wrap(async(req:AuthRequest,res:any)=>{
  const data=z.object({title:z.string().min(3).max(150),description:z.string().min(10).max(5000),priority:z.nativeEnum(TicketPriority),categoryId:z.string(),departmentId:z.string()}).parse(req.body)
  res.status(201).json(await tickets.createTicket(req.user!,data))
}))
api.get('/tickets/:id',authenticate,wrap(async(req:AuthRequest,res:any)=>res.json(await tickets.getTicket(req.user!,String(req.params.id)))))
api.patch('/tickets/:id',authenticate,wrap(async(req:AuthRequest,res:any)=>{
  const data=z.object({status:z.nativeEnum(TicketStatus).optional(),priority:z.nativeEnum(TicketPriority).optional(),categoryId:z.string().optional()}).parse(req.body)
  res.json(await tickets.updateTicket(req.user!,String(req.params.id),data))
}))
api.post('/tickets/:id/comments',authenticate,wrap(async(req:AuthRequest,res:any)=>{
  const data=z.object({message:z.string().min(2).max(5000),internal:z.boolean().default(false)}).parse(req.body)
  res.status(201).json(await tickets.addComment(req.user!,String(req.params.id),data.message,data.internal))
}))
api.post('/tickets/:id/assign',authenticate,authorize(UserRole.AGENT,UserRole.ADMIN),wrap(async(req:AuthRequest,res:any)=>res.json(await tickets.assign(req.user!,String(req.params.id),req.body.agentId))))
api.post('/tickets/:id/transfer',authenticate,authorize(UserRole.AGENT,UserRole.ADMIN),wrap(async(req:AuthRequest,res:any)=>res.json(await tickets.assign(req.user!,String(req.params.id),z.object({agentId:z.string()}).parse(req.body).agentId))))
api.post('/tickets/:id/resolve',authenticate,authorize(UserRole.AGENT,UserRole.ADMIN),wrap(async(req:AuthRequest,res:any)=>res.json(await tickets.resolve(req.user!,String(req.params.id),z.object({resolution:z.string().min(5).max(2000)}).parse(req.body).resolution))))
api.post('/tickets/:id/reopen',authenticate,wrap(async(req:AuthRequest,res:any)=>res.json(await tickets.reopen(req.user!,String(req.params.id)))))

api.get('/departments',authenticate,wrap(async(_req:any,res:any)=>res.json(await prisma.department.findMany({include:{_count:{select:{users:true,categories:true}}},orderBy:{name:'asc'}}))))
api.post('/departments',authenticate,authorize(UserRole.ADMIN),wrap(async(req:any,res:any)=>res.status(201).json(await prisma.department.create({data:z.object({name:z.string().min(2),active:z.boolean().default(true)}).parse(req.body)}))))
api.patch('/departments/:id',authenticate,authorize(UserRole.ADMIN),wrap(async(req:any,res:any)=>res.json(await prisma.department.update({where:{id:req.params.id},data:z.object({name:z.string().min(2).optional(),active:z.boolean().optional()}).parse(req.body)}))))
api.get('/categories',authenticate,wrap(async(req:any,res:any)=>res.json(await prisma.category.findMany({where:req.query.departmentId?{departmentId:String(req.query.departmentId)}:{},include:{department:true},orderBy:{name:'asc'}}))))
api.post('/categories',authenticate,authorize(UserRole.ADMIN),wrap(async(req:any,res:any)=>res.status(201).json(await prisma.category.create({data:z.object({name:z.string().min(2),departmentId:z.string(),active:z.boolean().default(true)}).parse(req.body)}))))
api.patch('/categories/:id',authenticate,authorize(UserRole.ADMIN),wrap(async(req:any,res:any)=>res.json(await prisma.category.update({where:{id:req.params.id},data:z.object({name:z.string().min(2).optional(),departmentId:z.string().optional(),active:z.boolean().optional()}).parse(req.body)}))))

api.get('/users',authenticate,authorize(UserRole.ADMIN),wrap(async(_req:any,res:any)=>res.json(await prisma.user.findMany({omit:{passwordHash:true},include:{department:true},orderBy:{name:'asc'}}))))
api.get('/agents',authenticate,authorize(UserRole.AGENT,UserRole.ADMIN),wrap(async(req:AuthRequest,res:any)=>res.json(await prisma.user.findMany({where:{active:true,role:{in:[UserRole.AGENT,UserRole.ADMIN]},...(req.user!.role===UserRole.AGENT?{departmentId:req.user!.departmentId}:{})},select:{id:true,name:true,departmentId:true}}))))
api.post('/users',authenticate,authorize(UserRole.ADMIN),wrap(async(req:any,res:any)=>{
  const data=z.object({name:z.string().min(3),email:z.string().email(),password:z.string().min(8),role:z.nativeEnum(UserRole),departmentId:z.string().nullable().optional(),active:z.boolean().default(true)}).parse(req.body)
  if(await prisma.user.findUnique({where:{email:data.email.toLowerCase()}})) throw new AppError(409,'Este e-mail já está cadastrado.')
  const {password,...rest}=data; res.status(201).json(await prisma.user.create({data:{...rest,email:rest.email.toLowerCase(),passwordHash:await bcrypt.hash(password,12)},omit:{passwordHash:true}}))
}))
api.patch('/users/:id',authenticate,authorize(UserRole.ADMIN),wrap(async(req:any,res:any)=>{
  const data=z.object({name:z.string().min(3).optional(),email:z.string().email().optional(),role:z.nativeEnum(UserRole).optional(),departmentId:z.string().nullable().optional(),active:z.boolean().optional()}).parse(req.body)
  res.json(await prisma.user.update({where:{id:req.params.id},data,omit:{passwordHash:true}}))
}))

api.get('/notifications',authenticate,wrap(async(req:AuthRequest,res:any)=>res.json(await prisma.notification.findMany({where:{userId:req.user!.id},orderBy:{createdAt:'desc'},take:100}))))
api.patch('/notifications/read-all',authenticate,wrap(async(req:AuthRequest,res:any)=>{await prisma.notification.updateMany({where:{userId:req.user!.id,read:false},data:{read:true}});res.status(204).end()}))
api.patch('/notifications/:id/read',authenticate,wrap(async(req:AuthRequest,res:any)=>{await prisma.notification.updateMany({where:{id:String(req.params.id),userId:req.user!.id},data:{read:true}});res.status(204).end()}))

api.get('/reports/overview',authenticate,authorize(UserRole.ADMIN),wrap(async(_req:any,res:any)=>{
  const [total,open,resolved,byPriority,byDepartment,resolutionRows]=await Promise.all([prisma.ticket.count(),prisma.ticket.count({where:{status:{in:[TicketStatus.OPEN,TicketStatus.IN_PROGRESS,TicketStatus.WAITING_REQUESTER]}}}),prisma.ticket.count({where:{status:{in:[TicketStatus.RESOLVED,TicketStatus.CLOSED]}}}),prisma.ticket.groupBy({by:['priority'],_count:true}),prisma.ticket.groupBy({by:['departmentId'],_count:true}),prisma.ticket.findMany({where:{resolvedAt:{not:null}},select:{createdAt:true,resolvedAt:true,priority:true}})])
  const avgHours=resolutionRows.length?resolutionRows.reduce((s,t)=>s+(t.resolvedAt!.getTime()-t.createdAt.getTime())/3600000,0)/resolutionRows.length:0
  const withinSla=resolutionRows.length?resolutionRows.filter(t=>(t.resolvedAt!.getTime()-t.createdAt.getTime())/3600000<=({URGENT:2,HIGH:8,MEDIUM:24,LOW:72}[t.priority])).length/resolutionRows.length*100:0
  res.json({total,open,resolved,avgHours,withinSla,byPriority,byDepartment})
}))
