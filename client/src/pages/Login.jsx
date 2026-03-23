import React, { useState } from 'react'
import {useNavigate}  from 'react-router'
import axios from "axios"

function Login() {
    const [inputs,setInputs] = useState({email:null,password:null})
    const navigate = useNavigate()
    console.log(inputs)
    const handleSubmit = async (e) => {
        e.preventDefault()
        try{
            const response = await axios.post(" http://localhost:8000/api/auth/login",{
                email : inputs.email,
                password : inputs.password
            })
            if(response.data){
                localStorage.getItem("userInfo",JSON.stringify(response.data))

            }

        }catch{

        }


    }
  return (
    <>
    <div>Login</div>
    <form onSubmit={handleSubmit}>
        <label htmlFor="Email">Email</label>
        <input onChange={(e)=>setInputs({...inputs,email:e.target.value})} type="email" id='Email'/>
        <label htmlFor="password">Password</label>
        <input onChange={(e)=>setInputs({...inputs,password:e.target.value})} type="password" id='password'/>
        <button type='submit'>Login</button>
    </form>
    </>
  )
}

export default Login

