import mongoose, { Schema, model, Types, Model } from 'mongoose'
import { MongooseFindByReference } from 'mongoose-find-by-reference'
import { stripe } from '../../constants/moneyHandling'
import { err } from '../../constants/general'

export type SAPDocT = mongoose.Document<unknown, any, SAPI> & SAPI & {
    _id: mongoose.Types.ObjectId
}

export interface SAPI extends SAPMethodsI {
    _id?: Types.ObjectId | string
    name: string
    description: string
    list: {
        name: string
        description: string
        price: number
        /**
         * Price Id with stripe
        */
        priceId: string
        /**
         * Weight of the clothes in pounds
         * if perPound is true, this is required to calculate the price
        */
        productId: string
        /**
         * Product or Service
        */
        sapType: 'service' | 'product'
    }[]
    /**
     * The default bag load for the service
     * 
     * This is used for when the driver gets the quantity of bags
     * it's already put in the cart for the order.
    */
    defualtBagLoad: string
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
        this: SAPDocT,
        name: string,
        description: string,
        price: number,
        isService: boolean
    ): Promise<SAPDocT>

    /**
     * Remove a PRODUCT or SERVICE from the list
     * @param id 
     */
    removeProd(
        this: SAPDocT,
        id: string | Types.ObjectId
    ): Promise<SAPDocT>

    setDefaultBagLoad(
        this: SAPDocT,
        serviceId: string | Types.ObjectId
    ): Promise<SAPDocT>

    listSAPs(
        this: SAPDocT
    ): Promise<SAPI[]>
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
            },
            description: String,
            price: {
                type: Number
            },
            priceId: {
                type: String
            },
            productId: {
                type: String
            },
            sapType: {
                type: String,
                enum: ['service', 'product']
            }
        }
    ],
    defualtBagLoad: {
        type: String
    }
})

SAPSchema.plugin(MongooseFindByReference)

SAPSchema.methods.addProd = async function(
    name: string,
    description: string,
    price: number,
    isService: boolean
) {
    const sap = this

    const newProd = {
        name,
        description,
        price,
        priceId: '',
        productId: '',
        sapType: isService ? 'service' : 'product' as 'service' | 'product'
    }

    if(sap.list.some(prod => prod.name === name)) {
        throw err(400, 'cannot add a product with the same name as another product')
    }

    const stripeProduct = await stripe.products.create({
        name,
        tax_code: 'txcd_20030000',
        default_price_data: {
            unit_amount: price,
            currency: 'usd'
        },
        description
    })
    .catch(e => {
        console.log(e)
        throw err(500, 'could not create stripe product')
    })

    newProd.productId = stripeProduct.id
    newProd.priceId = stripeProduct.default_price as string

    sap.list.push(newProd)

    await sap.save()
        .catch(e => {
            console.log(e)
            throw err(500, 'could not save sap after proper validation')
        })

    return sap
}

SAPSchema.methods.removeProd = async function(
    id: string | Types.ObjectId
) {
    const sap = this

    // @ts-ignore
    const prod = sap.list.find(prod => prod._id.toString() === id.toString())
    if(!prod) {
        throw err(400, 'could not find product or service')
    }

    await stripe.products.del(prod.productId)
        .catch(e => {
            console.log(e)
            throw err(500, `
                could not delete product or service from stripe. Product id: ${prod.productId}'s price needs to be deleted manually
            `)
        })

    // @ts-ignore
    sap.list = sap.list.filter(prod => prod._id.toString() !== id.toString())

    await sap.save()
        .catch(e => {
            console.log(e)
            throw err(500, 'could not save sap after removing product')
        })

    return sap
}

SAPSchema.methods.setDefaultBagLoad = async function(
    serviceId: string | Types.ObjectId
) {
    const sap = this

    // @ts-ignore
    const service = sap.list.find(prod => prod._id.toString() === serviceId.toString())
    if(!service) {
        throw err(400, 'could not find service')
    }

    sap.defualtBagLoad = serviceId.toString()

    await sap.save()
        .catch(e => {
            console.log(e)
            throw err(500, 'could not save sap after setting default bag load')
        })

    return sap
}

const SAP = model('ServicesAndProducts', SAPSchema)

export default SAP