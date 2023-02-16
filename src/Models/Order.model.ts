import { MongooseFindByReference } from 'mongoose-find-by-reference'
import mongoose, { Types, model, Schema, Model } from 'mongoose'
import { isUnixDate } from '../constants/time'
import { PointI, PointSchema } from './point.models'
import { desiredServicesI, err, handleDesiredServices } from '../constants/general'
import { createPaymentIntent, stripe, updateAmount } from '../constants/moneyHandling'
import { invoiceEmail, transporter } from '../constants/email/setup'
import { UserI } from './user.model'
import Cleaner, { CleanerI } from './cleaner.model'
import e from 'express'

export type OrderDocT = mongoose.Document<unknown, any, OrderI> & OrderI & {
    _id: mongoose.Types.ObjectId
}

export type OrderstatusT = "Task Posted Pickup" |
    "Task Posted Dropoff" |
    "Picked Up From Cleaner" |
    "Task Canceled" |
    "Pickup Driver On the Way" |
    "Dropoff Driver On the Way" |
    "Clothes To Cleaner" |
    "Clothes Awaiting Pricing" |
    "Clothes Awaiting Clean" |
    "Clothes Being Cleaned" |
    "Clothes Ready" |
    "Driver To Cleaner" |
    "Clothes to Home" |
    "Complete" |
    "Cancelled"

export const orderStatuses: OrderstatusT[] = [
    "Task Posted Pickup",
    "Task Posted Dropoff",
    "Task Canceled",
    "Pickup Driver On the Way",
    "Dropoff Driver On the Way",
    "Clothes To Cleaner",
    "Clothes Awaiting Pricing",
    "Clothes Awaiting Clean",
    "Clothes Being Cleaned",
    "Clothes Ready",
    "Driver To Cleaner",
    "Picked Up From Cleaner",
    "Clothes to Home",
    "Complete",
    "Cancelled"
]

export interface OrderI {
    client: Types.ObjectId // client
    origin?: Types.ObjectId | string// client pickup and dropoff
    dropOffAddress?: Types.ObjectId
    cleanerAddress: Types.ObjectId
    driverLocation?: PointI
    // locationSession?: Types.ObjectId //long and lat of clothes location
    pickUpDriver?: Types.ObjectId // driver
    dropOffDriver?: Types.ObjectId
    pickUpCostId?: string // cost for drive to Cleaners
    dropOffCostId?: string // cost for drive from Cleaner to origin
    cleanCostId?: string // total cost for cleaners
    cleaner: Types.ObjectId
    /**
     * is order accessible, useable, and still active
    */
    orderClosed: boolean
    /**
     * time when the order is closed
     * @type {Isotime}
    */
    closedTime?: number
    clientPickupTime?: number
    cleanerDropOffTime?: number
    /**
     * time when the clothes are done being cleaned
     * @type {Isotime}
    */
    cleanFinishTime?: number
    cleanerPickupTime?: number
    clientDropoffTime?: number
    /**
     * distnce from client to cleaners in miles
     * @type {Number}
    */
    toCleanerDistance: number
    /**
     * distnce from cleaners to client in miles
     * @type {Number}
    */
    fromCleanerDistance: number 
    created: number
    status: OrderstatusT
    orderFee: number
    orderFeePaid: boolean
    userCard?: string
    /**
     * If the order is now in the drop off process order
     * @type {boolean}
    */
    isDropOff?: boolean
    desiredServices: desiredServicesI[]
    apartment: Types.ObjectId
    building: string,
    unit: string
    createdBy: {
        userType: string
        userTypeId: Types.ObjectId
    },
    orderPaidfor: boolean
    serviceCost?: number
    orderTotal?: number
    cleanerApproved: boolean
    paymentLinkId: string
    paymentLinkURL: string
}

interface OrderMethodsI {
    /**
     * Updates the desired services for an order
     * along with pricing.
     * 
     * @param {desiredServicesI[]} desiredServices 
    */
    updateDesiredServices(
        desiredServices: desiredServicesI[]
    ): OrderDocT

    /**
     * This will create a payment link for the order and
     * client will recieve an email with the link.
    */
    invoiceClient(): Promise<OrderDocT>
}

export type OrderModelT = Model<OrderI, {}, OrderMethodsI>

const OrderSchema = new Schema<OrderI, OrderModelT, OrderMethodsI>({
    client: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    origin: {
        type: Schema.Types.ObjectId,
        ref: 'Address'
    },
    cleanerAddress: {
        type: Schema.Types.ObjectId,
        ref: 'Address',
    },
    dropOffAddress: {
        type: Schema.Types.ObjectId,
        ref: 'Address',
    },
    cleaner: {
        type: Schema.Types.ObjectId,
        ref: "Cleaner",
    },
    cleanerApproved: {
        type: Boolean,
        default: false
    },
    driverLocation: {
        type: PointSchema
    },
    pickUpDriver: {
        type: Schema.Types.ObjectId,
        ref: 'Driver'
    },
    dropOffDriver: {
        type: Schema.Types.ObjectId,
        ref: 'Driver'
    },
    created: {
        type: Number,
        validate(value: number) {
            if(!isUnixDate(value)) {
                throw new Error("Not in unix format")
            }
        }
    },
    closedTime: {
        type: Number,
        validate(value: number) {
            if(!isUnixDate(value)) {
                throw new Error("Not in unix format")
            }
        }
    },
    clientPickupTime: {
        type: Number,
        validate(value: number) {
            if(!isUnixDate(value)) {
                throw new Error("Not in unix format")
            }
        }
    },
    status: {
        type: String,
        required: true
    },
    cleanerDropOffTime: {
        type: Number,
        validate(value: number) {
            if(!isUnixDate(value)) {
                throw new Error("Not in unix format")
            }
        }
    },
    cleanFinishTime: {
        type: Number,
        validate(value: number) {
            if(!isUnixDate(value)) {
                throw new Error("Not in unix format")
            }
        }
    },
    cleanerPickupTime: {
        type: Number,
        validate(value: number) {
            if(!isUnixDate(value)) {
                throw new Error("Not in unix format")
            }
        }
    },
    clientDropoffTime: {
        type: Number,
        validate(value: number) {
            if(!isUnixDate(value)) {
                throw new Error("Not in unix format")
            }
        }
    },
    paymentLinkId: {
        type: String
    },
    paymentLinkURL: {
        type: String
    },
    pickUpCostId: {
        type: String
    },
    cleanCostId: {
        type: String,
    },
    orderFee: {
        type: Number,
        required: true,
        default: 500
    },
    dropOffCostId: {
        type: String,
    },
    orderClosed: {
        type: Boolean,
        default: false
    },
    orderFeePaid: {
        type: Boolean,
        default: false
    },
    userCard: {
        type: String,
    },
    isDropOff: Boolean,
    orderPaidfor: {
        default: false,
        type: Boolean
    },
    desiredServices: [{
        quantity: Number,
        weight: Number,
        service: {
            type: Schema.Types.ObjectId,
            ref: 'Service'
        }
    }],
    apartment: {
        type: Schema.Types.ObjectId,
        ref: 'Apartment'
    },
    building: String,
    unit: String,
    createdBy: {
        userType: { 
            type: String 
        },
        userTypeId: { type: Types.ObjectId }
    },
    serviceCost: Number,
    orderTotal: Number,
    toCleanerDistance: Number,
    fromCleanerDistance: Number,
    
})

OrderSchema.plugin(MongooseFindByReference)

OrderSchema.method<OrderDocT>('updateDesiredServices', async function(
    desiredServices: desiredServicesI[]
) {
    const order = this as OrderDocT

    // if(order.orderPaidfor) {
    //     throw 'order was already paid for'
    // }

    order.desiredServices = desiredServices
    
    await order.save()

    return order
})

OrderSchema.method<OrderDocT>('invoiceClient', async function() {
    const order = this

    if(order.orderPaidfor) {
        throw err(400, 'order was already paid for')
    }

    if (!order.desiredServices) {
        throw err(400, 'no desired services')
    }

    const cleaner = await Cleaner.findById(order.cleaner)
    if(!cleaner) {
        console.error(`no cleaner found for order ${order._id}`)
        throw err(400, 'no cleaner found in order')
    }

    const handleServices = cleaner.useMinPrice ?
    await handleDesiredServices(
        order.desiredServices,
        cleaner.minPrice,
        cleaner.minPriceServiceId.toString()
    ) :
    await handleDesiredServices(order.desiredServices)

    if(!order.paymentLinkURL || true) {
        const lineItems = handleServices.servicesWithPrice.map((dS) => ({
            price: dS.service.priceId,
            quantity: dS.quantity,
        }))
        
        const paymentLink = await stripe.paymentLinks.create({
            line_items: lineItems,
            // automatic_tax: {
            //     enabled: true
            // },
            billing_address_collection: 'required'
        })
        order.paymentLinkId = paymentLink.id
        order.paymentLinkURL = paymentLink.url
    } else {
        //there should be a way to update this
        //without creating a payment Id
        throw err(400, 'payment link already exists')
    }

    order.orderTotal = handleServices.total

    await order.populate([
        {
            path: 'client',
            model: 'User'
        },
        {
            path: 'cleaner',
            model: 'Cleaner'
        }
    ])

    invoiceEmail(
        //@ts-ignore
        order.client.email as unknown as UserI['email'],
        order.paymentLinkURL,
        //@ts-ignore
        order.client.firstName as unknown as UserI['firstName'],
        //@ts-ignore
        order.cleaner.name as unknown as CleanerI['name'] || '',
        order.clientPickupTime || 0,
        order.orderTotal || 0,
    )

    await order.save()
})

const Order = model("Order", OrderSchema)

export default Order
