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
        quantity: number,
        service: string //stored prices of each service
    }[]
    created: number
    dropOffAddress?: string
}

/*
    Client Create order
*/
orderR.post('/request_pickup', auth, async (req: Request<{}, {}, PostOrderBody>, res: Response) => {
    try {
        //// initializing needed from body ////
        const {
            cardId,
            cleanerId,
            desiredServices,
            originId,
            user,
            pickupAddress,
            dropOffAddress
        } = req.body
        //// quick validation ////
        if(!desiredServices.length) throw 'bad data: desiredServices'

        if(!idToString(user.pickUpAddresses).includes(pickupAddress)) {
            throw 'pick up address does not exist'
        }

        //does user have active orders
        if((await activeOrdersIds(user.orders)).length) {
            res.status(403).send('cannot have more than one active order')
            return
        }

        //validate provided addresses
        const origin = await addressExist(pickupAddress)
        if(!origin) throw 'pickup address is not attached to user'

        if(dropOffAddress) {
            if(!idToString(user.pickUpAddresses).includes(dropOffAddress)) {
                throw 'dropoff address does not exist'
            }
            const validDropOff = await addressExist(dropOffAddress)
            if(!validDropOff) throw 'invalid dropOff Id'
        }

        //validate cleaner
        //edit: is this cleaner less than 25 miles away
        const cleaner = await Cleaner.findById(cleanerId)
        if(!cleaner) throw 'cleaner does not exist'

        //validate card
        const card = await reteiveCard(cardId)
            .catch(e => {
                throw {
                    statusCode: e.statusCode,
                    message: "bad data: invalid card"
                }
            })
        
        //retreive order fee
        const orderFeeCost: number = 500 //edit: this will come from the database

        //calculate service requested
        const { total } = await handleDesiredServices(desiredServices)

        const toCleaner = getDistanceById(pickupAddress, cleaner.address)
        const fromCleaner = getDistanceById(
            cleaner.address, 
            dropOffAddress ? dropOffAddress : pickupAddress
        )
        
        //initializing and setting order data
        const order = new Order({
            client: user._id,
            origin: pickupAddress,
            cleaner: cleanerId,
            cleanerAddress: cleaner.address,
            toCleanerDistance: (await toCleaner).distance,
            fromCleanerDistance: (await fromCleaner).distance,
            dropOffAddress,
            isDropOff: false,
            orderTotal: total,
            userCard: cardId,
            orderFeePaid: false,
            created: now(),
            status: 'Task Posted Pickup',
            desiredServices,
            createdBy: {
                userType: 'client',
                userTypeId: user._id
            }
        })

        // add order id to user
        if(user.orders){
            user.orders.push(order._id)
        } else {
            user.orders = [ order._id ]
        }
        
        //add order to cleaner profile
        cleaner.activeOrders.push(order._id)
        cleaner.orders.push(order._id)    

        await order.save()
            .catch((e) => {
                console.log(e)
                res.status(400).send('unable to save order')
                throw ''
            })
        
        user.save()
            .catch(e => {
                console.log(e)
            })

        //async update cleaner
        cleaner.save()
            .catch(e => {
                console.log(e)
            })

        res.send(order)
    } catch (e: any) {
        res.status(400).send(e)
    }
})

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