import mongoose, { Schema, model, Types, Model } from 'mongoose'
import { MongooseFindByReference } from 'mongoose-find-by-reference'
import validator from 'validator'
import { idToString } from '../constants/general';
import { cleanerExist } from '../constants/validation';
import Service from './services.model';

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
    minPriceServiceId: Types.ObjectId
    minPrice: number
    useMinPrice: boolean
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
    
    /**
     * set the minimum price for a service
     * 
     * @param {string | Types.ObjectId} serviceId 
    */
    setMinPrice(
        serviceId: string | Types.ObjectId,
    ): ClnDocT

    /**
     * update whether or not to use the minimum price
     * 
     * @param {boolean} useMinPrice
    */
    setUseMinPrice(
        /* A boolean that determines whether or not to use the minimum price for a service. */
        useMinPrice: boolean
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
    }],
    minPriceServiceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        default: null
    },
    minPrice: {
        type: Number,
        default: 0
    },
    useMinPrice: {
        type: Boolean,
        default: false
    }
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

CleanerSchema.method<ClnDocT>('setMinPrice', async function(
    serviceId: string | Types.ObjectId
) {
    const cln = this as ClnDocT

    if(!idToString(cln.services).includes(serviceId.toString())) {
        throw {
            message: 'cleaner does not provide this service or invalid service id',
            status: 400
        }
    }

    const service = await Service.findById(serviceId)
    if(!service) {
        console.error('service id could not be found after checking if cleaner provides service')
        throw {
            message: 'service id could not be found after checking if cleaner provides service',
            status: 500
        }
    }

    await cln.update({
        minPriceServiceId: serviceId,
        minPrice: service.price
    }).catch(err => {
        console.error(err)
        throw {
            message: 'could not update cleaner min price after proper validation',
            status: 500
        }
    })

    return cln
})

CleanerSchema.method<ClnDocT>('setUseMinPrice', async function(
    useMinPrice: boolean
) {
    const cln = this as ClnDocT

    if(useMinPrice && !cln.minPriceServiceId) {
        throw {
            message: 'cleaner does not have a minimum price set',
            status: 400
        }
    }

    await cln.update({ useMinPrice })
    .catch(err => {
        console.error(err)
        throw {
            message: 'could not update cleaner min price after proper validation',
            status: 500
        }
    })

    cln.useMinPrice = useMinPrice

    return cln
})

const Cleaner = model('Cleaner', CleanerSchema)

export default Cleaner