/* eslint-disable react-refresh/only-export-components */
import {createContext,useState,} from 'react';

export const AuthContext=createContext();

const AuthProvider=({children})=>{
    const [user,setUser]=useState(()=>{
        const data=localStorage.getItem('user');
        return data?JSON.parse(data):null;
    });

    const login=(userData)=>{
        localStorage.setItem('user',JSON.stringify(userData));

        setUser(userData);
    };

    const logout=()=>{
        localStorage.removeItem('user');
        setUser(null)
    };

    const updateAuthUser=(profile)=>{
        const nextUser={...user,user:{...user.user,...profile}};
        localStorage.setItem('user',JSON.stringify(nextUser));
        setUser(nextUser);
    };

    return(
        <AuthContext.Provider value={{user,login,logout,updateAuthUser}}>
            {children}
        </AuthContext.Provider>
    )
}

export default AuthProvider;
