import mongoose, { Schema, model, Types, Model } from 'mongoose'
import { MongooseFindByReference } from 'mongoose-find-by-reference'
import validator from 'validator'
import { err, idToString } from '../constants/general';
import { now } from '../constants/time';
import Order from './Order.model';
import Service from './services.model';

export type ClnDocT = mongoose.Document<unknown, any, CleanerI> & CleanerI & {
    _id: mongoose.Types.ObjectId;
}

interface MachineI {
    type: 'dryer' | 'washer'
    attachedOrder: Types.ObjectId | null
    lastUpdated: Number,
    size: 'small' | 'medium' | 'large'
    status: 'Available' | 'In Use' | 'Out of Order'
    machineId: string
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
    
    /**
     * add machines to cleaner
     * 
     * @param {('Dryer' | 'Washer')} type
     * @param {('Small' | 'Medium' | 'Large')} size
     * @param {number} quantity
     * @returns {Promise<ClnDocT>}
     * @memberof ClnMethodsI
    */
    addMachines(
        this: ClnDocT,
        type: 'Dryer' | 'Washer',
        size: 'Small' | 'Medium' | 'Large',
        quantity: number
    ): Promise<ClnDocT>
    
    /**
     * attach an order to a machine
     * 
     * @param {string} machineId 
     * @param {string | Types.ObjectId} orderId 
     * @returns {Promise<ClnDocT>}
     * @memberof ClnMethodsI
    */
    attachOrderToMachine(
        this: ClnDocT,
        machineId: string,
        orderId: string | Types.ObjectId,
    ): Promise<ClnDocT>

    /**
     * detach an order from a machine
     * 
     * @param {string} machineId 
     * @returns {Promise<ClnDocT>}
     * @memberof ClnMethodsI
    */
    detachOrderFromMachine(
        this: ClnDocT,
        machineId: string,
    ): Promise<ClnDocT>
    
    /**
     * find an order in the machines array
     * 
     * @param {string | Types.ObjectId} orderId
     * @returns {Promise<MachineI | null>}
     * @memberof ClnMethodsI
    */
    findOrderInMachines(
        this: ClnDocT,
        orderId: string | Types.ObjectId,
    ): MachineI[] | null
    
    /**
     * find a machine in the machines array
     * j
     * 
     * @param {string} machineId
     * @returns {Promise<MachineI | null>}
     * @memberof ClnMethodsI
    */
    toggleMachineStatus(
        this: ClnDocT,
        machineId: string,
    ): Promise<ClnDocT>
}

export interface CleanerI extends ClnMethodsI {
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
    machines: MachineI[]
    dryerIndex: number
    washerIndex: number
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
    },
    machines: [{
        type: {
            type: String,
            enum: ['Dryer', 'Washer'],
            required: true
        },
        attachedOrder: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order',
            default: null
        },
        lastUpdated: {
            type: Number,
            default: now()
        },
        status: {
            type: String,
            enum: ['Available', 'In Use', 'Out of Order'],
            default: 'Available'
        },
        machineId: {
            type: String,
            required: true
        },
        size: {
            type: String,
            enum: ['Small', 'Medium', 'Large'],
            required: true
        }
    }],
    washerIndex: {
        type: Number,
        default: 1
    },
    dryerIndex: {
        type: Number,
        default: 1
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

CleanerSchema.method('addMachines', async function(
    this: ClnDocT,
    type: 'dryer' | 'washer',
    size: 'small' | 'medium' | 'large',
    quantity: number
) {
    try {
        const cln = this

        if(
            !['dryer', 'washer'].includes(type) ||
            !['small', 'medium', 'large'].includes(size) ||
            quantity < 1
        ) {
            throw err(400, 'invalid machine type, size, or quantity')
        }
    
        const machines: MachineI[] = []
        const lastUpdated = now()
        const machineSuffix = type === 'dryer' ? 'D' : 'W'
        let machineIndex = type === 'dryer' ? cln.dryerIndex : cln.washerIndex
    
        for(let i = 0; i < quantity; i++) {
            machines.push({
                type,
                size,
                machineId: `${machineSuffix}-${machineIndex.toString().padStart(2, '0')}`,
                lastUpdated,
                attachedOrder: null,
                status: 'Available'
            })
    
            machineIndex++
        }
    
        if(type === 'dryer') {
            cln.dryerIndex = machineIndex
        } else {
            cln.washerIndex = machineIndex
        }
    
        await cln.update({
            washerIndex: cln.washerIndex,
            dryerIndex: cln.dryerIndex,
            $addToSet: {
                machines: {
                    $each: machines
                }
            }
        })
    
        return cln
    } catch(e) {
        if(!e) {
            throw err(500, 'could not add machines to cleaner')
        } else {
            throw e
        }
    }
})

CleanerSchema.method('attachOrderToMachine', async function(
    this: ClnDocT,
    machineId: string,
    orderId: string | Types.ObjectId
) {
    try {
        const cln = this

        if(!machineId || !orderId) {
            throw err(400, 'invalid machine id or order id')
        }
    
        const machine = cln.machines.find(m => m.machineId === machineId)
        const machineIndex = cln.machines.findIndex(m => m.machineId === machineId)
        if(!machine) {
            throw err(400, 'machine id not found')
        }
    
        if(machine.attachedOrder) {
            if(machine.attachedOrder.toString() === orderId.toString()) {
                return cln
            }
            throw err(400, 'machine is already in use')
        }

        if(machine.status !== 'Available') {
            throw err(400, 'machine is not available')
        }

        //find order in cleaner's active orders whether order is objectId or order object
        const orderInActiveOrders = cln.activeOrders.find(o => {
            if(typeof orderId === 'string') {
                return o.toString() === orderId
            } else {
                return o.toString() === orderId.toString()
            }
        })
        if(!orderInActiveOrders) {
            throw err(400, 'order is not in cleaner\'s active orders')
        }

        //convert orderId to object id if it is a string
        if(typeof orderId === 'string') {
            orderId = new Types.ObjectId(orderId)
        }
        
        await cln.update({
            $set: {
                [`machines.${machineIndex}.attachedOrder`]: orderId,
                [`machines.${machineIndex}.status`]: 'In Use',
                [`machines.${machineIndex}.lastUpdated`]: now()
            }
        })

        // await cln.save()
    
        return cln
    } catch(e) {
        if(!e) {
            throw err(500, 'could not add machines to cleaner')
        } else {
            console.log(e)
            throw e
        }
    }
})

CleanerSchema.method('detachOrderFromMachine', async function(
    this: ClnDocT,
    machineId: string,
    ) {
        try {
            const cln = this
            
            if(!machineId) {
                throw err(400, 'invalid machine id')
            }
            
            const machine = cln.machines.find(m => m.machineId === machineId)
            const machineIndex = cln.machines.findIndex(m => m.machineId === machineId)
            if(!machine) {
                throw err(400, 'machine id not found')
            }
            
            if(!machine.attachedOrder) {
            throw err(400, 'machine is not in use')
        }
        
        await cln.update({
            $set: {
                [`machines.${machineIndex}.attachedOrder`]: null,
                [`machines.${machineIndex}.status`]: 'Available',
                [`machines.${machineIndex}.lastUpdated`]: now()
            }
        })
        
        return cln
    } catch(e) {
        if(!e) {
            throw err(500, 'could not add machines to cleaner')
        } else {
            throw e
        }
    }
})

CleanerSchema.method('findOrderInMachines', function(
    this: ClnDocT,
    orderId: string | Types.ObjectId
): MachineI[] | null {
    const cln = this

    if(!orderId) {
        return null
    }

    const foundMachines = cln.machines
        .filter(m => m.attachedOrder?.toString() === orderId.toString())

    return foundMachines.length > 0 ? foundMachines : null
})

CleanerSchema.method('toggleMachineStatus', async function(
    this: ClnDocT,
    machineId: string
) {
    try {
        const cln = this

        const machine = cln.machines.find(m => m.machineId === machineId)
        if(!machine) {
            throw err(400, 'machine id not found')
        }

        if(machine.status === 'In Use' || machine.attachedOrder) {
            throw err(400, 'machine is already in use')
        }

        const machineIndex = cln.machines.findIndex(m => m.machineId === machineId)

        return await cln.update({
            $set: {
                [`machines.${machineIndex}.status`]: machine.status === 'Available' ? 'Out of Order' : 'Available',
                [`machines.${machineIndex}.lastUpdated`]: now()
            }
        })
    } catch(e) {
        if(!e) {
            throw err(500, 'could not toggle machine status')
        } else {
            throw e
        }
    }
})



const Cleaner = model('Cleaner', CleanerSchema)

export default Cleaner