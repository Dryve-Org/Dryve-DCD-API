import { error } from 'console'
import express, {
    Response,
    Request
} from 'express'
import { desiredServicesI, err, handleDesiredServices, idToString } from '../../constants/general'
import { now } from '../../constants/time'
import { cleanerProAuth, CleanerProAuthI } from '../../middleware/auth'
import Cleaner from '../../Models/cleaner.model'
import Order, { OrderstatusT } from '../../Models/Order.model'
import { CleanerProOrderPopulate, CleanerProOrderSelect } from './constants'

const orderR = express.Router()

interface ParamsI {
    orderId: string
    machineId: string
    cleanerId: string
}

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
        const { cleanerPro } = req.body

        const order = await Order.findById(orderId)
            .populate(CleanerProOrderPopulate)
            .select(CleanerProOrderSelect)
            
        if(!order) throw 'invalid order Id'

        order.cleanerApproved = true

        await order.save()
            .then(() => {
                res.status(200).send(order)
            })
            .catch(() => {
                res.status(500).send('unable to save verified order')
            })

        order.addEvent(
            'Cleaner Approved Order',
            'Cleaner approved that the clothes were dropped off and will be handled',
            'cleaner profile',
            cleanerPro._id,
        )
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
        const { attachedCleaners, desiredServices, cleanerPro } = req.body

        const order = await Order.findById(orderId, CleanerProOrderSelect)
            .populate(CleanerProOrderPopulate)

        if(!order) throw 'invalid order id'

        if(!order.cleanerApproved) throw 'cleaner must first approve this order'

        if(!idToString(attachedCleaners).includes(order.cleaner._id.toString())) {
            throw 'cleaner not authorized to handle this order'
        }

        const validStatuses: OrderstatusT[] = [
            'Clothes Awaiting Pricing',
            'Clothes Being Cleaned',
            'Clothes Ready'
        ]

        if(order.orderPaidfor) throw 'Order was already paid for'
        if(!validStatuses.includes(order.status)) {
            throw 'Cannot update desired services at this point'
        }

        order.status = order.status === 'Clothes Awaiting Pricing' ?
        'Clothes Being Cleaned' :
        order.status

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

        //edit: in the future, add desired service to details in addEvent
        order.addEvent(
            'Cleaner Updated Desired Services',
            'Cleaner updated desired services for this order',
            'cleaner profile',
            cleanerPro._id
        )
    } catch(e) {
        res.status(400).send(e)
    }
})

/**
 * Ready clothes for pickup from cleaners
*/
orderR.put(
'/order/:orderId/clothes_ready',
cleanerProAuth,
async (req: Request<{orderId: string}, {}, addServices>, res: Response) => {
    try {
        const { orderId } = req.params
        const { attachedCleaners, cleanerPro } = req.body

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
            'Clothes Ready'
        ]

        const cleaner = await Cleaner.findById(order.cleaner._id)
        if(!cleaner) throw 'unable to find cleaner with this order'

        const orderInMachines = cleaner.findOrderInMachines(order._id)
        if(orderInMachines) {
            const listMachines = orderInMachines.map(machine => machine.machineId)
            throw `Order is in machines: ${listMachines}` 
        }

        if(!validStatuses.includes(order.status)) {
            throw 'Cannot update order at this point'
        }

        order.isDropOff = true
        order.cleanFinishTime = now()
        order.status = 'Clothes Ready'

        await order.save()
            .then(() => {
                res.status(200).send(order)
            })
            .catch(() => {
                res.status(500).send('unable to update order to Clothes Ready')
            })

        order.addEvent(
            'Order is now for ready pick',
            '',
            'cleaner profile',
            cleanerPro._id
        )
    } catch(e) {
        res.status(400).send(e)
    }
})

/**
 * Unready clothes for pickup from cleaners
*/
orderR.patch(
'/order/:orderId/clothes_ready',
cleanerProAuth,
async (req: Request<{orderId: string}, {}, CleanerProAuthI>, res: Response) => {
    try {
        const { orderId } = req.params
        const { attachedCleaners, cleanerPro } = req.body

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

        await order.save()
            .then(() => {
                res.status(200).send(order)
            })
            .catch(() => {
                res.status(500).send('unable to update order to unReady')
            })

        order.addEvent(
            'canceled ready clothes',
            "Canceled clothes that were set to 'ready for pick up'",
            'cleaner profile',
            cleanerPro._id
        )
    } catch(e) {
        res.status(400).send(e)
    }
})

/**
 * Add order to machine
 * 
 * @param orderId - order id
 * @param machineId - machine id
*/
orderR.post(
'/order/:orderId/add_to_machine/:machineId',
cleanerProAuth,
async (req: Request<{orderId: string, machineId: string}, {}, CleanerProAuthI>, res: Response) => {
    try {
        const { orderId, machineId } = req.params
        const { attachedCleaners, cleanerPro } = req.body

        const order = await Order.findOne(
            {
                _id: orderId,
                cleaner: {
                    _id: {$in: attachedCleaners }
                }
            },
            CleanerProOrderSelect,
        )
        .populate(CleanerProOrderPopulate)
        if(!order) throw err(400, 'unable to find cleaner with this order')

        const cleaner = await Cleaner.findById(order.cleaner._id)
        if(!cleaner) throw err(400, 'unable to find cleaner with this order')
        
        await cleaner.attachOrderToMachine(machineId, order._id)
        
        order.addEvent(
            `clothes assigned to machine: ${ machineId }`,
            '',
            'cleaner profile',
            cleanerPro._id
        )

        res.status(200).send(order)   
    } catch(e: any) {
        res.status(e.status).send(e.message)
    }
})

/**
 * Remove order from machine
 */
orderR.post(
'/order/:orderId/remove_from_machine/:machineId',
cleanerProAuth,
async (req: Request<{orderId: string, machineId: string}, {}, CleanerProAuthI>, res: Response) => {
    try {
        const { orderId, machineId } = req.params
        const { attachedCleaners, cleanerPro } = req.body

        const order = await Order.findOne(
            {
                _id: orderId,
                cleaner: {
                    _id: {$in: attachedCleaners }
                }
            },
            CleanerProOrderSelect,
        )
        .populate(CleanerProOrderPopulate)
        if(!order) throw err(400, 'unable to find cleaner with this order')

        const cleaner = await Cleaner.findById(order.cleaner._id)
        if(!cleaner) throw err(400, 'unable to find cleaner with this order')

        await cleaner.detachOrderFromMachine(machineId)
        
        order.addEvent(
            `clothes unassigned from machine: ${ machineId }`,
            '',
            'cleaner profile',
            cleanerPro._id
        )

        res.status(200).send(order)
    } catch(e: any) {
        res.status(e.status).send(e.message)
    }
}) 

export default orderR