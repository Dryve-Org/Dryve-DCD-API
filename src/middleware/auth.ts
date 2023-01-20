import User, { UserI } from "../Models/user.model"
import jwt, { JwtPayload, TokenExpiredError } from 'jsonwebtoken'
import { NextFunction, Request, Response } from "express"
import { Types, Document } from "mongoose"
import CleanerProfile, { CleanerProfileI, CleanerProT } from "../Models/cleanerProfile.model"
import Manager, { ManagerI } from "../Models/manager.models"
import Admin from "../Models/admin.modes"
import Driver, { DriverDocT, DriverI, DriverMethodsI } from "../Models/driver.model"
import AptMan, { AptManDocT, AptManI } from "../Models/aptMan.model"

interface errorI { 
    statusCode: number
    message: string 
}

export type UserDocT = Document<unknown, any, UserI> & UserI & {
    _id: Types.ObjectId;
}

export interface authBodyI {
    _id: Types.ObjectId
    token: string
    user: UserDocT
}



/**
 * This function takes a managerId as a parameter, and returns a boolean value based on whether or not
 * the managerId is an admin.
 * @param {String | Types.ObjectId} managerId - The id of the manager
 * @returns A boolean value.
*/
const isAdmin = async (managerId: String | Types.ObjectId) => {
    const admin = await Admin.findOne({ managerId })
    return admin ? true : false
} 

/**
 * User Auth middleware
*/
export const auth: any = async (req: Request<{}, {}, authBodyI>, res: Response, next: NextFunction) =>{
    try{
        const authFromHeader = req.header('Authorization')
        if(!authFromHeader) throw "missing headers"

        const token = authFromHeader.replace('Bearer ', '')
        if(!process.env.JWT) throw "server error: token"
        const decoded: any = jwt.verify(token, process.env.JWT)
        const user = await User.findOne({ _id: decoded._id, token: token })

        if(!user){
            throw new Error()
        }

        req.body._id = user.id
        req.body.token = token
        req.body.user = user

        next()
    } catch (e) {
        console.log(e)
        res.status(401).send({error: "Please authenticate perfectly"})
    }
}

export interface CleanerProAuthI extends authBodyI {
    cleanerPro: CleanerProT
    ownerOf: Types.ObjectId[]
    attachedCleaners: Types.ObjectId[]
}

/**
 * Cleaner Profile Middleware
*/
export const cleanerProAuth = async (req: Request, res: Response, next: NextFunction) => {
    try{
        const authFromHeader = req.header('Authorization')
        if(!authFromHeader) throw "missing headers"

        const token = authFromHeader.replace('Bearer ', '')
        if(!process.env.JWT) throw {
            statusCode: 501,
            message: "server error: no token"
        }
        const decoded: any = jwt.verify(token, process.env.JWT, (err, decoded) => {
            if(err) {
                return err.name
            }
            return decoded
        })

        if(decoded === 'TokenExpiredError') throw {
            statusCode: 401,
            message: "token expired"
        }

        const user = await User.findOne({ _id: decoded._id, token: token })

        if(!user){
            throw {
                statusCode: 401,
                message: "unauthorized: could not authorize user"
            }
        }

        const cleanerPro = await CleanerProfile.findOne({ user: user.id })

        if(!cleanerPro) throw {
            statusCode: 401,
            message: "invalid access"
        }

        req.body.user = user
        req.body._id = user.id
        req.body.cleanerPro = cleanerPro
        req.body.ownerOf = cleanerPro.ownerOf ? cleanerPro.ownerOf : []
        req.body.attachedCleaners = cleanerPro.attachedCleaners
        
        next()
    } catch (e: any) {
        res.status(e.statusCode).send(e.message)
    }
}

export interface cleanerProManagerAuthI extends authBodyI {
    cleanerPro: CleanerProfileI
    manager: ManagerI
    isManager: boolean
    isCleanerPro: boolean
    isAdmin: boolean
    highestAuthority: 'cleanerPro' | 'manager' |'admin'
}

/**
 * Should be authenticating both cleaner profiles and managers.
 * This probably should not exist
*/
export const cleanerProManagerAuth: any = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authFromHeader = req.header('Authorization')
        if(!authFromHeader) throw "missing headers"

        const token = authFromHeader.replace('Bearer ', '')
        if(!process.env.JWT) throw {
            statusCode: 501,
            message: "server error: no token"
        }
        const decoded: any = jwt.verify(token, process.env.JWT, (err, decoded) => {
            if(err) {
                return err.name
            }
            return decoded
        })

        if(decoded === 'TokenExpiredError') throw {
            statusCode: 400,
            message: "token expired"
        }

        const user = await User.findOne({ _id: decoded._id, token: token })

        if(!user){
            throw new Error()
        }

        const cleanerPro = await CleanerProfile.find({ user: user.id })
        const manager = await Manager.findOne({ user: user.id })

        if(!cleanerPro && !manager) throw {
            statusCode: 401,
            message: "bad data: invalid access"
        }
        
        req.body._id = user.id
        req.body.user = user
        req.body.token = token
        req.body.cleanerPro = cleanerPro
        req.body.manager = manager ? manager : {}
        req.body.isManager = manager ? true : false
        req.body.isAdmin = false
        req.body.highestAuthority = req.body.isManager ? 'manager' : 'cleanerPro' 
        if(manager) {
            req.body.isAdmin = await isAdmin(manager._id) ? true : false
            req.body.highestAuthority = req.body.isAdmin ? 'admin' : req.body.highestAuthority
        }

        req.body.isCleanerPro = cleanerPro && !manager && !req.body.isAdmin ? true : false

        next()
    } catch (e: any) {
        res.status(e.statusCode).send(e.message)
    }
}

type ManagerDocT = Document<unknown, any, ManagerI> & ManagerI & {
    _id: Types.ObjectId;
}

export interface ManagerAuthI extends authBodyI {
    manager: ManagerDocT
    isManager: boolean
    isAdmin: boolean
}

/** 
 * Authenticating Managers Middleware
*/   
export const managerAuth: any = async (req: Request, res: Response, next: NextFunction) => {
    try{
        const authFromHeader = req.header('Authorization')
        if(!authFromHeader) throw "missing headers"

        const token = authFromHeader.replace('Bearer ', '')
        if(!process.env.JWT) throw {
            statusCode: 501,
            message: "server error: no token"
        }
        const decoded: any = jwt.verify(token, process.env.JWT, (err, decoded) => {
            if(err) {
                return err.name
            }
            return decoded
        })

        if(decoded === 'TokenExpiredError') throw {
            statusCode: 403,
            message: "token expired"
        }

        const user = await User.findOne({ _id: decoded._id, token: token })
        if(!user) throw {
            statusCode: 400,
            message: "bad data: could not authenticate user"
        }

        const manager = await Manager.findOne({ user: user.id })
        if(!manager) throw {
            statusCode: 401,
            message: "bad data: invalid access"
        }

        const admin = await Admin.findOne({ id: req.body._id })
        const isAdmin = admin ? true : false

        req.body._id = user.id
        req.body.user = user
        req.body.token = token
        req.body.manager = manager
        req.body.isManager = manager ? true : false 
        req.body.isAdmin = isAdmin

        next()
    } catch (e: any) {
        res.send(e)
    }
}

export interface aptManAuthI {
    aptMan: AptManDocT
    _id: AptManI['_id']
    token: string
    isAptMan: boolean
}

export const aptManAuth: any = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authFromHeader = req.header('Authorization')
        if(!authFromHeader) throw "missing headers"

        const token = authFromHeader.replace('Bearer ', '')
        if(!process.env.JWT) throw {
            statusCode: 501,
            message: "server error: no token"
        }

        const decoded: any = jwt.verify(token, process.env.JWT, (err, decoded) => {
            if(err) {
                return err.name
            }
            return decoded
        })

        if(decoded === 'TokenExpiredError') throw {
            statusCode: 403,
            message: "token expired"
        }

        const aptMan = await AptMan.findOne({ _id: decoded._id, token: token })
        if(!aptMan) throw {
            statusCode: 401,
            message: "bad data: invalid access"
        }

        req.body._id = aptMan.id
        req.body.aptMan = aptMan
        req.body.token = token
        req.body.isAptMan = true

        next()
    } catch(e) {
        res.send(e)
    }
}



export interface DriverAuthI extends authBodyI {
    driver: DriverDocT & DriverMethodsI
    isAuthorized: boolean //is authorized to drive
    isDriver: boolean //edit: might delete later
    user: UserDocT
}

/**
 * Driver Authentication Middleware
*/
export const driverAuth: any = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authFromHeader = req.header('Authorization')
        if(!authFromHeader) throw {
            statusCode: 403,
            message: "missing headers"
        }

        const token = authFromHeader.replace('Bearer ', '')
        if(!process.env.JWT) throw {
            statusCode: 501,
            message: "server error: no token"
        }

        const decoded: any = jwt.verify(token, process.env.JWT, (err, decoded) => {
            if(err) {
                return err.name
            }
            return decoded
        })

        if(decoded === 'TokenExpiredError') throw {
            statusCode: 400,
            message: "token expired"
        }
        
        if (!decoded) throw {
            statusCode: 500,
            message: "decode"
        }
        
        const user = await User.findOne({ _id: decoded._id, token: token })

        if(!user) throw {
            statusCode: 400,
            message: "user not found"
        }

        const driver = await Driver.findOne({ user: user._id })
        if(!driver) throw {
            statusCode: 400,
            message: "user is not a driver"
        }

        req.body.driver = driver
        req.body.user = user
        req.body.isDriver = true
        req.body.isAuthorize = driver.passedBackgroundCheck ? true : false

        next()
    } catch(e: any) {
        res.status(e.statusCode).send(e.message)
    }
}