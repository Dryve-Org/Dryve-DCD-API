import { Router, Request, Response } from 'express'
import { managerAuth, ManagerAuthI } from '../../middleware/auth'
import { err } from '../../constants/general'
import Manager from '../../Models/manager.models'
import { ManagerPopulate } from './constants'
import User, { UserDocT } from '../../Models/user.model'
import { isOfAge, now } from '../../constants/time'
import Master from '../../Models/master'

const ManagerR = Router()

/**
 * Get all managers
 */
ManagerR.get(
'/all',
managerAuth,
async (req: Request<{}, {}, ManagerAuthI>, res: Response) => {
    try {
        const { manager, isAdmin } = req.body
        if(!isAdmin) {
            throw err(401, 'unauthorized')
        }

        const managers = await Manager.find({})
            .populate(ManagerPopulate)

        if(!managers) {
            throw err(500, 'no managers found')
        }

        res.status(200).send(managers)
    } catch(e) {
        res.status(400).send(e)
    }
})

/**
 * Get a manager by id
 */
ManagerR.get(
'/:managerId',
managerAuth,
async (req: Request<{managerId: string}, {}, ManagerAuthI>, res: Response) => {
    try {
        const { manager, isAdmin } = req.body
        const { managerId } = req.params
        if(!isAdmin) {
            throw err(401, 'unauthorized')
        }

        const managers = await Manager.findById(managerId)
            .populate(ManagerPopulate)
            
        if(!managers) {
            throw err(500, 'no managers found')
        }

        res.status(200).send(managers)
    } catch(e) {
        res.status(400).send(e)
    }
})

interface CreateManagerI extends ManagerAuthI {
    firstName: string
    lastName: string
    email: string
    phoneNumber: string
    password: string
    dob: number
    masters: string[]
}

/**
 * Create a manager
 */
ManagerR.post(
'/create',
managerAuth,
async (req: Request<{}, {}, CreateManagerI>, res: Response) => {
    try {
        const { manager, isAdmin } = req.body
        if(!isAdmin) {
            throw err(401, 'unauthorized')
        }

        const {
            firstName,
            lastName,
            email,
            phoneNumber,
            password,
            dob,
            masters
        } = req.body

        if(!isOfAge(dob)) {
            throw err(400, 'not of age')
        }

        const foundMasters = await Master.find({
            _id: {
                $in: masters
            }
        })

        if(foundMasters.length !== masters.length) {
            throw err(400, 'invalid master ids')
        }

        let user: UserDocT | null = null

        user = await User.findOne({ email })
        if(!user) {
            user = new User({
                firstName,
                lastName,
                email,
                phoneNumber,
                password,
                dob,
                created: now()
            })
        }

        const foundManager = await Manager.findOne({ userId: user._id })
        if(foundManager) {
            throw err(400, 'manager already exists')
        }
        
        await user.save()

        const newManager = new Manager({
            userId: user._id,
            isAdmin: false,
            masters,
            created: now()
        })

        await newManager.save()

        res.status(200).send(newManager)
    } catch(e) {
        res.status(400).send(e)
    }
})

interface ManagerWithMasterI extends ManagerAuthI {
    masterId: string
}

/**
 * add access to a master
 */
ManagerR.post(
'/add_master/:managerId',
managerAuth,
async (req: Request<{managerId: string}, {}, ManagerWithMasterI>, res: Response) => {
    try {
        const { isAdmin } = req.body
        const { managerId } = req.params
        if(!isAdmin) {
            throw err(401, 'unauthorized')
        }

        const { masterId } = req.body

        const master = await Master.findById(masterId)
        if(!master) {
            throw err(400, 'invalid master id')
        }

        const manager = await Manager.findById(managerId)
            .populate(ManagerPopulate)
        if(!manager) {
            throw err(400, 'master not found')
        }

        manager.masters.push(master._id)

        await manager.save()

        res.status(200).send(manager)
    } catch(e) {
        res.status(400).send(e)
    }
})

/**
 * Remove access to a master
*/
ManagerR.delete(
'/remove_master/:managerId',
managerAuth,
async (req: Request<{managerId: string}, {}, ManagerWithMasterI>, res: Response) => {
    try {
        const { isAdmin } = req.body
        const { managerId } = req.params
        if(!isAdmin) {
            throw err(401, 'unauthorized')
        }

        const { masterId } = req.body

        const foundMaster = await Master.findById(masterId)
        if(!foundMaster) {
            throw err(400, 'invalid master id')
        }

        const foundManager = await Manager.findById(managerId)
        if(!foundManager) {
            throw err(400, 'master not found')
        }

        foundManager.masters = foundManager.masters.filter((m) => {
            return m.toString() !== masterId
        })

        await foundManager.save()

        res.status(200).send(foundManager)
    } catch(e) {
        res.status(400).send(e)
    }
})

/**
 * Remove all access to masters
 */
ManagerR.delete(
'/remove_all_masters/:managerId',
managerAuth,
async (req: Request<{managerId: string}, {}, ManagerWithMasterI>, res: Response) => {
    try {
        const { isAdmin } = req.body
        const { managerId } = req.params
        if(!isAdmin) {
            throw err(401, 'unauthorized')
        }

        const manager = await Manager.findById(managerId)
            .populate(ManagerPopulate)
        if(!manager) {
            throw err(400, 'manager not found')
        }

        manager.masters = []

        await manager.save()

        res.status(200).send(manager)
    } catch(e) {
        res.status(400).send(e)
    }
})


export default ManagerR