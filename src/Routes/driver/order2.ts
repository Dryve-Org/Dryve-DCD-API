require('dotenv').config()
import express, { Request, Response } from 'express'
import _, { rest } from 'lodash'
import { Types } from 'mongoose'
import { getAPtByUnitId, getAptById } from '../../constants/apartment'
import { sendEmailVerify } from '../../constants/email/setup'
import { now } from '../../constants/time'
import { isMatchingIds, noUnMatchingIds, servicesExist } from '../../constants/validation'
import { driverAuth, DriverAuthI } from '../../middleware/auth'
import Apt, { UnitI } from '../../Models/aparmtent/apartment.model'
import Cleaner from '../../Models/cleaner.model'
import Order, { OrderDocT, OrderI } from '../../Models/Order.model'
import User from '../../Models/user.model'
import { AptToUnitI } from '../interface'
import { driverAptSelect, driverCleanerPopulate, driverCleanerSelect, driverClientSelect, driverOrderPopulate, driverOrderSelect } from './constants'
import Master from '../../Models/master'
import { err, extractUnitId, idToString, stringToId } from '../../constants/general'

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
 * 
 * this needs to be updated to unit id
*/
// orderR.post(
// '/order/create/:unitId',
// driverAuth,
// async (req: Request<AptToUnitI, {}, DriverAuthI>, res: Response) => {
//     try {
//         const {
//             /**
//              *unit id
//             */
//             unitId
//         } = req.params
//         const { driver } = req.body

//         const apt = await getAPtByUnitId(unitId)
//         if(!apt) throw 'invalid apartment id'

//         const unitData = apt.getUnitId(unitId)
//         if(!unitData) throw 'invalid unit id'

//         const unit = unitData[2]
//         const bldId = unitData[0]
//         const unitNum = unitData[1]

//         //client and isActive must be true to continue
//         //update
//         // if(!unit?.client || !unit?.isActive || !unit || unit.queued === null) throw `
//         //     unit not capable of creating an order
//         // `

//         const master = await Master.findById(apt.master)
//         if(!master) throw 'master could not be retreived'

//         // const client = await User.findById(unit.client)
//         // if(!client) {
//         //     res.status(500).send('client could not be retreived')
//         //     return
//         // }

//         // if(!client.emailVerified) {
//         //     sendEmailVerify(
//         //         client.email,
//         //         client.firstName,
//         //         `${process.env.HOST}/client/verify_email/${ client.id }`,
//         //         apt.name
//         //     )

//         //     throw `user's email is not verified`
//         // }                                                                                                                    

//         const orderAlreadyExist = await findActiveOrder(client.id, unit.address)
//         if(orderAlreadyExist) throw orderAlreadyExist

//         //need to get the region's cleaner
//         const order = await Order.create({
//             master: apt.master,
//             clientPreferences: master.clientPreferences.filter(preference => {
//                 //@ts-ignore
//                 if(client.preferences.includes(idToString(preference._id))) {
//                     return true
//                 }
//             }),
//             client: client._id,
//             origin: unit.address,
//             dropOffAddress: unit.address,
//             status: "Clothes To Cleaner",
//             created: now(),
//             pickUpDriver: driver._id,
//             apartment: apt._id,
//             aptName: apt.name,
//             createdBy: {
//                 userType: 'Driver',
//                 userTypeId: driver._id
//             },
//             userCard: client.preferredCardId,
//             building: bldId,
//             unit: unitId,
//             unitId: unit.unitId
//         })

//         driver.activeOrders.push(order._id)
//         driver.orders.push(order._id)
//         // client.orders.push(order._id)

//         await order.save()
//         driver.save()
//         // client.save()
//         apt.dequeueUnit(unit.unitId)
        
//         await apt.addOrderToUnit(unit.unitId, order.id)
//             .catch(() => {
//                 console.error(`
//                     unable to add order ${order.id} to unit ${unitId}
//                 `)
//             })

//         order.addEvent(
//             'Driver created order',
//             '',
//             'driver',
//             driver._id
//         )
        
//         res.status(200).send(order)
//     } catch(e: any) {
//         if(e.status && e.message) {
//             res.status(e.status).send(e.message)
//         } else {
//             res.status(500).send(e)
//         }
//     }
// })

interface ClientOrderCreateI {
    clientEmail: string
    unitId: UnitI['unitId']
}

orderR.post(
'/order/client_create/:unitId/:clientEmail',
driverAuth,
async (req: Request<ClientOrderCreateI, {}, DriverAuthI>, res: Response) => {
    try {
        const { clientEmail, unitId } = req.params
        const { driver } = req.body

        const client = await User.findOne(  
            {email: clientEmail},
            { 
                ...driverClientSelect 
            }
        ).populate([
            {
                path: 'activeOrders',
                model: 'Order',
                select: driverOrderSelect
            }
        ])
        if(!client) throw err(400, 'client not found')
        if(!client.attachedUnitIds.includes(unitId)) { 
            throw err(400, 'client not attached to unit')
        }

        const activeOrders = client.activeOrders
        
        if(activeOrders.length > 0) {
            client.activeOrders.forEach(order => {
                //@ts-ignore
                if(order.unitId === unitId) {
                    console.log(order, unitId)
                    throw err(400, `client already has an active order for this unit`)
                }
            })
        }

        const [ aptId, unitIdNum ] = extractUnitId(unitId)
        
        const apt = await Apt.findOne(
            { aptId },
            driverAptSelect
        )
        if(!apt) throw err(500, 'unable to get apartment data')

        const unitData = apt.getUnitId(unitId)
        if(!unitData) throw err(400, 'unit not found')
        const [ bldId, unitNum, unit ] = unitData

        if(!unit.isActive) {
            throw err(400, 'unit not capable of creating an order')
        }

        const master = await Master.findById(apt.master)
        if(!master) throw err(500, 'master could not be retreived')

        const clientPreferences = master.clientPreferences.filter(preference => {
            //@ts-ignore
            if(client.preferences.includes(idToString(preference._id))) {
                return true
            }
        })

        const order = await Order.create({
            master: apt.master,
            clientPreferences,
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
            building: bldId,
            unit: unitNum,
            unitId: unitId
        })
        
        await order.save()

        driver.activeOrders.push(order._id)
        //@ts-ignore
        client.activeOrders.push(order._id)
        await client.save()
        
        driver.save()
        
        await apt.addOrderToUnit(unitId, order.id)
        await apt.dequeueUnit(unitId)

        order.addEvent(
            'Driver created order',
            '',
            'driver',
            driver._id
        )

        res.status(200).send(order)
    } catch(e: any) {
        if(e.status && e.message) {
            res.status(e.status).send(e.message)
        } else {
            res.status(500).send(e)
        }
    }
})

orderR.post(
'/order/bagquantity/:orderId/:quantity',
driverAuth,
async (req: Request<{orderId: string, quantity: string}, {}, DriverAuthI>, res: Response) => {
    try {
        const { orderId } = req.params
        const { driver } = req.body
        const quantity = parseInt(req.params.quantity)
        
        if(isNaN(quantity) || quantity < 1) {
            throw err(400, 'quantity not provided')
        }

        if(!driver.activeOrders.includes(stringToId(orderId)[0])) {
            throw err(400, 'order not handled by driver')
        }

        const order = await Order.findById(orderId, driverOrderSelect)
            .populate(driverOrderPopulate)

        if(!order) throw 'invalid order id'

        order.bagQuantity = quantity

        await order.save()
            .catch(() => {
                return err(500, 'something went wrong saving order.')
            })

        res.status(200).send(order)

        order.addEvent(
            `Driver updated bag quantity`,
            `quantity: ${quantity}`,
            'driver',
            driver._id
        )
    } catch(e: any) {
        if(e.status && e.message) {
            res.status(e.status).send(e.message)
        } else {
            res.status(500).send(e)
        }
    }
})


/**
 * Cancel Order
 * 
 * This needs to be updated to unit id
*/
orderR.delete(
'/order/:orderId/cancel_order',
driverAuth,
async (req: Request<{
    unitId: UnitI['unitId']
    orderId: string
}, {}, DriverAuthI>, res: Response) => {
    try {
        const {
            orderId
        } = req.params
        const { driver } = req.body

        if(!idToString(driver.activeOrders).includes(orderId)) {
            throw 'order is not handled by this driver'
        }

        const order = await Order.findById(orderId)
            .select(driverOrderSelect)
            .populate(driverOrderPopulate)
        
        if(!order) throw 'invalid order id'

        const apt = await getAPtByUnitId(order.unitId)
        if(!apt) throw 'invalid apartment id'

        const unitData = apt.getUnitId(order.unitId)
        if(!unitData) throw 'invalid unit id'

        const client = await User.findById(order.client)
        if(!client) {
            console.error('client should exist undoubtably here')
            throw 'client should exist undoubtably here'
        }

        if(client.orders) {
            client.orders = client.orders.filter(odrId => odrId.toString() !== order.id)
            client.activeOrders = client.orders.filter(odrId => odrId.toString() !== order.id)
        }

        const validStatuses = [
            "Cancelled",
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

        
        
        driver.removeActiveOrder(order.id)
        await apt.removeOrderToUnit(order.unitId, order.id)

        order.status = "Cancelled"
        order.closedTime = now()
        order.orderClosed = true

        await order.save()
            .then(() => {
                res.status(200).send(order)
            })
            .catch(() => {
                res.status(500).send('something went wrong saving order.')
            })

        client?.save()

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

interface GetOrdersI extends DriverAuthI {
    orderIds: string[]
}

orderR.get(
'/order/orders',
driverAuth,
async (req: Request<{}, {}, GetOrdersI>, res: Response) => {
    try {
        const { 
            driver,
            orderIds
        } = req.body

        const orders = await Order.find({
            _id: { $in: orderIds }
        })
            .select(driverOrderSelect)
            .populate(driverOrderPopulate)
        
        if(!orders) throw 'orders not found'

        const authOrdersByMaster = orders.filter(odr => {
            return driver.masters.includes(odr.master)
        })

        res.status(200).send(authOrdersByMaster)
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

        await driver.removeActiveOrder(orderId)
        
        if(order.orderPaidfor || true) {
            const apt = await Apt.findById(order.apartment._id)
            if(!apt) {
                res.status(500).send(`
                    Could not get apartment by validated Id
                `)

                return
            }

            order.orderClosed = true
            await apt.removeOrderToUnit(order.unitId, orderId)
                .catch((e) => {
                    console.log(e)
                    res.status(500).send(`
                        Could not remove order from unit
                    `)
                })
        }

        order.status = 'Complete'
        order.clientDropoffTime = now()

        const client = await User.findById(
            order.client,
            {
                activeOrders: 1
            }
        )
        if(!client) {
            console.error('Could not get client by validated Id')
        } else {
            client.activeOrders = client.activeOrders.filter(orderId => orderId.toString() !== order.id)
            client.save()
        }

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