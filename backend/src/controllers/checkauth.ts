import { Response } from "express";

export default async function checkAuth(req : any, res : Response) {
    if(!req.user){
        res.status(401).json({message: "unauthorized"})
        return
    }
    res.status(200).json({message: "authorized", user: req.user})
}