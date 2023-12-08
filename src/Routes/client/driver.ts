import express, { Response, Request } from 'express'
import { auth, authBodyI } from '../../middleware/auth'
import Order from '../../Models/Order.model'

const driverR = express.Router()

/*
    Client Track Driver
*/
driverR.get(
'/track_driver/:orderId',
auth,
async (req: Request<{ orderId: string }, {}, authBodyI>, res: Response) => {
    try {
        const { orderId } = req.params
        const { user } = req.body
        const validStatuses = [
            'Pickup Driver On the Way',
            'Pickup Driver approaching',
            'Clothes to Home'
        ]

        /// retrieve and validate order ///
        const order = await Order.findById(orderId)
        if(!order) throw 'invalid order id'

        //is this the client to this order
        if(order.client.toString() !== user._id.toString()) throw (
            'user not attached to this order'
        )

        //can user track this order
        if(!validStatuses.includes(order.status)) {
            res.status(401).send('user cannot track order at this time')
            return
        }

        if(!order.driverLocation) {
            res.status(200).send([])
            return
        }

        res.status(200).send(order.driverLocation.coordinates)
    } catch(e) {
        res.status(400).send(e)
    }
})

export default driverR