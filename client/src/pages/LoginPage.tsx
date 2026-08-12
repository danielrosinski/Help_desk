import {zodResolver}from'@hookform/resolvers/zod'
import axios from'axios'
import{useState}from'react'
import{useForm}from'react-hook-form'
import{Navigate}from'react-router-dom'
import{z}from'zod'
import{useAuth}from'../auth'
import{FieldError}from'../components'
const schema=z.object({email:z.string().email('Informe um e-mail válido.'),password:z.string().min(6,'Informe sua senha.')})
type Form=z.infer<typeof schema>
export function LoginPage(){const{user,login}=useAuth();const[error,setError]=useState('');const{register,handleSubmit,formState:{errors,isSubmitting}}=useForm<Form>({resolver:zodResolver(schema),defaultValues:{email:'daniel@empresa.com',password:'Senha@123'}});if(user)return <Navigate to="/" replace/>;async function submit(data:Form){try{setError('');await login(data.email,data.password)}catch(e){setError(axios.isAxiosError(e)?e.response?.data?.message:'Não foi possível entrar.') }}return <div className="login-page"><div className="login-panel"><div className="login-brand">Help Desk</div><form onSubmit={handleSubmit(submit)}><h1>Acesse sua conta</h1>{error&&<div className="alert error">{error}</div>}<label>E-mail<input type="email" autoComplete="email" {...register('email')}/><FieldError message={errors.email?.message}/></label><label>Senha<input type="password" autoComplete="current-password" {...register('password')}/><FieldError message={errors.password?.message}/></label><button className="button primary" disabled={isSubmitting}>{isSubmitting?'Entrando...':'Entrar'}</button></form><p className="login-help">Em caso de dificuldade de acesso, entre em contato com o setor de Tecnologia da Informação.</p></div><div className="login-aside"><div><strong>Atendimento interno</strong><p>Acesso restrito aos funcionários da empresa.</p></div><small>Ambiente corporativo</small></div></div>}
