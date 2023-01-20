import mongoose, { Schema, model, Types, Model } from 'mongoose'
import { MongooseFindByReference } from 'mongoose-find-by-reference'
import validator from 'validator'
import { cleanerExist } from '../constants/validation';

export type ClnDocT = mongoose.Document<unknown, any, CleanerI> & CleanerI & {
    _id: mongoose.Types.ObjectId;
}

export interface CleanerI {
    name: string
    email: string
    phoneNumber: string
    website?: string
    address: Types.ObjectId
    stripeId: string //attach payment methods to this
    paymentMethod: string
    cardId: string
    services: Types.ObjectId[]
    activeOrders: Types.ObjectId[]
    orders: Types.ObjectId[]
}

interface ClnMethodsI {
    /**
     * Add active orders to Cleaner
     * 
     * @param {string[] | Types.ObjectId[]} orderIds 
    */
    addActiveOrders(
        orderIds: string[] | Types.ObjectId[]
    ): ClnDocT

    /**
     * Remove active order from Cleaner 
     * @param orderId 
    */
    removeActiveOrder(
        orderId: string | Types.ObjectId
    ): ClnDocT

    /**
     * Remove active orders from Cleaner 
     * @param orderId 
    */
    removeActiveOrders(
        orderIds: string[] | Types.ObjectId[]
    ): ClnDocT
}

type ClnModelT = Model<CleanerI, {}, ClnMethodsI>

const CleanerSchema = new Schema<CleanerI, ClnModelT, ClnMethodsI>({
    name: {
        type: String,
        required: true
    },
    phoneNumber: {
        type: String,
        required: true,
        validate(value: string) {
            if(!validator.isMobilePhone(value)) {
                throw new Error("phone number not valid")
            }
        }
    },
    website: String,
    address: {
        type: Schema.Types.ObjectId,
        ref: 'Address',
        requried: true,
        unique: true
    },
    stripeId: {
        Type: String, // this is from one of the owners of this store
    },
    paymentMethod: {
        Type: String, // this is from one of the owners of this store
    },
    services: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        default: []
    }],
    activeOrders: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        default: []
    }],
    orders: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        default: []
    }]
})

CleanerSchema.plugin(MongooseFindByReference)

CleanerSchema.method('addActiveOrders', async function(
    orderIds: string[] | Types.ObjectId[]
) {
    const cln = this as ClnDocT

    await cln.update({
        $addToSet: {
            activeOrders: {
                $each: orderIds
            },
            orders: {
                $each: orderIds
            }
        }
    })
    
    return cln
})

CleanerSchema.method<ClnDocT>('removeActiveOrder', async function(
    orderId: string | Types.ObjectId
) {
    const cln = this as ClnDocT

    await cln.update({
        $pull: {
            activeOrders: orderId
        }
    })

    return cln
})

CleanerSchema.method<ClnDocT>('removeActiveOrders', async function(
    orderIds: string[] | Types.ObjectId[]
) {
    const cln = this as ClnDocT

    //@ts-ignore
    await cln.update({
        //@ts-ignore
        $pullAll: {
            activeOrders: orderIds
        }
    })

    return cln
})

const Cleaner = model('Cleaner', CleanerSchema)

export default Cleaner