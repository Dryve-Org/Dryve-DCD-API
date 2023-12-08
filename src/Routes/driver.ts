/*
    file is no longer need because of 
    driver folder. Will delete when 
    driver folder is fully tested.
*/

import { Router, Request, Response } from 'express'
import _ from 'lodash'
import { isValidObjectId } from 'mongoose'
import { idToString, stringToId } from '../constants/general'
import { coordinatesT, getMeters, validateGeo } from '../constants/location'
import { now } from '../constants/time'
import { isMatchingIds } from '../constants/validation'
import { auth, authBodyI, driverAuth, DriverAuthI } from '../middleware/auth'
import Cleaner from '../Models/cleaner.model'
import Driver, { DriverI } from '../Models/driver.model'
import Order from '../Models/Order.model'
import User, { UserI } from '../Models/user.model'

const driverRouter = Router()

interface postDriverI extends authBodyI {
    lastFour: Number
}

/*
    User Creating a driver profile

    ** This does not mean they're authorized to drive
    ** Must go through background
    ** Must sign a W-9 Tax document
*/
driverRouter.post('/', auth, async (req: Request<{}, {}, postDriverI>, res: Response) => {
    try {
        const { _id, lastFour } = req.body

        //// Validation ///
        //Is this user already a driver
        const driverData = Driver.findOne({ user: _id})
        if(await driverData) res.status(401).send("driver profile already exists")
        if(!lastFour) throw 'last four of social required'

        /// initializing and setting ///
        const driver = new Driver({
            user: _id,
            lastFour
        })

        //async: store new driver
        driver.save()
            .then(() => {
                res.status(200).send(driver)
            })
            .catch(() => {
                res.status(500).send('was not able store new driver')
            })
    } catch(e) {
        res.status(400).send(e)
    }
})

interface PutDriveI extends DriverAuthI {
    lastFour: number
    
}

/* 
    Update Driver Information
*/
driverRouter.put('/update', driverAuth, async (req: Request<{}, {}, PutDriveI>, res: Response) => {
    try {
        const { driver } = req.body
        //valid properties from req.body
        const validKeys = [
            "lastFour",
            "bankRoutingNumber",
            "bankAccountNumber"
        ]

        //initializing error handling
        const err: any = {}

        /*
            checking if keys provided in body are
            valid.

            just testing it out. not sure if this is
            truly needed. Keeping just in case.
        */
        Object.keys(req.body).forEach(providedKey => {
            if(['token', '_id', 'driver'].includes(providedKey)) return
            if(!validKeys.includes(providedKey)) {
                err[providedKey] = "not a valid key"
                return
            }

            // @ts-ignore
            driver[providedKey] = req.body[providedKey]
        })

        //if errors exist throw with errors
        if(Object.keys(err).length) {
            err.validKeys = validKeys
            throw err
        }
        
        //async: saving driver data
        driver.save()
            .then(() => {
                res.status(200).send(driver)
            })
            .catch(() => {
                res.status(500).send('unable to update driver')
            })
    } catch(e) {
        res.status(400).send(e)
    }
})


/*
    Driver retreives their own
    driver information
*/
driverRouter.get(
'/', 
driverAuth, 
async (req: Request<{}, {}, DriverAuthI>, res: Response) => {
    try {
        const { driver } = req.body

        const driverData = driver
            .populate({
                path: 'user',
                model: 'User',
                select: {
                    'stripeId': 0,
                    'token': 0,
                    'orders': 0,
                    'preferredCleaner': 0,
                    'cards': 0,
                    'password': 0
                }
            })

        res.send(driverData)
    } catch (e) {
        res.send(e)
    }
})

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
driverRouter.get(
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

interface GeoDriverI extends DriverAuthI{
    latitude: number
    longitude: number
}

/*
    Get Driver's Active orders
*/
driverRouter.get(
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
    Driver accepts order

    ** Driver location must be provided for tracking
*/
driverRouter.put(
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
driverRouter.put(
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
driverRouter.patch(
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
driverRouter.patch(
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
driverRouter.patch( 
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
driverRouter.patch(
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
driverRouter.patch(
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

export default driverRouter
