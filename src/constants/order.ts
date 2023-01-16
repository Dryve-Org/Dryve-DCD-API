import { Query, Types } from "mongoose"
import Order from "../Models/Order.model"


/**
 * It gets an order by its id, and if it doesn't exist, it throws an error.
 * @param {string} orderId - string
 * @returns The order object
*/
export const getOrderById = async (orderId: string | Types.ObjectId, populate?: any) => {
    const order = await Order.findById(orderId)
        .populate(populate)
        .catch(() => {
            throw 'invalid order Id'
        })
    if(!order) throw 'invalid order Id'

    return order
}