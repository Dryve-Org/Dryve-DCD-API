import express, { Response, Request } from 'express'
import { activeOrdersIds } from '../../constants/clientHandler'
import { handleDesiredServices, idToString } from '../../constants/general'
import { getDistanceById } from '../../constants/location'
import { reteiveCard } from '../../constants/moneyHandling'
import { now } from '../../constants/time'
import { addressExist } from '../../constants/validation'
import { auth, authBodyI } from '../../middleware/auth'
import Cleaner from '../../Models/cleaner.model'
import Order from '../../Models/Order.model'

const orderR = express.Router()

interface PostOrderBody extends authBodyI {
    originId: string,
    pickupAddress: string
    cardId: string // user card id
    toCleanerDistance: number //in miles ex. 1.23
    fromCleanerDistance: number
    cleanerId: string
    clientId: string
    pickUpDriver?: string
    dropOffDriver?: string
    desiredServices: {
        weight: number,
        quantity: number,
        service: string //stored prices of each service
    }[]
    created: number
    dropOffAddress?: string
}

/*
    get active orders
*/
orderR.get(
'/active_orders',
auth,
async (req: Request<{ cleanerId: string }, {}, authBodyI>, res: Response) => {
    try {
        const { user } = req.body

        const activeOrders = await activeOrdersIds(user.orders)

        res.status(200).send(activeOrders)
    } catch(e) {
        res.status(400).send(e)
    }
})

export default orderR