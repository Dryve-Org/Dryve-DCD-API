import express, { Request, Response } from 'express'
import _ from 'lodash'
import { desiredServicesI, idToString, stringToId } from '../../constants/general'
import { coordinatesT, getMeters, validateGeo } from '../../constants/location'
import { now } from '../../constants/time'
import { isMatchingIds, servicesExist } from '../../constants/validation'
import { driverAuth, DriverAuthI } from '../../middleware/auth'
import Cleaner from '../../Models/cleaner.model'
import Order from '../../Models/Order.model'
import User from '../../Models/user.model'
import { GeoDriverI } from './interface'

const orderR = express.Router()

interface FindOrdersDriveI extends DriverAuthI{
    latitude: number
    longitude: number
    maxDistance: number //orders within this range in miles
}

/*
    Driver finds orders near them

    this should be coming from user's
    phone geolocation
*/
orderR.get(
'/find_orders', 
driverAuth, 
async (req: Request<{}, {}, FindOrdersDriveI>, res: Response) => {
    try {
        const { latitude, longitude, maxDistance } = req.body
        if(!validateGeo([latitude, longitude])) throw 'bad data: invalid geo location'
        //// validation ////
        //check req.body's properties
        if(!latitude || !longitude || !maxDistance) throw 'bad data: invalid body'

        const populate = [
            {
                path: 'desiredServices.service',
                model: 'Service'
            },
            {
                path: 'client',
                model: 'User',
                select: {
                    firstName: 1,
                    lastName: 1,
                    phoneNumber: 1,
                }
            },
            {
                path: 'cleaner',
                model: 'Cleaner',
                select: {
                    name: 1,
                    services: 1,
                    phoneNumber: 1,
                    website: 1,
                }
            },
            {
                path: 'origin',
                model: 'Address'
            },
            {
                path: 'cleanerAddress',
                model: 'Address'
            }
        ]

        //find nearby drop off requests
        const getDropoffs = Order
            .find({
                status: 'Task Posted Dropoff',
                'cleanerAddress.location': {
                    $near: {
                        $maxDistance: getMeters(maxDistance),
                        $geometry: {
                            type: "Point",
                            coordinates: [ longitude, latitude ]
                        }
                    }
                }
            })
            .populate(populate)
        //find nearby pick up requests
        const getPickUps = Order
        .find(
            {
                status: 'Task Posted Pickup',
                'origin.location': {
                    $near: {
                        $maxDistance: getMeters(20),
                        $geometry: {
                            type: "Point",
                            coordinates: [ longitude, latitude ]
                        }
                    }
                }
            }
        )
        .populate(populate)
        
        //what will be sent
        const orders = {
            dropoffOrders: await getDropoffs,
            pickUpOrders: await getPickUps
        }

        res.status(200).send(orders)
    } catch (e) {
        res.status(400).send(e)
    }
})



/*
    Get Driver's Active orders
*/
orderR.get(
'/active_orders',
driverAuth,
async (req: Request<{}, {}, DriverAuthI>, res: Response) => {
    try {
        const { driver } = req.body

        //only return driver's active orders
        const activeOrders = await Order.find({
            '_id': { $in: driver.activeOrders }
        })
        .select({
            'orderFee': 0,
            'orderClose': 0,
            'orderFeePaid': 0,
            'orderTotal': 0,
            'serviceCost': 0,
            'userCard': 0
        })
        .populate([
            {
                path: 'client',
                model: 'User',
                select: {
                    'firstName': 1,
                    'lastName': 1,
                    'phoneNumber': 1
                }
            },
            {
                path: 'cleanerAddress',
                model: 'Address'
            },
            {
                path: 'cleaner',
                model: 'Cleaner',
                select: { 
                    'orders': 0 ,
                    'services': 0
                }
            },
            {
                path: 'origin',
                model: 'Address'
            }
        ])

        res.status(200).send(activeOrders)
    } catch(e) {
        res.status(400).send(e)
    }
})

/*
    Driver finds orders near them
*/
orderR.get(
'/find_orders', 
driverAuth, 
async (req: Request<{}, {}, FindOrdersDriveI>, res: Response) => {
    try {
        const { latitude, longitude, maxDistance } = req.body
        if(!validateGeo([latitude, longitude])) throw 'bad data: invalid geo location'
        //// validation ////
        //check req.body's properties
        if(!latitude || !longitude || !maxDistance) throw 'bad data: invalid body'

        const populate = [
            {
                path: 'desiredServices.service',
                model: 'Service'
            },
            {
                path: 'client',
                model: 'User',
                select: {
                    firstName: 1,
                    lastName: 1,
                    phoneNumber: 1,
                }
            },
            {
                path: 'cleaner',
                model: 'Cleaner',
                select: {
                    name: 1,
                    services: 1,
                    phoneNumber: 1,
                    website: 1,
                }
            },
            {
                path: 'origin',
                model: 'Address'
            },
            {
                path: 'cleanerAddress',
                model: 'Address'
            }
        ]

        //find nearby drop off requests
        const getDropoffs = Order
            .find({
                status: 'Task Posted Dropoff',
                'cleanerAddress.location': {
                    $near: {
                        $maxDistance: getMeters(maxDistance),
                        $geometry: {
                            type: "Point",
                            coordinates: [ longitude, latitude ]
                        }
                    }
                }
            })
            .populate(populate)
        //find nearby pick up requests
        const getPickUps = Order
        .find(
            {
                status: 'Task Posted Pickup',
                'origin.location': {
                    $near: {
                        $maxDistance: getMeters(20),
                        $geometry: {
                            type: "Point",
                            coordinates: [ longitude, latitude ]
                        }
                    }
                }
            }
        )
        .populate(populate)
        
        //what will be sent
        const orders = {
            dropoffOrders: await getDropoffs,
            pickUpOrders: await getPickUps
        }

        res.status(200).send(orders)
    } catch (e) {
        res.status(400).send(e)
    }
})

interface CreateOrderI extends DriverAuthI {
    userId: string
    cleanerId?: string
    originId: string
    desiredServices: desiredServicesI[]
}

orderR.post(
'/create_order/:userId',
driverAuth,
async (req: Request<{userId: string}, {}, CreateOrderI>, res: Response) => {
    try {
        const { userId } = req.params
        const {
            cleanerId,
            desiredServices,
            originId,
            driver
        } = req.body

        const user = await User.findById(userId)
        if(!user) throw 'invalid user'

        const cleaner = cleanerId 
            ? await Cleaner.findById(cleanerId)
            : undefined

        if(!!!cleanerId && !cleaner) {
            throw 'invalid cleaner Id'
        }

        if(desiredServices.length) {
            const validSvs = await servicesExist(
                desiredServices.map(svs => svs.service)
            )

            if(!validSvs) {
                throw 'invalid desired services'
            }
        }

        const order = new Order({
            client: user._id,
            userCard: user.preferredCardId,
            origin: user.pickupAddress,
            cleaner: cleaner ? cleaner._id : '',
            dropOffAddress: originId,
            cleanerAddress: cleaner ? cleaner.address : undefined,
            created: now(),
            status: 'Clothes to Cleaner',
            pickUpDriver: driver._id,
            desiredServices,
            createdBy: {
                userType: 'driver',
                userTypeId: driver._id
            }
        })

        await order.save()
            .then(o => {
                res.status(200).send(o)
            })
            .catch(e => {
                res.status(500).send(
                    e
                )
            })

        
    } catch (e) {
        res.status(400).send(e)
    }
})

/*
    Driver accepts order

    ** Driver location must be provided for tracking
*/
orderR.put(
'/accept_order/:orderId',
driverAuth,
async (req: Request<{ orderId: string }, {}, GeoDriverI>, res: Response) => {
    try {
        const { orderId } = req.params
        const { driver, longitude, latitude } = req.body
        //// validation ////
        if(!driver.passedBackgroundCheck) {
            res.status(401).send('background check not approved')
            return
        }
        const geo: coordinatesT = [ latitude, longitude ]
        if(!validateGeo(geo)) throw 'bad data: invalid geo location'

        const validOrderStatuses = [
            'Task Posted Pickup',
            'Task Posted Dropoff'
        ]
        //initailizing order data
        const order = await Order.findById(orderId)
        if(!order) throw 'bad data: invalid orderId'

        //cheking is actually posted
        if(!validOrderStatuses.includes(order.status)) throw 'order is not posted'

        //// updating order ////
        if(order.status === 'Task Posted Pickup') {
            order.pickUpDriver = driver._id
            order.status = 'Pickup Driver On the Way'
        } else { //if status is 'Task Posted Dropoff'
            order.dropOffDriver = driver._id
            order.status = 'Dropoff Driver On the Way'
        }
        //attach geo location to order
        order.driverLocation = {
            type: 'Point',
            coordinates: geo
        }

        //adding order to driver's data
        driver.orders.push(order._id)
        driver.activeOrders.push(order._id)

        //async: saving driver then adding to order
        //edit: be more specific on what's sent
        driver.save().then(() => {
            //async: saving order
            order.save().then(() => {
                res.status(200).send(order)
            }).catch(() => {
                res.status(500).send('driver saved but not added to order')
            })
        }).catch(() => {
            res.status(500).send('unable to save driver')
        })

    } catch(e) {
        res.status(400).send(e)
    }
})

/*
    Driver update order driver location

    //edit: if driver is less than a
    mile away update status to 'approaching'
*/
orderR.put(
'/update_tracking/:orderId',
driverAuth,
async (req: Request<{ orderId: string }, {}, GeoDriverI>, res: Response) => {
    try {
        const { orderId } = req.params
        const { driver, longitude, latitude } = req.body

        //// validation ////
        const geo: coordinatesT = [ latitude, longitude ]
        if(!validateGeo(geo)) throw 'bad data: invalid geo'

        // get and validate order
        const order = await Order.findById(orderId)
        if(!order) throw 'bad data: invalid order id'

        //is driver attached to order
        if(!order.isDropOff) { //if order is a pickup
            if(idToString(order.pickUpDriver ? order.pickUpDriver : '')[0] !== idToString(driver._id)[0]) throw (
                'driver not attached to this order'
            )
        } else { //if order is a dropoff
            if(idToString(order.dropOffDriver ? order.dropOffDriver : '')[0] !== idToString(driver._id)[0]) throw (
                'driver not attached to this order'
            )
        }

        //add geo location to order
        order.driverLocation = {
            type: 'Point',
            coordinates: geo
        }

        //save updated order
        order.save()
            .then(() => {
                res.status(200).send('driver location updated')
            })
            .catch((e) => {
                console.log(e.errors)
                res.status(500).send('was not able to update driver location')
            })
    } catch(e) {
        res.status(400).send(e)
    }
})

/*
    Driver cancel task

    ** Driver cannot cancel task 
    if already picked up clothes
*/
orderR.patch(
'/cancel/:orderId',
driverAuth,
async (req: Request<{ orderId: string }, {}, DriverAuthI>, res: Response) => {
    try {
        const { orderId } = req.params
        const { driver } = req.body

        const order = await Order.findById(orderId)
        
        //update driver
        driver.activeOrders = driver.activeOrders.filter(aOrder => {
            return aOrder.toString() !== orderId 
        })
        //removing order from driver's order
        const driveOrderStr = idToString(driver.orders)
        _.remove(driver.orders, (_order, x) => {
            return driveOrderStr[x] === orderId
        }) 

        //update order
        if(!order) throw 'bad data: could not find order'

        if(!order.isDropOff) {//if order is pickup
            if(idToString(order.pickUpDriver ? order.pickUpDriver : '')[0] !== idToString(driver._id)[0]) throw (
                'bad data: driver not attached to this order'
            )
            order.status = 'Task Posted Pickup'
            order.pickUpDriver = undefined
        } else { //if order is a dropoff
            if(idToString(order.dropOffDriver ? order.dropOffDriver : '')[0] !== idToString(driver._id)[0]) throw (
                'bad data: driver not attached to this order'
            )
            order.status = 'Task Posted Dropoff'
            order.dropOffDriver = undefined
        }

        //save driver then order
        driver.save().then(() => {
            //async: saving order
            order.save().then(() => {
                res.status(200).send(order)
            }).catch(() => {
                res.status(500).send('driver saved but not removed from order')
            })
        }).catch(() => {
            res.status(500).send('unable to save driver')
        })

    } catch(e) {
        res.status(400).send(e)
    }
})

/*
    Driver Picked up clothes
    from client

    //edit: might required more logic
*/
orderR.patch(
'/pickup_client/:orderId',
driverAuth,
async (req: Request<{ orderId: string }, {}, DriverAuthI>, res: Response) => {
    try {
        const { orderId } = req.params
        const { driver, isDriver } = req.body
        const order = await Order.findById(orderId)
        //valid order statuses
        const validStatuses = [
            'Pickup Driver On the Way',
            'Pickup Driver approaching'
        ]

        //is driver authorized to dor orders
        if(!isDriver) throw 'not authorzied to handle orders'

        if(!order) throw 'bad data: order does not exist'
        const orderDriver = order.pickUpDriver
        //is this a pick up order
        if(!validStatuses.includes(order.status)) throw (
            'invalid order status'
        )

        if(!orderDriver) throw 'bad data: order does not have a pick up driver'
        
        // is this driver a pickup driver
        if(orderDriver.toString() !== driver._id.toString()) throw (
            'Driver not attached to this order'
        )

        // order.status = 'Clothes to Cleaner'
        order.clientPickupTime = now()
        
        //edit: be more specific on what sent
        order.save()
            .then(() => {
                res.status(200).send(order)
            })
            .catch(() => {
                res.status(500).send(
                    'unable to save order picked up'
                )
            })
    } catch(e) {
        res.status(400).send(e)
    }
})

interface CleanerPickupI extends DriverAuthI {
    orders: string[] //orders picked
}

/* 
    Drive Pickup From Cleaners
*/
orderR.patch( 
'/pickup_cleaners/:cleanerId',
driverAuth,
async (req: Request<{ cleanerId: string }, {}, CleanerPickupI>, res: Response) => {
    try {
        const { cleanerId } = req.params
        const {
            orders,
            driver
        } = req.body

        //get cleaners for cleanerId
        const cleaner = await Cleaner.findById(cleanerId)
        if(!cleaner) throw (
            'unable to find cleaner'
        )
        
        //get orders that are getting picked up
        const pickups = await Order.find({
            '_id': { $in: stringToId(orders) }
        })
        if(!pickups) throw 'bad data: invalid order id'

        //loop throw and update each order
        for(const order of pickups) {
            //is this cleaner attached to this order
            if(!isMatchingIds(order.cleaner, cleanerId)) throw (
                `orderId: ${ order._id } is not with this cleaner`
            )

            order.status = 'Picked Up From Cleaner'
            order.cleanerPickupTime = now()

            order.save()
        }

        //remove cleaners from active orders 
        cleaner.activeOrders = _.filter(cleaner.activeOrders, (clnOrder) => {
            return !orders.includes(clnOrder.toString())
        })

        driver.activeOrders.push(...stringToId(orders))

        driver.save()
        cleaner.save()

        res.status(200).send(pickups)
    } catch(e) {
        res.status(400).send(e)
    }
})

/*
    Drop off driver on the way
*/
orderR.patch(
'/on_the_way/:orderId',
driverAuth,
async (req: Request<{ orderId: string }, {}, DriverAuthI>, res: Response) => {
    try {
        const { orderId } = req.params
        const { driver } = req.body

        const validStatuses = [
            'Picked Up From Cleaner',
        ]

        const order = await Order.findById(orderId)
        if(!order) throw 'bad data: invalid order id'
        if(!validStatuses.includes(order.status)) throw (
            'order not ready for this action'
        )
        if(!order.dropOffDriver) {
            res.status(500).send(
                'driver supposed to be attached at this status'
            )
            return
        }
        if(!isMatchingIds(order.dropOffDriver, driver._id)) {
            res.status(401).send('not drive to this order')
            return
        }

        order.status = 'Clothes to Home'

        order.save()

        res.status(200).send(order)
    } catch(e) {
        res.status(400).send(e)
    }
})

/*
    Driver drop's of clothes
*/
orderR.patch(
'/clothes_dropoff/:orderId',
driverAuth,
async (req: Request<{ orderId: string }, {}, DriverAuthI>, res: Response) => {
    try {
        const { orderId } = req.params
        const { driver } = req.body

        const validStatuses = [
            'Picked Up From Cleaner',
            'Clothes to Home',
            'Dropoff Driver approaching'
        ]
        
        /// get and validate order ///
        const order = await Order.findById(orderId)
        if(!order) throw 'bad data: invalid order id'
        if(!order.dropOffDriver) {
            res.status(500).send("drop off drive doesn't exist")
            return
        }
        //is driver attached to this order
        if(!isMatchingIds(order.dropOffDriver, driver._id)) throw (
            'driver not attached to order'
        )
        if(!validStatuses.includes(order.status)) throw (
            'order not ready for dropoff'
        )
    
        //remove driver from active orders 
        driver.activeOrders = _.filter(driver.activeOrders, (drOrder) => {
            return !idToString(drOrder).includes(orderId)
        })

    
        order.status = 'Complete'
        order.clientDropoffTime = now()
        order.orderClosed = true
    
        order.save()
        driver.save()
    
        res.status(200).send(order)
    } catch(e) {
        res.status(400).send(e)
    }
})

export default orderR