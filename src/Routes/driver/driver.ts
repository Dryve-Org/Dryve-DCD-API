import express, { Request, Response } from 'express'
import { coordinatesT, getMeters, validateGeo } from '../../constants/location'
import { auth, authBodyI, driverAuth, DriverAuthI } from '../../middleware/auth'
import Driver from '../../Models/driver.model'
import Order from '../../Models/Order.model'
import { GeoDriverI } from './interface'
import bcrypt from 'bcrypt'
import User from '../../Models/user.model'

const driverR = express.Router()

interface DriverLoginI {
    username: string,
    password: string
}

driverR.post(
'/login',
async (req: Request<{}, {}, DriverLoginI>, res: Response) => {
    try {
        const genericError = "Invalid email or password"
        const { username, password } = req.body

        //finding user with this email
        const user = await User.findOne({ email: username })
        if(!user) {
            res.status(401).send(genericError)
            return
        }
        
        //is password valid
        const validPassword = await bcrypt.compare(password, user.password)
        if(!validPassword) {
            res.status(401).send(genericError)
            
            return
        }

        const driver = await Driver.findOne({
            user: { _id: user._id }
        })
        if(!driver) {
            res.status(401).send('not authorized')
            return
        }

        //generating token
        const token = await user.generateAuthToken()
        
        res.send(token)
    } catch(e) {
        res.status(500).send('something went wrong')
    }
})

interface postDriverI extends authBodyI {
    lastFour: Number
}

/*
    User Creating a driver profile

    ** This does not mean they're authorized to drive
    ** Must go through background
    ** Must sign a W-9 Tax document
*/
driverR.post('/', auth, async (req: Request<{}, {}, postDriverI>, res: Response) => {
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
driverR.put('/update', driverAuth, async (req: Request<{}, {}, PutDriveI>, res: Response) => {
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
driverR.get(
'/', 
driverAuth, 
async (req: Request<{}, {}, DriverAuthI>, res: Response) => {
    try {
        const { driver } = req.body

        const driverData = await driver
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
        res.status(500).send(e)
    }
})

interface FindOrdersDriveI extends DriverAuthI{
    latitude: number
    longitude: number
    maxDistance: number //orders within this range in miles
}


/* 
    Updating the driver's location and
    it's active order's location. 
*/
driverR.put(
'/update_geo',
driverAuth,
async (req: Request<{}, {}, GeoDriverI>, res: Response) => {
    try {
        const { 
            latitude,
            longitude,
            driver
        } = req.body

        const point = [ longitude, latitude ] as coordinatesT

        if(!validateGeo(point)) {
            throw {
                status: 400,
                send: 'invalid geo location'
            }
        }
        
        const { activeOrders } = driver


        /* 
            edit: update this section to run driver
            and order at the same time
        */
        driver.location = {
            type: 'Point',
            coordinates: point
        }

        await driver.save()
            .catch(() => {
                throw {
                    status: 403,
                    send: 'unable to update location'
                }
            })

        await Order.updateMany(
            {
                _id: { '$in': activeOrders },
            },
            {
                driverLoaction: {
                    type: 'Point',
                    coordinates: point
                }
            }
        )
        .then(() => {
            res.status(200).send('geo location updated')
        })
        .catch(() => {
            throw {
                status: 403,
                send: 'unable to update location'
            }
        })

        return
    } catch(e: any) { //edit: fix this any
        res.status(e.status).send(e.send)
    }
})

export default driverR