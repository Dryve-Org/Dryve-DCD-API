import mongoose, { Types } from 'mongoose'
import Order from '../Models/Order.model'



/**
 * It takes an array of orderIds, and returns an array of orders that are not closed, and have the
 * desiredServices.service populated, and the pickUpDriver and dropOffDriver populated with the user's
 * firstName, lastName, phoneNumber, and _id.
 * @param {string[] | Types.ObjectId[]} orderIds - string[] | Types.ObjectId[]
 * @returns An array of orders.
*/
export const activeOrdersIds = async (orderIds: string[] | Types.ObjectId[]) => {
    try {
        const driverPopulate = {
            model: 'Driver',
            select: {
                user: 1
            },
            populate: {
                path: 'user',
                model: 'User',
                select: {
                    firstName: 1,
                    lastName: 1,
                    phoneNumber: 1,
                    '_id': 0
                }
            }
        }

        const orders = await Order.find({
            '_id': {'$in': orderIds.map(ids => ids.toString())},
            'orderClosed': false
        })
        .populate([
            {
                path: 'desiredServices.service',
                model: 'Service'
            },
            {
                path: 'pickUpDriver',
                ...driverPopulate
            },
            {
                path: 'dropOffDriver',
                ...driverPopulate
            }
        ])

        return orders
    } catch {
        return []
    }
}