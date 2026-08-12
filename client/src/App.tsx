import{Navigate,Route,Routes}from'react-router-dom'
import{useAuth}from'./auth'
import{AppLayout,Loading}from'./components'
import{LoginPage}from'./pages/LoginPage'
import{DashboardPage}from'./pages/DashboardPage'
import{TicketsPage}from'./pages/TicketsPage'
import{NewTicketPage}from'./pages/NewTicketPage'
import{TicketDetailsPage}from'./pages/TicketDetailsPage'
import{NotificationsPage}from'./pages/NotificationsPage'
import{CategoriesPage,DepartmentsPage,ProfilePage,ReportsPage,SettingsPage,UsersPage}from'./pages/AdminPages'
function Protected(){const{user,loading}=useAuth();if(loading)return <Loading/>;return user?<AppLayout/>:<Navigate to="/login" replace/>}
function Admin({children}:{children:React.ReactNode}){const{user}=useAuth();return user?.role==='ADMIN'?children:<Navigate to="/" replace/>}
export function App(){return <Routes><Route path="/login" element={<LoginPage/>}/><Route element={<Protected/>}><Route index element={<DashboardPage/>}/><Route path="chamados" element={<TicketsPage/>}/><Route path="chamados/novo" element={<NewTicketPage/>}/><Route path="chamados/:id" element={<TicketDetailsPage/>}/><Route path="notificacoes" element={<NotificationsPage/>}/><Route path="perfil" element={<ProfilePage/>}/><Route path="usuarios" element={<Admin><UsersPage/></Admin>}/><Route path="setores" element={<Admin><DepartmentsPage/></Admin>}/><Route path="categorias" element={<Admin><CategoriesPage/></Admin>}/><Route path="relatorios" element={<Admin><ReportsPage/></Admin>}/><Route path="configuracoes" element={<Admin><SettingsPage/></Admin>}/></Route><Route path="*" element={<Navigate to="/"/>}/></Routes>}
