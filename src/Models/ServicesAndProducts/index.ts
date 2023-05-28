import mongoose, { Schema, model, Types, Model } from 'mongoose'
import { MongooseFindByReference } from 'mongoose-find-by-reference'

export type SAPDocT = mongoose.Document<unknown, any, SAPI> & SAPI & {
    _id: mongoose.Types.ObjectId
}

export interface SAPI extends SAPMethodsI {
    _id: Types.ObjectId
    name: string
    description: string
    list: {
        name: string
        description: string
        /**
         * Price Id with stripe
        */
        priceId: string
        /**
         * Weight of the clothes in pounds
         * if perPound is true, this is required to calculate the price
        */
        productId: string
    }[]
}

interface SAPMethodsI {
    /**
     * Add a PRODUCT or SERVICE  to the list
     * @param name 
     * @param description 
     * @param price 
     * @param isService
     */
    addProd(
        name: string,
        description: string,
        price: number,
        isService: boolean
    ): Promise<SAPDocT>
}

const SAPSchema = new Schema<SAPI, Model<SAPI, {}, SAPDocT>, SAPMethodsI>({
    name: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        required: true
    },
    list: [
        {
            name: {
                type: String,
                required: true
            },
            description: String,
            priceId: {
                type: String,
                required: true
            },
            productId: {
                type: String,
                required: true
            },
            default: []
        }
    ]
})

SAPSchema.plugin(MongooseFindByReference)

const SAP = model('ServicesAndProducts', SAPSchema)

export default SAP