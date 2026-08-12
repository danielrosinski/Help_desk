import { PrismaClient, TicketPriority, TicketStatus, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'
const prisma=new PrismaClient()

async function main(){
  const names=['Tecnologia da Informação','Financeiro','Recursos Humanos','Administrativo','Manutenção']
  const departments=Object.fromEntries(await Promise.all(names.map(async name=>{const item=await prisma.department.upsert({where:{name},update:{},create:{name}});return[name,item]})))
  const categoryMap:Record<string,string[]>={
    'Tecnologia da Informação':['Computador','Internet','Sistema','Impressora','Acesso','E-mail'],
    'Financeiro':['Reembolso','Pagamento','Nota fiscal'],
    'Recursos Humanos':['Benefícios','Documentação','Folha de pagamento'],
    'Administrativo':['Compras','Materiais','Acesso à pasta'],
    'Manutenção':['Elétrica','Hidráulica','Mobiliário']
  }
  const categories:any[]=[]
  for(const [departmentName,items] of Object.entries(categoryMap)) for(const name of items) categories.push(await prisma.category.upsert({where:{name_departmentId:{name,departmentId:departments[departmentName].id}},update:{},create:{name,departmentId:departments[departmentName].id}}))
  const passwordHash=await bcrypt.hash('Senha@123',12)
  const users=[
    {name:'Daniel Rosinski',email:'daniel@empresa.com',role:UserRole.ADMIN,departmentId:null},
    {name:'João Victor',email:'joao@empresa.com',role:UserRole.EMPLOYEE,departmentId:departments['Administrativo'].id},
    {name:'Alessandra',email:'alessandra@empresa.com',role:UserRole.AGENT,departmentId:departments['Financeiro'].id},
    {name:'Victor',email:'victor@empresa.com',role:UserRole.AGENT,departmentId:departments['Tecnologia da Informação'].id}
  ]
  const saved:any={}
  for(const user of users) saved[user.email]=await prisma.user.upsert({where:{email:user.email},update:{},create:{...user,passwordHash}})
  if(await prisma.ticket.count()===0){
    const samples=[
      ['CH-0001','Falha ao acessar sistema interno','Desde esta manhã não consigo acessar o sistema interno. A página retorna erro depois do login.','Sistema','Tecnologia da Informação',TicketPriority.HIGH,TicketStatus.IN_PROGRESS,saved['victor@empresa.com'].id],
      ['CH-0002','Impressora do financeiro não imprime','A impressora do setor não envia os documentos para impressão.','Impressora','Tecnologia da Informação',TicketPriority.MEDIUM,TicketStatus.OPEN,null],
      ['CH-0003','Solicitação de acesso à pasta compartilhada','Preciso de acesso à pasta compartilhada de contratos.','Acesso à pasta','Administrativo',TicketPriority.LOW,TicketStatus.WAITING_REQUESTER,null],
      ['CH-0004','Erro no lançamento de reembolso','O sistema informa valor inválido ao lançar o reembolso.','Reembolso','Financeiro',TicketPriority.HIGH,TicketStatus.RESOLVED,saved['alessandra@empresa.com'].id],
      ['CH-0005','Computador reiniciando durante o uso','O computador reinicia algumas vezes durante o expediente.','Computador','Tecnologia da Informação',TicketPriority.URGENT,TicketStatus.OPEN,null]
    ] as const
    for(const [code,title,description,categoryName,departmentName,priority,status,assignedToId] of samples){
      const category=categories.find(c=>c.name===categoryName && c.departmentId===departments[departmentName].id)
      const ticket=await prisma.ticket.create({data:{code,title,description,categoryId:category.id,departmentId:departments[departmentName].id,priority,status,assignedToId,requesterId:saved['joao@empresa.com'].id,resolvedAt:status===TicketStatus.RESOLVED?new Date():null}})
      await prisma.ticketHistory.create({data:{ticketId:ticket.id,userId:saved['joao@empresa.com'].id,action:'TICKET_CREATED'}})
      if(code==='CH-0001') await prisma.ticketComment.createMany({data:[{ticketId:ticket.id,authorId:saved['joao@empresa.com'].id,message:description},{ticketId:ticket.id,authorId:saved['victor@empresa.com'].id,message:'Verifiquei seu usuário. O acesso estava bloqueado após algumas tentativas incorretas. Fiz a liberação. Tente novamente.'}]})
    }
  }
}
main().finally(()=>prisma.$disconnect())
