require('dotenv').config()
import express, { Request, Response } from 'express'
import _, { rest } from 'lodash'
import { Types } from 'mongoose'
import { getAptById } from '../../constants/apartment'
import { sendEmailVerify } from '../../constants/email/setup'
import { now } from '../../constants/time'
import { isMatchingIds, noUnMatchingIds, servicesExist } from '../../constants/validation'
import { driverAuth, DriverAuthI } from '../../middleware/auth'
import Apt from '../../Models/aparmtent/apartment.model'
import Cleaner from '../../Models/cleaner.model'
import Order from '../../Models/Order.model'
import User from '../../Models/user.model'
import { AptToUnitI } from '../interface'
import { driverCleanerPopulate, driverCleanerSelect, driverOrderPopulate, driverOrderSelect } from './constants'

const orderR = express.Router()                                                                                                                    

/**
 * Find an order that is not closed, and has either the origin or dropOffAddress equal to the
 * addressId, or has the client equal to the clientId
 * @param {string | Types.ObjectId} clientId - string | Types.ObjectId,
 * @param {string | Types.ObjectId} addressId - string | Types.ObjectId
 * @returns An Order
*/
const findActiveOrder = async (
    clientId?: string | Types.ObjectId,
    addressId?: string | Types.ObjectId
) => {
    const activeOrder = await Order.findOne({$or: [
        {
            origin: addressId,
            orderClosed: false
        },
        {
            dropOffAddress: addressId,
            orderClosed: false
        }
    ]})

    return activeOrder
}

/**
 * Driver Creates order by the unit 
*/
orderR.post(
'/order/create/:aptId/:bldId/:unitId',
driverAuth,
async (req: Request<AptToUnitI, {}, DriverAuthI>, res: Response) => {
    try {
        const {
            aptId,
            bldId,
            /**
             * this is the unit number, not the unit id
            */
            unitId
        } = req.params
        const { driver } = req.body

        const apt = await Apt.findById(aptId)
        if(!apt) throw 'invalid apartment id'

        const unit = apt.buildings
            .get(bldId)?.units
            .get(unitId)

        //client and isActive must be true to continue
        if(!unit?.client || !unit?.isActive) throw `
            unit not capable of creating an order
        `

        const client = await User.findById(unit.client)
        if(!client) {
            res.status(500).send('client could not be retreived')
            return
        }

        // if(!client.emailVerified) {
        //     sendEmailVerify(
        //         client.email,
        //         client.firstName,
        //         `${process.env.HOST}/client/verify_email/${ client.id }`,
        //         apt.name
        //     )

        //     throw `user's email is not verified`
        // }                                                                                                                    

        const orderAlreadyExist = await findActiveOrder(client.id, unit.address)
        if(orderAlreadyExist) throw orderAlreadyExist

        //need to get the region's cleaner
        const order = await Order.create({
            client: client._id,
            origin: unit.address,
            dropOffAddress: unit.address,
            status: "Clothes To Cleaner",
            created: now(),
            pickUpDriver: driver._id,
            apartment: apt._id,
            aptName: apt.name,
            createdBy: {
                userType: 'Driver',
                userTypeId: driver._id
            },
            userCard: client.preferredCardId,
            building: bldId,
            unit: unitId,
            unitId: unit.unitId
        })

        driver.activeOrders.push(order._id)
        driver.orders.push(order._id)
        client.orders.push(order._id)

        await order.save()
        driver.save()
        client.save()
        
        await apt.addOrderToUnit(bldId, unitId, order.id)
            .catch(() => {
                console.error(`
                    unable to add order ${order.id} to ${bldId}/${apt} of ${apt.name}
                `)
            })

        order.addEvent(
            'Driver created order',
            '',
            'driver',
            driver._id
        )
        
        res.status(200).send(order)
    } catch(e) {
        res.status(400).send(e)
    }
})

/**
 * Cancel Order
*/
orderR.delete(
'/order/:aptId/:bldId/:unitId/cancel_order',
driverAuth,
async (req: Request<AptToUnitI, {}, DriverAuthI>, res: Response) => {
    try {
        const { 
            aptId,
            bldId,
            unitId
        } = req.params
        const { driver } = req.body

        const apt = await getAptById(aptId)
        const unit = apt.getUnit(bldId, unitId)
        if(!unit.activeOrder) {
            throw 'order already does not have an active order in this unit'
        }

        const order = await Order.findById(unit.activeOrder)
            .select(driverOrderSelect)
            .populate(driverOrderPopulate)
        
        if(!order) throw 'invalid order id'
        
        const client = await User.findById(order.client)
        if(!client) {
            console.error('client should exist undoubtably here')
        }

        /* This is checking if the order was created by the driver. If it was not, then the driver is
        not authorized to cancel the order. */
        if(
            order.createdBy.userType !== 'Driver' ||
            order.createdBy.userTypeId.toString() !== driver.id
        ) {
            throw 'not authorized to cancel this order'
        }

        const validStatuses = [
            "Driver To Cleaner",
            "Clothes To Cleaner",
            "Task Posted Dropoff",
            "Task Posted Pickup"
        ]

        /* This is checking if the order is in a valid state to be cancelled. If it is not, then the
        driver is not authorized to cancel the order. */
        if(!validStatuses.includes(order.status)) {
            throw 'Cannot cancel order at this point'
        }

        const clientOrders = client?.orders
        if(clientOrders) {
            client.orders = clientOrders.filter(odrId => odrId.toString() !== order.id)
        }
        client?.save()
        
        driver.removeActiveOrder(order.id)
        await apt.removeOrderToUnit(bldId, unitId)

        order.status = "Cancelled"
        order.closedTime = now()
        order.orderClosed = true

        order.save()
            .then(() => {
                res.status(200).send(order)
            })
            .catch(() => {
                res.status(500).send('something went wrong saving order.')
            })

        order.addEvent(
            'Driver cancelled order',
            '',
            'driver',
            driver._id
        )
    } catch(e) {
        res.status(400).send(e)
    }
})

/**
 * Get Active Orders
*/
orderR.get(
'/order/active_orders',
driverAuth,
async (req: Request<{}, {}, DriverAuthI>, res: Response) => {
    try {
        const { driver } = req.body

        await driver.populate({
            path: 'activeOrders',
            model: 'Order',
            select: driverOrderSelect,
            populate: driverOrderPopulate
        })

        res.status(200).send(driver.activeOrders)
    } catch(e) {
        res.status(400).send(e)
    }
})

orderR.get(
'/order/:orderId',
driverAuth,
async (req: Request<{ orderId: string }, {}, DriverAuthI>, res: Response) => {
    try {
        const { orderId } = req.params

        const order = await Order.findById(orderId)
            .select(driverOrderSelect)
            .populate(driverOrderPopulate)
        
        res.status(200).send(order)
    } catch(e) {
        res.status(400).send(e)
    }
})

/**
 * Pickup Order from Cleaners 
*/
orderR.post(
'/order/:orderId/cleaner_pickup/:clnId',
driverAuth,
async (req: Request<{ orderId: string, clnId: string }, {}, DriverAuthI>, res: Response) => {
    try {
        const { driver } = req.body
        const { orderId, clnId } = req.params

        const order = await Order.findOne({
            _id: orderId,
            cleaner: clnId
        })
            .select(driverOrderSelect)
            .populate(driverOrderPopulate)

        if(!order) {
            throw 'invalid params'
        }

        const cleaner = await Cleaner.findById(clnId)
            .select(driverCleanerSelect)
            .populate(driverCleanerPopulate)

        if(!cleaner) {
            res.status(500).send('unable to get cleaner by already valid id')
            return
        }
        
        cleaner.removeActiveOrder(orderId)
        driver.addActiveOrder(orderId)

        order.status = 'Picked Up From Cleaner'
        order.cleanerPickupTime = now()
        order.pickUpDriver = driver._id
        await order.invoiceClient()

        await order.save()
            .catch(() => {
                res.status(500).send('Could not save updated order after validation')
            })

        order.addEvent(
            'Driver picked up order from cleaner',
            '',
            'driver',
            driver._id
        )

        res.status(200).send(order)
    } catch(e) {
        res.status(400).send(e)
    }
})

interface PickupsReqI extends DriverAuthI {
    orderIds: string[]
}

/**
 * Pickup Orders from Cleaners 
*/
orderR.post(
'/order/cleaner_pickups/:clnId',
driverAuth,
async (req: Request<{ clnId: string }, {}, PickupsReqI>, res: Response) => {
    try {
        const { orderIds, driver } = req.body
        const { clnId } = req.params

        if(typeof orderIds !== 'object') {
            throw 'orderIds not provided properly'
        }

        const cleaner = await Cleaner.findById(clnId)
            .select(driverCleanerSelect)
            .populate(driverCleanerPopulate)

        if(!cleaner) throw 'invalid cleaner id'    

        const orders = await Order.find({
            _id: { $in: orderIds }
        })

        if(orders === null) {
            res.status(500).send(
                'All Orders in this request should have been found'
            )
            return
        }
        driver.addActiveOrders(orderIds)
        cleaner.removeActiveOrders(orderIds)

        for(const order of orders) {
            //is this cleaner attached to this order
            if(!isMatchingIds(order.cleaner, cleaner._id)) throw (
                `orderId: ${ order._id } is not with this cleaner`
            )

            order.status = 'Picked Up From Cleaner'
            order.pickUpDriver = driver._id,
            order.cleanerPickupTime = now()
            
            await order.invoiceClient()
            
            await order.save()

            order.addEvent(
                'Driver picked up order from cleaner',
                '',
                'driver',
                driver._id
            )
        }

        res.status(200).send(orders)
    } catch(e) {
        res.status(400).send(e)
    }
})

/**
 * Pickup Order from Cleaners 
*/
orderR.post(
'/order/:orderId/cleaner_pickup/:clnId',
driverAuth,
async (req: Request<{ orderId: string, clnId: string }, {}, DriverAuthI>, res: Response) => {
    try {
        const { driver } = req.body
        const { orderId, clnId } = req.params

        const order = await Order.findOne({
            _id: orderId,
            cleaner: clnId
        })
            .select(driverOrderSelect)
            .populate(driverOrderPopulate)

        if(!order) {
            throw 'invalid params'
        }

        const cleaner = await Cleaner.findById(clnId)
            .select(driverCleanerSelect)
            .populate(driverCleanerPopulate)

        if(!cleaner) {
            res.status(500).send('unable to get cleaner by already valid id')
            return
        }
        
        cleaner.removeActiveOrder(orderId)
        driver.addActiveOrder(orderId)

        order.status = 'Picked Up From Cleaner'
        order.cleanerPickupTime = now()
        order.pickUpDriver = driver._id
        await order.invoiceClient()
        

        order.save()
            .catch(() => {
                res.status(500).send('Could not save updated order after validation')
            })

        order.addEvent(
            'Driver picked up order from cleaner',
            '',
            'driver',
            driver._id
        )
        
        const sendOrder = await Order.findById(orderId, driverOrderSelect)
            .populate(driverOrderPopulate)
        
        if(!sendOrder) {
            res.status(500).send('Could not get updated order')
            return
        }

        res.status(200).send(sendOrder)
    } catch(e) {
        res.status(400).send(e)
    }
})

/**
 * Dropoff Order to Client
*/
orderR.post(
'/order/:orderId/client_dropoff',
driverAuth,
async (req: Request<{ orderId: string }, {}, DriverAuthI>, res: Response) => {
    try {
        const { driver } = req.body
        const { orderId } = req.params

        const order = await Order.findById(orderId)
            .select(driverOrderSelect)
            .populate(driverOrderPopulate)

        if(!order) throw 'invalid order Id'

        driver.removeActiveOrder(orderId)
        
        if(order.orderPaidfor || true) {
            const apt = await Apt.findById(order.apartment._id)
            if(!apt) {
                res.status(500).send(`
                    Could not get apartment by validated Id
                `)

                return
            }

            order.orderClosed = true
            apt.removeOrderToUnit(order.building, order.unit)
                .catch((e) => {
                    console.log(e)
                    res.status(500).send(`
                        Could not remove order from unit
                    `)
                })
        }

        order.status = 'Complete'
        order.clientDropoffTime = now()

        await order.save()
            .then(() => {
                order.addEvent(
                    'Driver dropped off order to client',
                    '',
                    'driver',
                    driver._id
                )
                res.status(200).send(order)
            })
            .catch(() => {
                res.status(500).send('Could not save updated order after validation')
            })
    } catch(e) {
        res.status(400).send(e)
    }
})
    

export default orderR