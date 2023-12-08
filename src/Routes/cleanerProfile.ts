import { Response, Request, Router } from 'express'
import _ from 'lodash'
import { idToString, stringToId } from '../constants/general'
import { now } from '../constants/time'
import { cleanersExist, userExist } from '../constants/validation'
import { cleanerProAuth, CleanerProAuthI, cleanerProManagerAuth, cleanerProManagerAuthI } from '../middleware/auth'
import Address from '../Models/address.model'
import Cleaner from '../Models/cleaner.model'
import CleanerProfile, { CleanerProfileI } from '../Models/cleanerProfile.model'
import Driver from '../Models/driver.model'
import Order from '../Models/Order.model'

const cleanerProRouter = Router()

interface PostCleanerProI extends CleanerProAuthI { //will be auth manager
    attachedstores: string[]
    profileId: string
}

/*
    Create cleaner profile

    Owner of the cleaner or manager should
    be able to create cleaner profiles. This 
    is for the owners
*/
cleanerProRouter.post(
'/profile/create', 
cleanerProAuth, 
async (req: Request<{}, {}, PostCleanerProI>, res: Response) => {
    try {
        const {
            attachedstores,
            cleanerPro,
            profileId,
            ownerOf
        } = req.body
        /* 
            if attachedCleaner had any id 
            that did not match ownerOf,
            this will throw an error
        */
        if(_.difference(attachedstores, idToString(ownerOf)).length) {
            res.status(401).send('Cleaner profile is not authorized')
            return
        }

        //checking if attached cleaners exist
        if(!await cleanersExist(attachedstores)) {
            res.status(400).send('unable to find attached cleaners')
            return
        }

        //checking profile id
        if(!await userExist(profileId)) throw 'unable to find profile Id'
        
        const cleanerProfile = new CleanerProfile({
            user: profileId,
            attachedCleaners: stringToId(attachedstores)
        })

        cleanerProfile.save()

        res.status(200).send(cleanerProfile)
    } catch (e: any) {
        res.status(400).send(e)
    }
})

/*
    Get active orders of cleaner
*/
cleanerProRouter.get(
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
            .select('activeOrders')
            .populate({
                path: 'activeOrders',
                populate: [
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
                        path: 'pickUpDriver',
                        model: 'Driver',
                        select: { 'user': 1 },
                        populate: {
                            path: 'user',
                            model: 'User',
                            select: {
                                'firstName': 1,
                                'lastName': 1,
                                'phoneNumber': 1
                            }
                        }
                    }
                ],
                select: {
                    'orderFee': 0,
                    'orderFeePaid': 0,
                    'origin': 0,
                    'userCard': 0
                }
            })
            .exec()

        if(!cleaner) throw 'invalid cleaner id'


        res.status(200).send(cleaner.activeOrders)
    } catch(e) {
        res.status(400).send(e)
    }
})

/*
    get order by order id
    with valid authorization
    to view order
*/
cleanerProRouter.get(
'/order/:orderId',
cleanerProAuth,
async (req: Request<{orderId: string}, {}, CleanerProAuthI>, res: Response) => {
    try {
        const { orderId } = req.params
        const { attachedCleaners } = req.body

        const order = await Order.findById(orderId)
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
                    path: 'desiredServices.service',
                    model: 'Service'
                },
                {
                    path: 'pickUpDriver',
                    model: 'Driver',
                    select: { 'user': 1 },
                    populate: {
                        path: 'user',
                        model: 'User',
                        select: {
                            'firstName': 1,
                            'lastName': 1,
                            'phoneNumber': 1
                        }
                    }
                }
            ])
            .select({
                'orderFee': 0,
                'userCard': 0,
                'orderFeePaid': 0,
                'origin': 0,
            })
        if(!order) throw 'invalid order id'
        if(!order.cleaner) {
            res.status(403).send(
                'order has no cleaner'
            )
        }

        /*
            does cleanerPro attached to cleaner
            in this order.
        */
        if(
            !idToString(attachedCleaners)
                .includes(order.cleaner.toString())
        ) {
            res
                .status(403)
                .send('not authorized to see this order')
        }


        res.status(200).send(order)
    } catch(e) {
        res.status(400).send(e)
    }
})

/*
    get cleaner data
*/
cleanerProRouter.get(
'/cleaner/:cleanerId',
cleanerProAuth,
async (req: Request<{ cleanerId: string } ,{}, CleanerProAuthI>, res: Response) => {
    try {
        const { cleanerId } = req.params
        const { attachedCleaners } = req.body

        console.log('idToString(attachedCleaners): ', idToString(attachedCleaners).includes(cleanerId))

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
cleanerProRouter.get(
'/attached_cleaners',
cleanerProAuth,
async (req: Request<{}, {}, CleanerProAuthI>, res: Response) => {
    try {
        const { attachedCleaners } = req.body
        
        const cleaners = await Cleaner.find({
            _id: {'$in': attachedCleaners} 
        }).populate([
            {
                path: 'address',
                model: 'Address'
            },
            {
                path: 'services',
                model: 'Service'
            }
        ])

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
    Cleaner Approves Dropoff

    doesn't have to be an owner 
    to approve an order
*/
cleanerProRouter.patch(
'/approve_dropoff/:orderId',
cleanerProAuth,
async (req: Request<{ orderId: string }, {}, CleanerProAuthI>, res: Response) => {
    try {
        const { orderId } = req.params
        const { attachedCleaners } = req.body

        const order = await Order.findById(orderId)
        if(!order) throw "Can't find order"

        const driver = await Driver.findById(order.pickUpDriver)
        if(!driver) {
            res.status(500).send(`Can't find driver`)
            return
        }

        //is cleaner profile able to handle this order
        if(!idToString(attachedCleaners).includes(order.cleaner.toString())) {
            res.status(401).send("Order at the wrong cleaner")
            return
        }

        //updating order
        order.status = 'Clothes Awaiting Clean'
        order.cleanerDropOffTime = now()

        //update driver
        driver.activeOrders = driver.activeOrders.filter(aOrder => {
            return aOrder.toString() !== orderId
        })

        //edit: driver should get paid here

        order.save()
        driver.save()

        res.status(200).send('Drop off approved')
    } catch(e) {
        res.status(400).send(e)
    }
})

/*
    CleanerPro: clothes are cleaned
*/
cleanerProRouter.patch(
'/clothes_cleaned/:orderId',
cleanerProAuth,
async (req: Request<{ orderId: string }, {}, CleanerProAuthI>, res: Response) => {
    try {
        const { orderId } = req.params
        const { attachedCleaners } = req.body
        const validStatuses = [
            'Clothes Awaiting Clean',
            'Clothes Ready'
        ]

        

        const order = await Order.findById(orderId)
        if(!order) throw 'bad data: invalid order id'
        if(!validStatuses.includes(order.status)) throw (
            'order not read for this action'
        )
        
        //can cleaner profile hand this order
        if(!idToString(attachedCleaners).includes(order.cleaner.toString())) {
            res.status(401).send("Can't handle this order")
            return
        }

        order.status = 'Clothes Ready'
        order.cleanFinishTime = now()

        order.save()
            .then(() => {
                res.status(200).send('clothes are now ready')
            })
            .catch(() => {
                res.status(500).send(
                    'unable to update order to clothes ready'
                )
            })
    } catch(e) {
        res.status(400).send(e)
    }
})

/*
    CleanerPro: clothes ready for dropoff
*/
cleanerProRouter.patch(
'/dropoff_ready/:orderId',
cleanerProAuth,
async (req: Request<{ orderId: string }, {}, CleanerProAuthI>, res: Response) => {
    try {
        const { orderId } = req.params
        const { attachedCleaners } = req.body
        const validStatuses = [
            'Clothes Awaiting Clean',
            'Clothes Ready'
        ]

        
        const order = await Order.findById(orderId)
        if(!order) throw 'bad data: invalid order id'
        if(!validStatuses.includes(order.status)) throw (
            'order not read for this action'
        )
        if(!idToString(attachedCleaners).includes(order.cleaner.toString())) {
            res.status(401).send("Can't handle this order")
            return
        }
        
        order.isDropOff = true
        order.status = 'Task Posted Dropoff'
        order.cleanFinishTime = now()

        order.save()
            .then(() => {
                res.status(200).send(
                    'clothes are now ready for drop off'
                )
            })
            .catch(() => {
                res.status(500).send(
                    'unable to update order to clothes ready'
                )
            })
    } catch(e) {
        res.status(400).send(e)
    }
})

export default cleanerProRouter