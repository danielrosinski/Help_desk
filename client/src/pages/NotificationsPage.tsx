import{useEffect,useState}from'react'
import{useNavigate}from'react-router-dom'
import{EmptyState,PageHeader}from'../components'
import{api}from'../lib/api'
import{dateTime}from'../lib/labels'
import type{Notification}from'../types'
export function NotificationsPage(){const[items,setItems]=useState<Notification[]>([]);const navigate=useNavigate();const load=()=>api.get('/notifications').then(r=>setItems(r.data));useEffect(()=>{load()},[]);async function read(item:Notification){if(!item.read)await api.patch(`/notifications/${item.id}/read`);if(item.ticketId)navigate(`/chamados/${item.ticketId}`);else load()}return <div className="page narrow"><PageHeader title="Notificações" action={<button className="button secondary" onClick={()=>api.patch('/notifications/read-all').then(load)}>Marcar todas como lidas</button>}/><section className="notification-list">{items.length?items.map(item=><button key={item.id} className={item.read?'read':''} onClick={()=>read(item)}><i/><span><strong>{item.message}</strong><time>{dateTime(item.createdAt)}</time></span></button>):<EmptyState>Nenhuma notificação encontrada.</EmptyState>}</section></div>}
