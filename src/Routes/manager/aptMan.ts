import express, { Request, Response } from 'express'
import { now } from '../../constants/time'
import { managerAuth, ManagerAuthI } from '../../middleware/auth'
import Apt from '../../Models/aparmtent/apartment.model'
import AptMan from '../../Models/aptMan.model'
import User from '../../Models/user.model'

const AptManR = express.Router()

interface AptManLoginI extends ManagerAuthI {
    firstName: string
    lastName: string
    nickname?: string
    email: string
    attachedApts?: string[]
}

AptManR.post(
'/aptman/add_manager',
managerAuth,
async (req: Request<{}, {}, AptManLoginI>, res: Response) => {
    try {
        const {
            manager,
            firstName,
            lastName,
            nickname,
            email,
            attachedApts
        } = req.body
        /// Validate body ///
        if(
            !firstName ||
            !lastName ||
            !email
        ) {
            throw new Error('missing required fields')
        }

        const aptManager = await AptMan.findOne({ email })
        if(aptManager) {
            throw new Error('email already in use')
        }

        //find out if all attachedApts are valid
        if(attachedApts) {
            const apts = await Apt.find({
                _id: {
                    $in: attachedApts
                },
                master: {
                    $in: manager.masters
                }
            })
            if(apts.length !== attachedApts.length) {
                throw new Error('invalid attachedApts that might not be in your master')
            }
        }

        /// Create new aptMan ///
        const aptMan = new AptMan({
            firstName,
            lastName,
            nickname,
            email,
            password: '123',
            attachedApts,
            createdBy: manager._id,
            created: now()
        })

        await aptMan.save()

        res.status(201).send(aptMan)
    } catch(e) {
        res.status(400).send(e)
    }
})

export default AptManR