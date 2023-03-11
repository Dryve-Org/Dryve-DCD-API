import express, {
    Response,
    Request
} from 'express'
import { err, idToString } from '../../constants/general'
import { cleanerProAuth, CleanerProAuthI } from '../../middleware/auth'
import Cleaner from '../../Models/cleaner.model'
import { CleanerProCleanerPopulate, CleanerProCleanerSelect, CleanerProOrderPopulate, CleanerProOrderSelect } from './constants'

const cleanerR = express.Router()

cleanerR.get(
'/cleaner/:cleanerId',
cleanerProAuth,
async (req: Request<{ cleanerId: string } ,{}, CleanerProAuthI>, res: Response) => {
    try {
        const { cleanerId } = req.params
        const { attachedCleaners } = req.body

        /* Checking if the cleanerId is in the attachedCleaners array. */
        if(!idToString(attachedCleaners).includes(cleanerId)) {
            throw 'invalid cleaner id'
        }

        const cleaner = await Cleaner.findById(cleanerId)
            .populate([
                {
                    path: 'address',
                    model: 'Address'
                },
                {
                    path: 'services',
                    model: 'Service'
                }
            ])
            .select({
                cardId: 0,
                paymentMethod: 0,
                stripeId: 0
            })

        res.status(200).send(cleaner)
    } catch(e) {
        res.status(400).send(e)
    }
})

/*
    Get Attached Cleaners
*/
cleanerR.get(
'/attached_cleaners',
cleanerProAuth,
async (req: Request<{}, {}, CleanerProAuthI>, res: Response) => {
    try {
        const { attachedCleaners } = req.body
        
        const cleaners = await Cleaner.find({
            _id: {'$in': attachedCleaners} 
        })
            .populate(CleanerProCleanerPopulate)
            .select(CleanerProCleanerSelect)

        if(!cleaners) {
            res.status(500).send('something went wrong')
            return
        }

        res.status(200).send(cleaners)
    } catch (e) {
        res.status(400).send(e)
    }
})

/*
    Get active orders of cleaner
*/
cleanerR.get(
'/active_orders/:cleanerId',
cleanerProAuth,
async (req: Request<{cleanerId: string}, {}, CleanerProAuthI>, res: Response) => {
    try {
        const { cleanerId } = req.params
        const { attachedCleaners } = req.body

        //is this cleaner profile authorized for this cleaner
        if(!idToString(attachedCleaners).includes(cleanerId)) {
            res.status(500).send('not authorized for this cleaner')
            return
        }

        //query: getting active orders and 
        // populate persons information
        const cleaner = await Cleaner.findById(cleanerId)
            .select(CleanerProCleanerSelect)
            .populate(CleanerProCleanerPopulate)

        if(!cleaner) throw 'invalid cleaner id'

        console.log('orders', cleaner.activeOrders)


        res.status(200).send(cleaner.activeOrders)
    } catch(e) {
        res.status(400).send(e)
    }
})

/*
    Get Cleaner's services
*/
cleanerR.get(
'/cleaner/:cleanerId/services',
cleanerProAuth,
async (req: Request<{cleanerId: string}, {}, CleanerProAuthI>, res: Response) => {
    try {
        const { cleanerId } = req.params
        const { attachedCleaners } = req.body

        //is this cleaner profile authorized for this cleaner
        if(!idToString(attachedCleaners).includes(cleanerId)) {
            res.status(500).send('not authorized for this cleaner')
            return
        }

        //query: getting active orders and 
        // populate persons information
        const cleaner = await Cleaner.findById(cleanerId)
            .select('services')
            .populate('services')
            .exec()

        if(!cleaner) throw 'invalid cleaner id'


        res.status(200).send(cleaner.services)
    } catch(e) {
        res.status(400).send(e)
    }
})

/*
    Get Cleaner's machines
*/
cleanerR.get(
'/cleaner/:cleanerId/machines',
cleanerProAuth,
async (req: Request<{cleanerId: string}, {}, CleanerProAuthI>, res: Response) => {
    try {
        const { cleanerId } = req.params
        const { attachedCleaners } = req.body

        //is this cleaner profile authorized for this cleaner
        if(!idToString(attachedCleaners).includes(cleanerId)) {
            res.status(401).send('not authorized for this cleaner')
            return
        }

        const cleaner = await Cleaner.findById(cleanerId)
            .select('machines')
            .populate('machines.attachedOrder')
        if(!cleaner) throw err(400, 'invalid cleaner id')
        
        res.status(200).send(cleaner.machines)
    } catch(e: any) {
        if(e.status && e.message) {
            res.status(e.status).send(e.message)
        }  else {
            res.status(500).send('something went wrong')
        }
    }
})

/*
    Toggle Cleaner's out of order status
*/
cleanerR.post(
'/cleaner/:cleanerId/machines/toggle_ooo/:machineId',
cleanerProAuth,
async (req: Request<{cleanerId: string, machineId: string}, {}, CleanerProAuthI>, res: Response) => {
    try {
        const { cleanerId, machineId } = req.params
        const { attachedCleaners } = req.body

        //is this cleaner profile authorized for this cleaner
        if(!idToString(attachedCleaners).includes(cleanerId)) {
            res.status(401).send('not authorized for this cleaner')
            return
        }

        const cleaner = await Cleaner.findById(cleanerId)
            .select('machines')
        if(!cleaner) throw err(400, 'invalid cleaner id')

        await cleaner.toggleMachineStatus(machineId)

        res.status(200).send(cleaner.machines)
    } catch(e: any) {
        if(e.status && e.message) {
            res.status(e.status).send(e.message)
        }  else {
            res.status(500).send('something went wrong')
        }
    }
})



export default cleanerR