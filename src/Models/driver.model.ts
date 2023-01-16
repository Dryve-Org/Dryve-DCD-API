import { Schema, model, Types, Document, Model } from 'mongoose'
import { MongooseFindByReference } from 'mongoose-find-by-reference';
import { idToString } from '../constants/general';
import Order, { OrderDocT } from './Order.model';
import { PointI, PointSchema } from './point.models'

export type DriverDocT = Document<unknown, any, DriverI> & DriverI & {
    _id: Types.ObjectId;
}


export interface DriverI {
    _id: Types.ObjectId
    user: Types.ObjectId
    lastFour?: number
    passedBackgroundCheck: boolean
    bankRoutingNumber?: string
    bankAccountNumber?: string
    orders: Types.ObjectId[]
    totalPayout?: number //in cents
    activeOrders: Types.ObjectId[]
    location: PointI
}

export interface DriverMethodsI {
    getActiveOrders(): Promise<OrderDocT[]>

    /**
     * Remove Active Orders
     * @param {string[] | Types.ObjectId[]} orderIds
    */
    removeActiveOrders(
        orderIds: string[] | Types.ObjectId[]
    ): Promise<DriverDocT>

    /**
     * Remove Active Order
     * @param {string | Types.ObjectId} orderId
    */
    removeActiveOrder<DriverDocT>(
        orderId: string | Types.ObjectId
    ): Promise<DriverDocT>

    /**
     * Add Active Orders
     * @param {string[] | Types.ObjectId[]} orderIds
    */
    addActiveOrders(
        orderIds: string[] | Types.ObjectId[]
    ): Promise<DriverDocT[]>

    /**
     * Add Active Order
     * @param {string | Types.ObjectId} orderId
    */
    addActiveOrder(
        orderId: string | Types.ObjectId
    ): Promise<DriverDocT>
}

export type DriveModelT = Model<DriverI, {}, DriverMethodsI>

const DriverSchema = new Schema<DriverI, DriveModelT, DriverMethodsI>({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        unique: true
    },
    lastFour: {
        type: Number,
        required: true
    },
    passedBackgroundCheck: {
        type: Boolean,
        default: false
    },
    bankRoutingNumber: {
        type: String
    },
    bankAccountNumber: {
        type: String
    },
    orders: [{
        type: Schema.Types.ObjectId,
        ref: 'Order'
    }],
    activeOrders: [{
        type: Schema.Types.ObjectId,
        ref: 'Order',
        default: []
    }],
    totalPayout: {
        type: Number,
        default: 0,
    },
    location: PointSchema
})

DriverSchema.plugin(MongooseFindByReference)

DriverSchema.method<DriverDocT>('getActiveOrders', async function() {
    const driver = this as DriverDocT

    const activeOrders = await Order
        .find({$in: driver.activeOrders})

    return activeOrders
})

DriverSchema.method<DriverDocT>('removeActiveOrders', async function(
    orderIds: string[] | Types.ObjectId[]
) {

    const driver = this as DriverDocT

    //@ts-ignore
    await driver.update({
        //@ts-ignore
        $pullAll: {
            activeOrders: orderIds
        }
    })

    return driver
})

DriverSchema.method<DriverDocT>('addActiveOrders', async function(
    orderIds: string[] | Types.ObjectId[]
) {
    const driver = this

    await driver.update({
        $addToSet: {
            activeOrders: {
                $each: orderIds
            },
            orders: {
                $each: orderIds
            }
        }
    })

    return driver
})

DriverSchema.method<DriverDocT>('addActiveOrder', async function(
    orderId: string | Types.ObjectId
) {
    const driver = this

    await driver.update({
        $addToSet: {
            activeOrders: orderId,
            orders: orderId
        }
    })

    return driver
})

DriverSchema.method<DriverDocT>('removeActiveOrder', async function(
    orderId: string | Types.ObjectId
) {
    const driver = this

    await driver.update({
        $pull: {
            activeOrders: orderId
        }
    })

    return driver
})

const Driver = model('Driver', DriverSchema)

export default Driver