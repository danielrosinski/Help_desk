import { TicketPriority, TicketStatus, UserRole } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { AppError } from '../lib/errors.js'
import type { AuthUser } from '../types.js'

const include = { requester: { select: { id:true,name:true,email:true } }, assignedTo: { select:{ id:true,name:true } }, category:true, department:true } as const
const slaHours: Record<TicketPriority, number> = { URGENT:2, HIGH:8, MEDIUM:24, LOW:72 }

export function slaFor(createdAt: Date, priority: TicketPriority) {
  const deadline = new Date(createdAt.getTime() + slaHours[priority] * 3600000)
  const remaining = deadline.getTime() - Date.now()
  return { deadline, state: remaining < 0 ? 'OVERDUE' : remaining < 3600000 ? 'NEAR' : 'ON_TIME' }
}

function ticketScope(user: AuthUser) {
  if (user.role === UserRole.EMPLOYEE) return { requesterId: user.id }
  if (user.role === UserRole.AGENT) return { departmentId: user.departmentId ?? '__none__' }
  return {}
}

export async function listTickets(user: AuthUser, filters: Record<string, string | undefined>) {
  const where = { ...ticketScope(user), ...(filters.status ? { status: filters.status as TicketStatus } : {}), ...(filters.priority ? { priority: filters.priority as TicketPriority } : {}), ...(filters.search ? { OR:[{code:{contains:filters.search,mode:'insensitive' as const}},{title:{contains:filters.search,mode:'insensitive' as const}},{requester:{name:{contains:filters.search,mode:'insensitive' as const}}}] } : {}) }
  const items = await prisma.ticket.findMany({ where, include, orderBy:{ updatedAt:'desc' }, take:100 })
  return items.map(ticket => ({ ...ticket, sla: slaFor(ticket.createdAt, ticket.priority) }))
}

export async function getTicket(user: AuthUser, id: string) {
  const ticket = await prisma.ticket.findFirst({ where:{ id, ...ticketScope(user) }, include:{ ...include, comments:{ include:{author:{select:{id:true,name:true,role:true}},attachments:true},orderBy:{createdAt:'asc'} }, history:{include:{user:{select:{name:true}}},orderBy:{createdAt:'desc'}}, attachments:true } })
  if (!ticket) throw new AppError(404, 'Chamado não encontrado.')
  if (user.role === UserRole.EMPLOYEE) ticket.comments = ticket.comments.filter(comment => !comment.internal)
  return { ...ticket, sla:slaFor(ticket.createdAt,ticket.priority) }
}

export async function createTicket(user: AuthUser, data: {title:string;description:string;priority:TicketPriority;categoryId:string;departmentId:string}) {
  const category = await prisma.category.findFirst({ where:{id:data.categoryId,departmentId:data.departmentId,active:true} })
  if (!category) throw new AppError(400, 'Categoria inválida para o setor selecionado.')
  const last = await prisma.ticket.findFirst({orderBy:{sequence:'desc'},select:{sequence:true}})
  const code = `CH-${String((last?.sequence ?? 0)+1).padStart(4,'0')}`
  return prisma.$transaction(async tx => {
    const ticket = await tx.ticket.create({data:{...data,code,requesterId:user.id},include})
    await tx.ticketHistory.create({data:{ticketId:ticket.id,userId:user.id,action:'TICKET_CREATED'}})
    const agents = await tx.user.findMany({where:{active:true,departmentId:data.departmentId,role:{in:[UserRole.AGENT,UserRole.ADMIN]}},select:{id:true}})
    if (agents.length) await tx.notification.createMany({data:agents.map(agent=>({userId:agent.id,type:'TICKET_CREATED',message:`Novo chamado ${code}: ${data.title}`,ticketId:ticket.id}))})
    return ticket
  })
}

export async function addComment(user: AuthUser, id:string, message:string, internal:boolean) {
  const ticket = await getTicket(user,id)
  if (internal && user.role === UserRole.EMPLOYEE) throw new AppError(403,'Notas internas são restritas ao suporte.')
  const comment = await prisma.ticketComment.create({data:{ticketId:id,authorId:user.id,message,internal},include:{author:{select:{id:true,name:true,role:true}}}})
  const recipients = [ticket.requesterId,ticket.assignedToId].filter((value): value is string => Boolean(value && value !== user.id))
  if (recipients.length) await prisma.notification.createMany({data:recipients.map(userId=>({userId,type:'COMMENT',message:`Nova resposta no chamado ${ticket.code}.`,ticketId:id}))})
  return comment
}

export async function updateTicket(user: AuthUser,id:string,data:{status?:TicketStatus;priority?:TicketPriority;categoryId?:string}) {
  if (user.role === UserRole.EMPLOYEE) throw new AppError(403,'Você não possui permissão para alterar o chamado.')
  const current = await getTicket(user,id)
  const updated = await prisma.ticket.update({where:{id},data,include})
  for (const key of ['status','priority','categoryId'] as const) if (data[key] && data[key] !== current[key]) await prisma.ticketHistory.create({data:{ticketId:id,userId:user.id,action:`${key.toUpperCase()}_CHANGED`,oldValue:String(current[key]),newValue:String(data[key])}})
  if (data.status && data.status !== current.status) await prisma.notification.create({data:{userId:current.requesterId,type:'STATUS_CHANGED',message:`Status do chamado ${current.code} atualizado.`,ticketId:id}})
  return updated
}

export async function assign(user:AuthUser,id:string,agentId?:string) {
  if (user.role === UserRole.EMPLOYEE) throw new AppError(403,'Você não possui permissão para atribuir chamados.')
  const ticket = await getTicket(user,id); const targetId = agentId ?? user.id
  const agent = await prisma.user.findFirst({where:{id:targetId,active:true,role:{in:[UserRole.AGENT,UserRole.ADMIN]}}})
  if (!agent) throw new AppError(400,'Responsável inválido.')
  await prisma.ticket.update({where:{id},data:{assignedToId:targetId,status:ticket.status===TicketStatus.OPEN?TicketStatus.IN_PROGRESS:ticket.status}})
  await prisma.ticketHistory.create({data:{ticketId:id,userId:user.id,action:ticket.assignedToId?'TICKET_TRANSFERRED':'TICKET_ASSIGNED',oldValue:ticket.assignedTo?.name,newValue:agent.name}})
  await prisma.notification.create({data:{userId:targetId,type:'ASSIGNED',message:`O chamado ${ticket.code} foi atribuído a você.`,ticketId:id}})
  return getTicket(user,id)
}

export async function resolve(user:AuthUser,id:string,resolution:string) {
  if (user.role === UserRole.EMPLOYEE) throw new AppError(403,'Você não possui permissão para resolver chamados.')
  const ticket=await getTicket(user,id); const now=new Date()
  await prisma.ticket.update({where:{id},data:{status:TicketStatus.RESOLVED,resolution,resolvedAt:now}})
  await prisma.ticketHistory.create({data:{ticketId:id,userId:user.id,action:'TICKET_RESOLVED',newValue:resolution}})
  await prisma.notification.create({data:{userId:ticket.requesterId,type:'RESOLVED',message:`O chamado ${ticket.code} foi resolvido.`,ticketId:id}})
  return getTicket(user,id)
}

export async function reopen(user:AuthUser,id:string) {
  const ticket=await getTicket(user,id)
  if (ticket.status!==TicketStatus.RESOLVED || !ticket.resolvedAt || Date.now()-ticket.resolvedAt.getTime()>7*86400000) throw new AppError(400,'Este chamado não pode ser reaberto.')
  await prisma.ticket.update({where:{id},data:{status:ticket.assignedToId?TicketStatus.IN_PROGRESS:TicketStatus.OPEN,resolvedAt:null,resolution:null}})
  await prisma.ticketHistory.create({data:{ticketId:id,userId:user.id,action:'TICKET_REOPENED'}})
  if(ticket.assignedToId) await prisma.notification.create({data:{userId:ticket.assignedToId,type:'REOPENED',message:`O chamado ${ticket.code} foi reaberto.`,ticketId:id}})
  return getTicket(user,id)
}
