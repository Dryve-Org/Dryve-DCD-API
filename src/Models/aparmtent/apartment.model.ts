require('dotenv').config()
import _ from 'lodash'
import mongoose, { Schema, model, Types, Model } from 'mongoose'
import { addAddress } from '../../constants/location'
import Address, { AddressDocT, AddressI } from '../address.model'
import User from '../user.model'
import v from 'validator'
import { generatePassword, idToString } from '../../constants/general'
import { MongooseFindByReference } from 'mongoose-find-by-reference'
import { sendEmailVerify } from '../../constants/email/setup'
import { activateUnit, addSubscription, checkAllSubscriptions, generateId, getBuilding, removeSubscription, updateMaster } from './methods'
import { now, unixDay } from '../../constants/time'
import UnitVerifySession from '../sessions/unitVerify.model'
import Stripe from 'stripe'

export type AptDocT = mongoose.Document<unknown, any, AptI> & AptI & {
    _id: mongoose.Types.ObjectId
}

export interface UnitI {
    isActive?: boolean
    address: Types.ObjectId
    activeOrders: Types.ObjectId[]
    /**
     * This is a list of subscription ids
     * from stripe. This is used to keep track
     * of the subscriptions that are active.
     * 
     * The status of this Id will be checked everyday.
     * If the status of the subscription is not active
     * then the order will not be able to initiate.
    */
    subscriptions: {
        id: string
        status: Stripe.Subscription.Status
        client: Types.ObjectId
        bagQuantity: number
    }[]
    /**
     * This is the unit's readable id that will be used
     * throughtout the this api
     * 
     * The first 3 characters are the apartment's 
     * readable id
     * 
     * example: A01-001, A01-002, A01-003
     */
    unitId: string
    /**
     * contains date in unix format of when queued. Null if not in queue
    */
    queued: number | null
}

export interface AptBuildingI  {
    //*building addresses cannot use street_address_line_2
    address: Types.ObjectId,
    units: Types.Map<UnitI>
}

interface AptIMethods {
    /**
     * List all units
    */
    listUnits(this: AptDocT): UnitI[]

    /**
     * List queued units
     */
    queuedUnits(this: AptDocT): UnitI[]

    /**
     * Adding a building to Apartment
     * @param {string} UnitId - string - the unit want to queue
     * @return {Promise<AptDocT>} - New Apt document
    */
    queueUnit(
        this: AptDocT,
        unitId: string
    ): Promise<AptDocT>
    
    /**
     * Adding a building to Apartment
     * @param {string} UnitId - string - the unit want to unqueue
     * @return {Promise<AptDocT>} - New Apt document
    */
    dequeueUnit(
        this: AptDocT,
        unitId: string
    ): Promise<AptDocT>

    /**
     * get building
     * @param {string} buildingId - string - building identifier
     * @return {AptBuildingI} - building
    */
    getBuilding(buildingId: string): AptBuildingI,

    /**
     * Adding a building to Apartment
     * @param {string} buildingId - string - building identifier
     * @param {AddressI} address - Address of the building
     * @param {String[]} units - not needed but an array of unit Ids
     * @return {Promise<AptDocT>} - New Apt document
    */
    addBuilding(
        buildingId: string,
        address: AddressI,
        units?: string[]
    ): Promise<AptDocT>,

    /**
     * Adding a unit to Apartment
     * @param {string} buildingId - string - building identifier
     * @param {string} unit - new unit
     * @return {Promise<AptDocT>} - New Apt document
    */
    addUnit<AptDocT>(
        buildingId: string,
        unitId: string,
    ): Promise<AptDocT>,
    
    /**
     * Add multple units to apartment building
     * 
     * @param {string} buildingId - string - building identifier
     * @param {String[]} units - array of strings - new units
     * @return {Promise<AptDocT>} - updated Apt document
    */
    addUnits(
        buildingId: string,
        unitIds: string[],
        isActive?: boolean
    ): Promise<AptDocT>,
    
    /**
     * Get Unit
     * @param {string} buildingId 
     * @param {string} unitId
     * @return {Promise<UnitI>}
     */
    getUnit(
        buildingId: string,
        unitId: string
    ): UnitI,
    
    /**
     * Add client to an apartment unit
     * 
     * **client must be removed from unit
     * before adding a new client to unit
     * 
     * @param {string} buildingId - string - building identifier
     * @param {String} unitId - strings - unit identifier
     * @param {string} email - string - will be validated
     * @param {string} firstName - string - will be validated
     * @param {string} lastName - string - will be validated
     * @return {Promise<AptDocT>} updated Apt document
    */
    addClient(
        unitId: UnitI['unitId'],
        email: string,
        firstName: string,
        lastName: string
    ): Promise<AptDocT>
    
    /**
     * Add client to an apartment unit
     * 
     * client can't be active before removing
     * client
     * 
     * @param {string} buildingId - string - building identifier
     * @param {String} unitId - strings - unit identifier
     * @return {Promise<AptDocT>} - updated Apt document
    */
    removeClient(
        unitId: string,
        email: string
    ): Promise<AptDocT>

    /**
     * Add subscription to unit
     * 
     * @param this 
     * @param unitId 
     * @param subscriptionId 
     * @param client 
     */
    addSubscription(
        unitId: string,
        subscriptionId: string,
        bagQuantity: number
    ): Promise<UnitI>

    removeSubscription(
        unitId: string,
        subscriptionId: string
    ): Promise<UnitI>
    
    /**
     * Activate client to an apartment unit
     * 
     * @param {String} unitId - strings - unit identifier
     * @return {Promise<AptDocT>} - updated Apt document
    */
    activateUnit(
        unitId: string
    ): Promise<AptDocT>
        
    /**
     * Check all subscriptions
     * 
     * @return {Promise<void>}
    */
    checkAllSubscriptions(): Promise<void>
    
    /**
     * Deactivate client to an apartment unit
     * 
     * **Client must be in unit
     * 
     * @param {string} buildingId - string - building identifier
     * @param {String} unitId - strings - unit identifier
     * @return {Promise<AptDocT>} - updated Apt document
    */
    deactivateUnit(
        buildingId: string,
        unitId: string
    ): Promise<AptDocT>
    
    /**
     * Add order to unit
     * ** The order must be already saved before getting here
     *
     * @param buildingId 
     * @param unitId 
     * @param orderId 
     * @return {Promise<AptDocT>} - updated Apt document
     */
    addOrderToUnit(
        unitId: UnitI['unitId'],
        orderId: string | Types.ObjectId
    ): Promise<AptDocT>
    
    /**
     * Remove active order from unit
     *
     * @param buildingId 
     * @param unitId 
     * @param orderId 
     * @return {Promise<AptDocT>} - updated Apt document
    */
    removeOrderToUnit(
        unitId: string,
        orderId: string
    ): Promise<AptDocT>

    /**
     * Generate a unique id for the apartment
     * @param {number} num - number - apartment number
     * @return {string} - unique id
     * @example
     * generateId(1) // returns A01
     * generateId(26) // returns B01
     * generateId(27) // returns B02
     * generateId(52) // returns C02
    */
    generateId(this: AptDocT): Promise<string>

    /**
     * creates the id for the unit
     * 
     * @param this 
     * @param buildingId 
     * @param unitId 
     */
    generateUnitId(
        this: AptDocT,
        buildingId: string,
        unitId: string
    ): Promise<string>

    /**
     * Sets which master the apartment is attached to
     * 
     * @param MasterId 
    */
    updateMaster(
        MasterId: string
    ): Promise<AptDocT>
    
    /**
     * Get unit by id
     * 
     * @param this 
     * @param unitId 
     * @return {Promise<[string, unitName, UnitI]>} - [buildingId, unitValue, unit]
    */
    getUnitId<AptDocT>(
        unitId: string
    ): [string, string, UnitI] | null
}


export interface AptI extends AptIMethods{
    name: string,
    master: Types.ObjectId
    address: Types.ObjectId
    email: string
    buildings: Types.Map<AptBuildingI>
    /**
     * The first cleaner to go to.
    */
    primaryCleaner: Types.ObjectId
    /** 
     * designated cleaners for this apartments
     * clothes to go to
    */
    goToCleaners: Types.ObjectId[]
    createdBy: {
        userType: 'manager'
        userTypeId: Types.ObjectId
    }
    paidFor: boolean
    aptId: string
    unitIndex: number
    servicesAndProducts: Types.ObjectId
}

type AptModelT = Model<AptI, {}, AptIMethods>

/**
 * Schema for an apartment complex
*/
const AptSchema = new Schema<AptI, AptModelT, AptIMethods>(
    {
        servicesAndProducts: {
            type: Schema.Types.ObjectId,
            ref: 'ServicesAndProducts'
        },
        name: {
            type: String,
            required: true
        },
        master: {
            type: Schema.Types.ObjectId,
            ref: 'Master',
            required: true
        },
        address: {
            type: Schema.Types.ObjectId,
            ref: 'Address'
        },
        buildings: {
            type: Map,
            default: {},
            of: {
                address: {
                    type: Schema.Types.ObjectId,
                    ref: 'Address',
                    required: true,
                    autoPopulate: true
                },
                units: {
                    type: Map,
                    of: {
                        address: {
                            type: Schema.Types.ObjectId,
                            ref: 'Address',
                            required: true
                        },
                        isActive: {
                            type: Boolean,
                            default: false
                        },
                        activeOrders: [{
                            type: Schema.Types.ObjectId,
                            ref: 'Order',
                            nullable: true
                        }],
                        unitId: {
                            type: String,
                            required: true,
                        },
                        queued: {
                            type: Number,
                            nullable: true,
                            default: null
                        },
                        subscriptions: {
                            type: [{
                                id: String,
                                status: String,
                                client: {
                                    type: Schema.Types.ObjectId,
                                    ref: 'User'
                                },
                                bagQuantity: Number
                            }],
                            default: []
                        },
                        default: {}
                    }
                }
            }
        },
        primaryCleaner: {
            type: Schema.Types.ObjectId,
            ref: 'Cleaner',
            default: undefined
        },
        goToCleaners: [{
            type: Schema.Types.ObjectId,
            ref: 'Cleaner',
            default: []
        }],
        paidFor: {
            default: false
        },
        createdBy: {
            userType: { 
                type: String,
                enum: 'manager'
            },
            userTypeId: { 
                type: Schema.Types.ObjectId,
                refPath: 'userType',
            }
        },
        aptId: {
            type: String,
            unique: true    
        },
        unitIndex: {
            type: Number,
            default: 1
        }
    },
    {
        toJSON: {
            virtuals: true,
        },
        toObject: {
            virtuals: true,
        },
    }
)

AptSchema.plugin(MongooseFindByReference)

const err = (status: number, message: string) => ({
    status,
    message
})

AptSchema.method('generateId', generateId)

AptSchema.pre('save', async function (this: AptDocT, next) { //must use ES5 function to use the "this" binding
    try {
        /*
            Never let apt save without apt.aptId or apt.unitIndex unless it's a new document
        */
        const apt =  this

        if(apt.isNew) {
            apt.aptId = await apt.generateId()
            apt.unitIndex = 1
        }

        //loop through buildings and units and generate ids if they don't have one
        for(const building of apt.buildings.entries()) {
            for(const unit of building[1].units.entries()) {
                if(unit[1].unitId === 'N/A') {
                    unit[1].unitId = `${apt.aptId}-${apt.unitIndex.toString().padStart(3, '0')}`

                    apt.buildings.get(building[0])?.units.set(unit[0], unit[1])

                    apt.unitIndex++
                }
            }
        }
    } catch(e) {
        throw 'Apartment save failed'
    }

    next() // without next the function will hang and never save
})

AptSchema.method<AptDocT>('getBuilding', getBuilding)

AptSchema.method('addBuilding', async function(
    buildingId: string,
    address: AddressI,
    units?: string[]
) {
    const apt = this as AptDocT

    if(address.street_address_line_2) throw 'building addresses cannot use street_address_line_2'
    const addy = await addAddress(address)

    let calcedUnits: Map<string, UnitI> = new Map()

    if(units) {
        /* Looping through the units array and creating an address for each unit. */
        for(const unit of units) {
            const unitAddress = {
                ...address,
                street_address_line_2: `unit ${ unit }`
            }

            const unitAddy = await addAddress(unitAddress)

            calcedUnits.set(unit, {
                address: unitAddy._id,
                isActive: true,
                unitId: 'N/A'
            } as UnitI)
        }
    }

    apt.buildings.toObject()

    apt.buildings.set(buildingId, {
        address: addy._id,
        units: calcedUnits as Types.Map<UnitI>
    })

    await apt.save()
    return apt
})

AptSchema.method<AptDocT>('addUnit', async function(
    this: AptDocT,
    buildingId: string,
    unitId: string,
) {
    const apt = this

    const building = apt.buildings.get(buildingId)
    if(!building) throw {
        message: 'building does not exists',
        status: 400
    }

    if(building.units.get(unitId)) throw {
        message: 'unit already exists',
        status: 400
    }

    const buildingAddress = await Address.findById(building.address).lean()
    if(!buildingAddress) throw {
        message: 'internal invalid address error',
        status: 500
    }

    const addy = await addAddress({
        ...buildingAddress, 
        street_address_line_2: `unit ${ unitId }`
    })

    apt.buildings.get(buildingId)?.units.set(unitId, {
        address: addy._id,
        isActive: true,
        queued: null,
        unitId: 'N/A',
        activeOrders: [],
        subscriptions: []
    })

    await apt.save()
    return apt
})

AptSchema.method('addUnits', async function(
    this: AptDocT,
    buildingId: string,
    unitNums: string[] // unit number not 'A01-001'
) {
    const apt = this

    const building = apt.buildings.get(buildingId)
    if(!building) throw {
        message: 'building does not exists',
        status: 400
    }
    building.units.toObject()
    const unitKeys = Array.from(building.units.keys())
    
    //if unit already exists throw
    if(_.intersection(unitKeys, unitNums).length) throw {
        message: 'one or more units already exists',
        status: 400
    }

    const buildingAddress = await Address
        .findById(building.address)
        .lean()

    if(!buildingAddress) throw {
        message: 'unable to get building address',
        status: 500
    }
    for(let unitNum of unitNums) {
        const unitAddress = {
            ...buildingAddress,
            street_address_line_2: `unit ${ unitNum }`
        }

        const unitAddy = await addAddress(unitAddress)
            .catch(() => {
                throw {
                    message: 'unable to add address',
                    status: 500
                }
            })

        apt.buildings.get(buildingId)?.units.set(unitNum, {
            address: unitAddy._id,
            isActive: false,
            queued: null,
            unitId: 'N/A',
            activeOrders: [],
            subscriptions: []
        })
    }

    await apt.save()
        .catch(() => {
            throw {
                message: 'unable to save updated apartment',
                status: 500
            } 
        })

    return apt
})

//TODO: update this to create user if user doesn't exist and send email
AptSchema.method('addClient', async function(
    this: AptDocT,
    unitId: UnitI['unitId'],
    email: string,
    firstName: string,
    lastName: string,
) {
    const apt = this

    const unitData = apt.getUnitId(unitId)
    if(!unitData) throw err(400, 'unit does not exist')
    const [ bldNum, unitNum, unit ] = unitData

    let client = await User.findOne({ email })
    const password = generatePassword()

    if(!client) {
        const newClient = new User({
            email,
            firstName,
            lastName,
            password,
            phoneNumber: '0000000000',
            created: now()
        })

        client = await newClient.save()
    }

    if(client.attachedUnitIds.includes(unitId)) {
        return apt
    }

    const unitVerifySession = new UnitVerifySession({
        unitId,
        userEmail: email,
        userPassword: password,
        unitNum,
        bldNum,
        aptName: apt.name
    })

    await unitVerifySession.save()

    sendEmailVerify(
        client.email,
        client.firstName,
        `${process.env.HOST}/client/verify_unit/${ unitVerifySession.id }`,
        apt.name
    )

    const clientAddresses = idToString(client.pickUpAddresses)
    if(!clientAddresses.includes(unit.address.toString())) {
        client.pickUpAddresses.push(unit.address)
    }

    await client.save()
    //client will be added after email is verified
    // unit.unitId && client.addUnitId(unit.unitId)

    unit.isActive = true
    //unit already have a client then they must be removed first
    /* Updating the unit with the client id and isActive. */
    apt.buildings.get(bldNum)?.units.set(unitNum, unit)

    await apt.save()
    return apt
})

//update this
AptSchema.method('removeClient', async function(
    this: AptDocT,
    unitId: string,
    email: string
){
    const apt = this

    const unitData = apt.getUnitId(unitId)
    if(!unitData) throw err(400, 'unit does not exist')
    const [ bldnum, unitNum, unit ] = unitData

    if(!unit) throw err(400, 'unit does not exist')

    const client = await User.findOne({ email })
    if(!client) throw err(400, 'client does not exist')

    unit.unitId && await client.removeUnitId(unit.unitId)

    unit.isActive = false

    apt.buildings.get(bldnum)?.units.set(unitNum, unit)
    
    await apt.save()
    return apt
})

AptSchema.method('addSubscription', addSubscription)

AptSchema.method('removeSubscription', removeSubscription)

AptSchema.method('activateUnit', activateUnit)

AptSchema.method('checkAllSubscriptions', checkAllSubscriptions)

AptSchema.method('deactivateUnit', async function(
    this: AptDocT,
    buildingId: string, 
    unitId: string
) {
    const apt = this
    
    const unit = apt.buildings.get(buildingId)?.units
        .get(unitId)
    
    if(apt.buildings.get(buildingId)) err(400, 'could not find building')
    if(!unit) throw err(400, 'could not find unit')
    if(
        unit.activeOrders.length > 0
    ) throw err(400, 'order is currently in progress')

    unit.isActive = true

    apt.buildings.get(buildingId)?.units.set(unitId, unit)

    await apt.save()
    return apt
})

AptSchema.method('addOrderToUnit', async function(
    this: AptDocT,
    unitId: UnitI['unitId'],
    orderId: Types.ObjectId
){
    const apt = this

    const unitData = apt.getUnitId(unitId)
    if(!unitData) throw err(400, 'could not find unit')
    const [ bldNum, unitNum, unit] = unitData

    if(!unit) throw err(400, 'could not find unit')
    if(!unit.isActive) throw err(400, 'unit not active')

    unit.activeOrders.push(orderId)
    apt.buildings.get(bldNum)?.units.set(unitNum, unit)

    await apt.save()

    return apt
})

AptSchema.method<AptDocT>('removeOrderToUnit', async function(
    this: AptDocT,
    unitId: string,
    orderId: string
){
    const apt = this

    const unitData = apt.getUnitId(unitId)
    if(!unitData) throw err(400, 'could not find unit')

    const [bldnum, unitnum, unit] = unitData
    
    if(!unit) throw err(400, 'could not find unit')

    unit.activeOrders = unit
        .activeOrders
        .filter(order => order.toString() !== orderId)

    apt.buildings.get(bldnum)?.units.set(unitnum, unit)

    await apt.save()
    return apt
})

AptSchema.method<AptDocT>('getUnit', function(
    this: AptDocT,
    buildingId,
    unitId
) {
    const apt = this

    const unit = apt.buildings.get(buildingId)?.units
        .get(unitId)

    if(!unit) {
        throw 'could not find unit'
    }

    return unit
})

AptSchema.methods.getUnitId = function(
    this: AptDocT,
    unitId: string
) {
    const apt = this

    for(let bld of apt.buildings) {
        for(let unit of bld[1].units) {
            if(unit[1].unitId === unitId) {
                return [ bld[0], ...unit ]
            }
        }
    }

    return null
}

AptSchema.methods.queueUnit = async function(
    unitId
) {
    const apt = this

    const unitData = apt.getUnitId(unitId)
    if(!unitData) throw err(400, 'unable to find unitId')
    const [ buildingId, unitValue, unit ] = unitData

    if(unit.queued) return apt

    unit.queued = now()
    apt.buildings.get(buildingId)?.units.set(unitValue, unit)

    await apt.save()

    return apt
}

AptSchema.methods.dequeueUnit = async function(
    unitId
) {
    const apt = this

    const unitData = apt.getUnitId(unitId)
    if(!unitData) throw err(400, 'unable to find unitId')
    const [ buildingId, unitValue, unit ] = unitData

    unit.queued = null
    apt.buildings.get(buildingId)?.units.set(unitValue, unit)

    await apt.save()

    return apt
}

AptSchema.methods.listUnits = function() {
    const apt = this

    const units: UnitI[] = []

    for (let bld of apt.buildings) {
        for (let unit of bld[1].units) units.push(unit[1])
    }

    return units
}

AptSchema.methods.queuedUnits = function() {
    const apt = this

    const units = apt
        .listUnits()
        .filter(unit => unit.queued !== null)
        //@ts-ignore
        .sort((a, b) => b.queued - a.queued)

    return units
}

AptSchema.method<AptDocT>('updateMaster', updateMaster)


const Apt = model<AptI, AptModelT>('Apartment', AptSchema)

export default Apt