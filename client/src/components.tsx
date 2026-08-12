import {Bell,ChevronRight,LayoutDashboard,LogOut,Menu,Plus,Settings,Ticket as TicketIcon,UserRound,Users,X,Building2,Tags,BarChart3} from 'lucide-react'
import {NavLink,Outlet,useNavigate} from 'react-router-dom'
import {useEffect,useState,type ReactNode} from 'react'
import {useAuth} from './auth'
import {api} from './lib/api'
import {dateTime,priorityLabels,statusLabels} from './lib/labels'
import type{Priority,Status,Ticket}from'./types'

export function StatusBadge({status}:{status:Status}){return <span className={`badge status-${status.toLowerCase()}`}>{statusLabels[status]}</span>}
export function PriorityBadge({priority}:{priority:Priority}){return <span className={`priority priority-${priority.toLowerCase()}`}><i/>{priorityLabels[priority]}</span>}
export function EmptyState({children}:{children:ReactNode}){return <div className="empty">{children}</div>}
export function Loading(){return <div className="loading">Carregando...</div>}

export function TicketTable({tickets}:{tickets:Ticket[]}){const navigate=useNavigate();if(!tickets.length)return <EmptyState>Nenhum chamado encontrado.</EmptyState>;return <div className="table-wrap"><table><thead><tr><th>Código</th><th>Assunto</th><th>Solicitante</th><th>Categoria</th><th>Prioridade</th><th>Status</th><th>Responsável</th><th>Atualizado em</th></tr></thead><tbody>{tickets.map(ticket=><tr key={ticket.id} onClick={()=>navigate(`/chamados/${ticket.id}`)} tabIndex={0}><td className="code">{ticket.code}</td><td>{ticket.title}</td><td>{ticket.requester.name}</td><td>{ticket.category.name}</td><td><PriorityBadge priority={ticket.priority}/></td><td><StatusBadge status={ticket.status}/></td><td>{ticket.assignedTo?.name??'Não atribuído'}</td><td>{dateTime(ticket.updatedAt)}</td></tr>)}</tbody></table></div>}

const menuByRole={EMPLOYEE:[['Visão geral','/',LayoutDashboard],['Meus chamados','/chamados',TicketIcon],['Abrir chamado','/chamados/novo',Plus],['Notificações','/notificacoes',Bell]],AGENT:[['Visão geral','/',LayoutDashboard],['Chamados','/chamados',TicketIcon],['Meus atendimentos','/chamados?mine=1',UserRound],['Não atribuídos','/chamados?unassigned=1',Users],['Notificações','/notificacoes',Bell]],ADMIN:[['Visão geral','/',LayoutDashboard],['Chamados','/chamados',TicketIcon],['Usuários','/usuarios',Users],['Setores','/setores',Building2],['Categorias','/categorias',Tags],['Relatórios','/relatorios',BarChart3],['Configurações','/configuracoes',Settings]]} as const

export function AppLayout(){const{user,logout}=useAuth();const[open,setOpen]=useState(false);const[unread,setUnread]=useState(0);useEffect(()=>{api.get('/notifications').then(r=>setUnread(r.data.filter((n:{read:boolean})=>!n.read).length)).catch(()=>{})},[]);if(!user)return null;return <div className="app-shell"><button className="mobile-menu" onClick={()=>setOpen(true)} aria-label="Abrir menu"><Menu/></button><aside className={open?'open':''}><div className="sidebar-head"><span className="product">Help Desk</span><button onClick={()=>setOpen(false)} aria-label="Fechar menu"><X/></button></div><nav>{menuByRole[user.role].map(([label,to,Icon])=><NavLink key={to} to={to} onClick={()=>setOpen(false)}><Icon/><span>{label}</span>{label==='Notificações'&&unread>0?<b>{unread}</b>:null}</NavLink>)}</nav><div className="sidebar-bottom"><NavLink to="/perfil"><UserRound/><span>Minha conta</span></NavLink><button onClick={logout}><LogOut/><span>Sair</span></button><div className="user-summary"><strong>{user.name}</strong><small>{user.department?.name??'Administração'}</small></div></div></aside>{open&&<button className="backdrop" onClick={()=>setOpen(false)}/>}<main><Outlet/></main></div>}

export function PageHeader({title,subtitle,action}:{title:string;subtitle?:string;action?:ReactNode}){return <header className="page-header"><div><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>{action}</header>}
export function FieldError({message}:{message?:string}){return message?<small className="field-error">{message}</small>:null}
export function Breadcrumb({items}:{items:{label:string;to?:string}[]}){return <div className="breadcrumb">{items.map((i,n)=><span key={i.label}>{i.label}{n<items.length-1&&<ChevronRight/>}</span>)}</div>}
