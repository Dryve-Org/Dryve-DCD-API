import express, { Request, Response } from 'express'
import { addAddress } from '../../constants/location'
import { cleanerProAuth, managerAuth, ManagerAuthI } from '../../middleware/auth'
import Address, { AddressI } from '../../Models/address.model'
import Cleaner from '../../Models/cleaner.model'
import v from 'validator'
import Service, { ServiceI } from '../../Models/services.model'
import CleanerProfile from '../../Models/cleanerProfile.model'
import { idToString } from '../../constants/general'

const cleanerProR = express.Router()

cleanerProR.post(
'/cleanerPro/:clnProId/add_attached_cleaner/:clnId',
managerAuth,
async (req: Request<{ clnProId: string, clnId: string }, {}, ManagerAuthI>, res: Response) => {
    try {
        const { clnProId, clnId } = req.params

        const cleaner = await Cleaner.findById(clnId)

        if(!cleaner) {
            throw {
                status: 400,
                message: 'cleaner not found'
            }
        }

        const cleanerPro = await CleanerProfile.findById(clnProId)

        if(!cleanerPro) {
            throw {
                status: 400,
                message: 'cleaner profile not found'
            }
        }

        if(idToString(cleanerPro.attachedCleaners).includes(cleaner._id.toString())) {
            throw {
                status: 400,
                message: 'cleaner already attached'
            }
        }

        cleanerPro.attachedCleaners.push(cleaner._id)

        cleanerPro.save()

        res.status(200).send(cleanerPro)
    } catch(e: any) {
        res.status(e.status).send(e.message)
    }
})


export default cleanerProR