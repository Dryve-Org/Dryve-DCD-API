import express, {
    Response,
    Request
} from 'express'
import { desiredServicesI, handleDesiredServices, idToString } from '../../constants/general'
import { now } from '../../constants/time'
import { cleanerProAuth, CleanerProAuthI } from '../../middleware/auth'
import Order, { OrderstatusT } from '../../Models/Order.model'
import { CleanerProOrderPopulate, CleanerProOrderSelect } from './constants'

const orderR = express.Router()

orderR.get(
'/order/:orderId',
cleanerProAuth,
async (req: Request<{orderId: string}, {}, CleanerProAuthI>, res: Response) => {
    try {
        const { orderId } = req.params
        const { attachedCleaners } = req.body

        const order = await Order.findOne({
            _id: orderId,
            cleaner: {
                _id: {$in: attachedCleaners }
            }
        })
        .populate(CleanerProOrderPopulate)
        .select(CleanerProOrderSelect)

        if(!order) {
            throw 'invalid cleaner'
        }

        res.status(200).send(order)
    } catch(e) {
        res.status(400).send(e)
    }
})

interface addServices extends CleanerProAuthI {
    desiredServices: desiredServicesI[]
}

/**
 * Approve dropoff of clothes
 * **Cleaner must do this before editting order.
*/
orderR.put(
'/order/:orderId/approve_dropoff',
cleanerProAuth,
async (req: Request<{orderId: string}, {}, CleanerProAuthI>, res: Response) => {
    try {
        const { orderId } = req.params

        const order = await Order.findById(orderId)
            .populate(CleanerProOrderPopulate)
            .select(CleanerProOrderSelect)
            
        if(!order) throw 'invalid order Id'

        order.cleanerApproved = true

        order.save()
            .then(() => {
                res.status(200).send(order)
            })
            .catch(() => {
                res.status(500).send('unable to save verified order')
            })
    } catch(e) {
        res.status(400).send(e)
    }
})

/** 
 * Update order desired services
*/
orderR.put(
'/order/:orderId/update_services',
cleanerProAuth,
async (req: Request<{orderId: string}, {}, addServices>, res: Response) => {
    try {
        const { orderId } = req.params
        const { attachedCleaners, desiredServices } = req.body

        const order = await Order.findById(orderId)
            .populate(CleanerProOrderPopulate)
            .select(CleanerProOrderSelect)

        if(!order) throw 'invalid order id'

        if(!order.cleanerApproved) throw 'cleaner must first approve this order'

        if(!idToString(attachedCleaners).includes(order.cleaner._id.toString())) {
            throw 'cleaner not authorized to handle this order'
        }

        const validStatuses: OrderstatusT[] = [
            'Clothes Awaiting Pricing'
        ]

        if(order.orderPaidfor) throw 'Order was already paid for'
        if(!validStatuses.includes(order.status)) {
            throw 'Cannot update desired services at this point'
        }

        order.status = 'Clothes Being Cleaned'

        await order.updateDesiredServices(desiredServices)

        await order.populate({
            path: 'desiredServices.service',
            model: 'Service'
        })

        await order.save()
            .then(() => {
                res.status(200).send(order)
            })
            .catch(e => {
                console.log(e)
                res.status(500).send(e)
            })
    } catch(e) {
        res.status(400).send(e)
    }
})

/**
 * Ready clothes clothes for pickup from cleaners
*/
orderR.put(
'/order/:orderId/clothes_ready',
cleanerProAuth,
async (req: Request<{orderId: string}, {}, addServices>, res: Response) => {
    try {
        const { orderId } = req.params
        const { attachedCleaners } = req.body

        const order = await Order.findOne({
            _id: orderId,
            cleaner: {
                _id: {$in: attachedCleaners }
            }
        })
            .populate(CleanerProOrderPopulate)
            .select(CleanerProOrderSelect)
            .catch(() => {
                throw 'unable to find cleaner with this order'
            })

        if(!order) throw 'unable to find cleaner with this order'

        if(!order.cleanerApproved) throw 'cleaner must first approve this order'

        const validStatuses: OrderstatusT[] = [
            'Clothes Being Cleaned',
        ]

        if(!validStatuses.includes(order.status)) {
            throw 'Cannot update order at this point'
        }

        order.isDropOff = true
        order.cleanFinishTime = now()
        order.status = 'Clothes Ready'

        order.save()
            .then(() => {
                res.status(200).send(order)
            })
            .catch(() => {
                res.status(500).send('unable to update order to Clothes Ready')
            })
    } catch(e) {
        res.status(400).send(e)
    }
})

/**
 * Unready clothes clothes for pickup from cleaners
*/
orderR.patch(
'/order/:orderId/clothes_ready',
cleanerProAuth,
async (req: Request<{orderId: string}, {}, CleanerProAuthI>, res: Response) => {
    try {
        const { orderId } = req.params
        const { attachedCleaners } = req.body

        const order = await Order.findOne({
            _id: orderId,
            cleaner: {
                _id: {$in: attachedCleaners },
            }
        })
            .populate(CleanerProOrderPopulate)
            .select(CleanerProOrderSelect)
            .catch(() => {
                throw 'unable to find cleaner with this order'
            })
        if(!order) throw 'unable to find cleaner with this order'

        const validStatuses: OrderstatusT[] = [
            'Clothes Ready',
        ]

        if(!validStatuses.includes(order.status)) {
            throw 'Cannot update order at this point'
        }

        order.isDropOff = false
        order.cleanFinishTime = undefined
        order.status = 'Clothes Being Cleaned'

        order.save()
            .then(() => {
                res.status(200).send(order)
            })
            .catch(() => {
                res.status(500).send('unable to update order to unReady')
            })
    } catch(e) {
        res.status(400).send(e)
    }
})

export default orderR