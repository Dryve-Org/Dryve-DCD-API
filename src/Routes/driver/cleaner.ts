import express, { Request, Response } from 'express'
import { getCleanerById } from '../../constants/cleaner'
import { idToString } from '../../constants/general'
import { coordinatesT, getMeters, validateGeo } from '../../constants/location'
import { now } from '../../constants/time'
import { driverAuth, DriverAuthI } from '../../middleware/auth'
import { AptDocT } from '../../Models/aparmtent/apartment.model'
import Cleaner from '../../Models/cleaner.model'
import { DriveModelT, DriverI } from '../../Models/driver.model'
import Order, { OrderstatusT } from '../../Models/Order.model'
import { driverCleanerPopulate, driverCleanerSelect, driverOrderPopulate, driverOrderSelect } from './constants'

const cleanerR = express.Router()

interface DriverLocI extends DriverI {
    latitude: number
    longitude: number
    maxDistance: number
}

cleanerR.get(
'/cleaner/:clnId',
driverAuth,
async (req: Request<{ clnId: string }, {}, DriverAuthI>, res: Response) => {
    try {
        const { clnId } = req.params

        const cleaner = await Cleaner.findById(clnId)
            .select(driverCleanerSelect)
            .populate(driverCleanerPopulate)

        res.status(200).send(cleaner)
    } catch(e) {
        res.status(400).send(e)
    }
})

interface GetCleaners extends DriverAuthI {
    masterId: string
}

cleanerR.get(
'/cleaners',
driverAuth,
async (req: Request<{}, {}, GetCleaners>, res: Response) => {
    try {
        const { 
            masterId,
            driver 
        } = req.body

        const cleaners = await driver.cleaners(masterId ? masterId : undefined)

        res.status(200).send(cleaners)
    } catch(e: any) {
        if(e.status && e.message) {
            res.status(e.status).send(e.message)
        } else {
            res.status(500).send('unable to get cleaners')
        }
    }
})

cleanerR.post(
'/nearby_cleaners',
driverAuth,
async (req: Request<{}, {}, DriverLocI>, res: Response) => {
    try {
        const { 
            latitude,
            longitude,
            maxDistance
        } = req.body
        if(!latitude || !longitude || !maxDistance) throw 'bad data: invalid body'
        if(!validateGeo([latitude, longitude])) throw 'bad data: invalid geo location'

        const cleaners = await Cleaner.find({
            'address.location': {
                $near: {
                    $maxDistance: getMeters(maxDistance),
                    $geometry: {
                        type: 'Point',
                        coordinates: [ longitude, latitude ]
                    }
                }
            }
        })
        .lean()
        .populate({
            path: 'address',
            model: 'Address'
        })
        .select({
            orders: 0,
            
        })

        res.status(200).send(cleaners)
    } catch(e) {
        res.status(400).send(e)
    }
})

interface DropOrdersI extends DriverAuthI {
    orderIds: string[]
}

/* This is a post request that is used to drop off orders to a cleaner. */
cleanerR.post(
'/cleaner/:clnId/drop_off',
driverAuth,
async (req: Request<{clnId: string}, {}, DropOrdersI>, res: Response) => {
    try {
        const { clnId } = req.params
        const { orderIds, driver } = req.body
        
        if(!orderIds.length) throw 'invalid body'

        const cln = await getCleanerById(clnId)
        const orders = await Order.find({
            _id: { $in: orderIds }
        })
        .populate('apartment')

        const validStatus: OrderstatusT[] = [
            "Clothes To Cleaner"
        ]

        for(let order of orders) {
            /* Checking if the apartment is attached to the cleaner. */
            const apt = order.apartment as unknown as AptDocT
            if(!validStatus.includes(order.status)) {
                throw `order "${order.id}" has a status of ${order.status}`
            }

            if(!order.pickUpDriver) throw `This Driver is not the pick up driver`

            /* This is checking if the driver is authorized to handle the order. */
            if(
                !idToString(driver.activeOrders)
                    .includes(order._id.toString())
            ) {
                throw `This Driver is not authorized to handle order ${ order.id }`
            }

            order.addEvent(
                'driver',
                'Driver dropped off clothes at cleaner',
                'driver',
                driver._id
            )
        }

        /* Updating the orders with the cleaner id and cleaner address. */
        await Order.updateMany(
            {'_id': { $in: orderIds } },
            {
                cleaner: cln._id,
                cleanerAddress: cln.address,
                cleanerDropOffTime: now(),
                status: 'Clothes Awaiting Pricing'
            }
        )
        
        cln.addActiveOrders(orderIds)

        driver.removeActiveOrders(orderIds)

        res.status(200).send(orders)
    } catch(e) {
        res.status(400).send(e)
    }
})

/**
 * Get Actives order of cleaner
*/
cleanerR.get(
'/cleaner/:clnId/active_orders',
driverAuth,
async (req: Request<{ clnId: string }, {}, DriverAuthI>, res: Response) => {
    try {
        const { clnId } = req.params

        const cleaner = await Cleaner.findById(clnId)
            .select(driverCleanerSelect)
            .populate(driverCleanerPopulate)
            .catch(() => { 
                throw 'invalid cleaner Id'
            })
        
        if(!cleaner) throw 'invalid cleaner Id'

        const activeOrders = cleaner.activeOrders

        res.status(200).send(activeOrders)
    } catch(e) {
        res.status(400).send(e)
    }
})

/**
 * Get Actives order of cleaner
*/
cleanerR.get(
'/cleaner/:clnId/pickups',
driverAuth,
async (req: Request<{ clnId: string }, {}, DriverAuthI>, res: Response) => {
    try {
        const { clnId } = req.params

        const cleaner = await Cleaner.findById(clnId)
            .select(driverCleanerSelect)
            .populate(driverCleanerPopulate)
        
        if(!cleaner) throw 'invalid cleaner Id'

        const readyOrders = cleaner.activeOrders.filter(order => {
            // @ts-ignore
            return order.isDropOff
        })

        res.status(200).send(readyOrders)
    } catch(e) {
        res.status(400).send(e)
    }
})

export default cleanerR