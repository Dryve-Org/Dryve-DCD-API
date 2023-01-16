import express, { Response, Request } from 'express'
import { stringToId } from '../../constants/general'
import { getMeters, validateGeo } from '../../constants/location'
import { auth, authBodyI } from '../../middleware/auth'
import Cleaner from '../../Models/cleaner.model'

const cleanerR = express.Router()

/*
    get Cleaner information
*/
cleanerR.get(
'/cleaner/:cleanerId',
auth,
async (req: Request<{ cleanerId: string }, {}, authBodyI>, res: Response) => {
    try {
        const { cleanerId } = req.params
        const { user } = req.body

        //retreive cleaner by id
        const cleaner = await Cleaner.findById(cleanerId)
        .lean()
        .select({
            'paymentMethod': 0,
            'stripeId': 0,
            'activeOrders': 0,
            'orders': 0
        })
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
        //cleaner failed
        if(!cleaner) throw 'invalid cleaner id'

        res.status(200).send({
            ...cleaner,
            preferred: cleanerId === user.preferredCleaner?.toString()
        })
    } catch(e) {
        res.status(400).send(e)
    }
})

/*
    Cleaners Nearby
*/
interface authLocationI extends authBodyI{
    latitude: number
    longitude: number
    maxDistance: number //orders within this range in miles
}

cleanerR.post(
'/cleaners_nearby',
auth,
async (req: Request<{}, {}, authLocationI>, res: Response) => {
    try {
        const { 
            maxDistance,
            latitude,
            longitude,
            user
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
            activeOrders: 0,
            orders: 0,
            '__v': 0
        })

        //return nearby cleaner with preferred included
        //preferred: is this the user's preferred cleaner
        const withPreferred = cleaners.map(cln => (
            {
                ...cln, 
                preferred: cln._id.toString() === user.preferredCleaner?.toString()
            }
        ))

        res.status(200).send(withPreferred)
    } catch(e) {
        res.status(400).send(e)
    }
})

/*
    set preferred cleaner
*/
cleanerR.put(
'/preferred_cleaner/:cleanerId',
auth,
async (req: Request<{ cleanerId: string }, {}, authBodyI>, res: Response) => {
    try {
        const { cleanerId } = req.params
        const { user } = req.body

        //checking if cleaner exists
        const cleaner = await Cleaner.exists({ _id: cleanerId})
        if(!cleaner?._id || !cleaner) throw 'invalid cleaner id'

        //adding attaching to user
        user.preferredCleaner = stringToId(cleanerId)[0]

        await user.save().catch(() => {
            res.status(500).send('unable to save preferred cleaner')
        })

        res.status(200).send('updated preferred cleaner')
    } catch(e) {
        res.status(400).send(e)
    }
})

export default cleanerR