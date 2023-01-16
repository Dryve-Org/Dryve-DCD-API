import mongoose, { Types, model, Schema, Model } from 'mongoose'
import { MongooseFindByReference } from 'mongoose-find-by-reference'
import validator from 'validator'
import { stripe } from '../constants/moneyHandling'

export type ServiceDocT = mongoose.Document<unknown, any, ServiceI> & ServiceI & {
    _id: mongoose.Types.ObjectId
}

export interface ServiceI {
    price: number
    title: string
    description?: string
    /**
     * Product Id with stripe
    */
    productId: string
    /**
     * Price Id with stripe
    */
    priceId: string
}

interface ServiceMethodsI {

}

export type ServiceModelT = Model<ServiceI, {}, ServiceDocT>

const ServiceSchema = new Schema<ServiceI, ServiceModelT, ServiceMethodsI>({
    price: {
        type: Number,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    productId: {
        type: String,
    },
    priceId: {
        type: String,
    },
    description: String,
})

ServiceSchema.plugin(MongooseFindByReference)

ServiceSchema.pre('save', async function (next) {
    const service = this
    
    if(!service.productId || !service.priceId) {
        const stripeProduct = await stripe.products.create({
            name: service.title,
            tax_code: 'txcd_20030000',
            default_price_data: {
                unit_amount: service.price,
                currency: 'usd'
            },
            description: service.description
        })

        if(!stripeProduct.default_price) {
            throw 'stripe could not create price'
        }

        let priceId = typeof stripeProduct.default_price === 'string' ?
            stripeProduct.default_price :
            stripeProduct.default_price.id
        

        service.productId = stripeProduct.id
        service.priceId = priceId
    }

    next()
})

const Service = model('Service', ServiceSchema)

export default Service
