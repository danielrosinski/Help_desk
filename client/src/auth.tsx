import { createContext,useContext,useEffect,useState,type ReactNode } from 'react'
import { api } from './lib/api'
import type { User } from './types'
interface AuthValue{user:User|null;loading:boolean;login:(email:string,password:string)=>Promise<void>;logout:()=>void;refresh:()=>Promise<void>}
const AuthContext=createContext<AuthValue|null>(null)
export function AuthProvider({children}:{children:ReactNode}){const[user,setUser]=useState<User|null>(null);const[loading,setLoading]=useState(true);async function refresh(){try{setUser((await api.get('/auth/me')).data)}catch{localStorage.removeItem('helpdesk_token');setUser(null)}finally{setLoading(false)}}useEffect(()=>{refresh()},[]);async function login(email:string,password:string){const{data}=await api.post('/auth/login',{email,password});localStorage.setItem('helpdesk_token',data.token);setUser(data.user)}function logout(){localStorage.removeItem('helpdesk_token');setUser(null)}return <AuthContext.Provider value={{user,loading,login,logout,refresh}}>{children}</AuthContext.Provider>}
export const useAuth=()=>{const value=useContext(AuthContext);if(!value)throw new Error('AuthProvider ausente');return value}
