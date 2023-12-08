import { Router, Request, Response } from 'express'
import { managerAuth, ManagerAuthI } from '../../middleware/auth'
import { err } from '../../constants/general'
import Manager from '../../Models/manager.models'
import { CleanerPopulate, ManagerPopulate } from './constants'
import User, { UserDocT } from '../../Models/user.model'
import { isOfAge, now } from '../../constants/time'
import Master from '../../Models/master'
import Cleaner from '../../Models/cleaner.model'

const CleanerR = Router()

/**
 * Get all managers
 */
CleanerR.get(
'/all',
managerAuth,
async (req: Request<{}, {}, ManagerAuthI>, res: Response) => {
    try {
        const { manager, isAdmin } = req.body
        if(!isAdmin) {
            throw err(401, 'unauthorized')
        }

        const cleaners = await Cleaner.find({})
            .populate(CleanerPopulate)
        if(!cleaners) {
            throw err(500, 'something went wrong with getting cleaners')
        }

        res.status(200).send(cleaners)
    } catch(e) {
        res.status(400).send(e)
    }
})

/**
 * Delete a cleaner
 */
CleanerR.delete(
'/delete/:cleanerId',
managerAuth,
async (req: Request<{cleanerId: string}, {}, ManagerAuthI>, res: Response) => {
    try {
        const { isAdmin } = req.body
        const { cleanerId } = req.params
        if(!isAdmin) {
            throw err(401, 'unauthorized')
        }

        const cleaner = await Cleaner.findByIdAndDelete(cleanerId)
        if(!cleaner) {
            throw err(500, 'something went wrong with deleting cleaner')
        }

        res.status(200).send(cleaner)
    } catch(e) {
        res.status(400).send(e)
    }
})

export default CleanerR