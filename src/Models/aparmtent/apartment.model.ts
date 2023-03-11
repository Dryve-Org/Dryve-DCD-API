require('dotenv').config()
import _ from 'lodash'
import mongoose, { Schema, model, Types, Model } from 'mongoose'
import { addAddress } from '../../constants/location'
import Address, { AddressDocT, AddressI } from '../address.model'
import User from '../user.model'
import v from 'validator'
import { idToString } from '../../constants/general'
import { MongooseFindByReference } from 'mongoose-find-by-reference'
import { sendEmailVerify } from '../../constants/email/setup'
import { activateUnit, generateId, getBuilding } from './methods'

export type AptDocT = mongoose.Document<unknown, any, AptI> & AptI & {
    _id: mongoose.Types.ObjectId
}

export interface UnitI {
    client?: Types.ObjectId
    isActive?: boolean
    address: Types.ObjectId
    activeOrder?: Types.ObjectId
    unitId?: string
}

export interface AptBuildingI  {
    //*building addresses cannot use street_address_line_2
    address: Types.ObjectId,
    units: Types.Map<UnitI>
}

interface AptIMethods {
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
    addUnit(
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
     * @return {Promise<AptDocT>} updated Apt document
    */
    addClient(
        buildingId: string,
        unitId: string,
        email: string,
        isActive?: boolean
    ): Promise<AddressDocT>
    
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
        buildingId: string,
        unitId: string
    ): Promise<AddressDocT>
    
    /**
     * Activate client to an apartment unit
     * 
     * **Client must be in unit
     * 
     * @param {string} buildingId - string - building identifier
     * @param {String} unitId - strings - unit identifier
     * @return {Promise<AptDocT>} - updated Apt document
    */
    activateUnit(
        buildingId: string,
        unitId: string
    ): Promise<AddressDocT>
    
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
    ): Promise<AddressDocT>
    
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
        buildingId: string,
        unitId: string,
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
        buildingId: string,
        unitId: string
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
}


export interface AptI extends AptIMethods{
    name: string,
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
    },
    paidFor: boolean
    aptId: string
    unitIndex: number
}


type AptModelT = Model<AptI, {}, AptIMethods>

/**
 * Schema for an apartment complex
*/
const AptSchema = new Schema<AptI, AptModelT, AptIMethods>(
    {
        name: {
            type: String,
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
                        client: {
                            type: Schema.Types.ObjectId,
                            ref: 'User',
                        },
                        isActive: {
                            type: Boolean,
                            default: false
                        },
                        activeOrder: {
                            type: Schema.Types.ObjectId,
                            ref: 'Order'
                        },
                        unitId: {
                            type: String,
                            required: true
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
        const apt = this
        if(!apt.aptId) await apt.generateId()
        if(!apt.unitIndex) apt.unitIndex = 1

        //loop through buildings and units and generate ids if they don't have one
        for(const building of apt.buildings.entries()) {
            for(const unit of building[1].units.entries()) {
                if(!unit[1].unitId) {
                    apt.buildings.get(building[0])?.units.set(unit[0], {
                        address: unit[1].address,
                        isActive: unit[1].isActive,
                        client: unit[1].client,
                        unitId: `${apt.aptId}-${apt.unitIndex.toString().padStart(3, '0')}`
                    })

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
                client: undefined,
                isActive: false
            })
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

AptSchema.method('addUnit', async function(
    buildingId: string,
    unitId: string,
) {
    const apt = this as AptDocT

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
        isActive: false
    })

    await apt.save()
    return apt
})

AptSchema.method('addUnits', async function(
    buildingId: string,
    unitIds: string[]
) {
    const apt = this as AptDocT

    const building = apt.buildings.get(buildingId)
    if(!building) throw {
        message: 'building does not exists',
        status: 400
    }
    building.units.toObject()
    const unitKeys = Array.from(building.units.keys())
    
    //if unit already exists throw
    if(_.intersection(unitKeys, unitIds).length) throw {
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

    const calcedUnits: Map<string, UnitI> = new Map()

    for(let unitId of unitIds) {
        const unitAddress = {
            ...buildingAddress,
            street_address_line_2: `unit ${ unitId }`
        }

        const unitAddy = await addAddress(unitAddress)
            .catch(() => {
                throw {
                    message: 'unable to add address',
                    status: 500
                }
            })

        apt.buildings.get(buildingId)?.units.set(unitId, {
            address: unitAddy._id,
            isActive: false,
            client: undefined
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

AptSchema.method('addClient', async function(
    this: AptDocT,
    buildingId: string,
    unitId: string,
    email: string,
    isActive?: boolean
) {
    const apt = this

    if(!v.isEmail(email)) throw err(400,'invalid body: email')
    if(typeof isActive === 'boolean') throw err(400, 'invalid body')

    const unit = apt.buildings.get(buildingId)?.units.get(unitId)
    if(!unit) throw err(400, 'unit does not exist')

    const client = await User.findOne({ email })
    if(!client) throw err(400, 'client does not exist')

    if(!client.emailVerified) {
        sendEmailVerify(
            client.email,
            client.firstName,
            `${process.env.HOST}/client/verify_email/${ client.id }`,
            apt.name
        )
    }

    //loop through each unit in each building to find the unit with the client
    apt.buildings.forEach(building => {
        building.units.forEach(unit => {
            if(unit.client?.toString() === client._id.toString()) {
                throw err(400, 'client already has a unit')
            }
        })
    })

    if(
        !idToString(client.pickUpAddresses)
        .includes(unit.address.toString())
    ) {
        client.pickUpAddresses.push(unit.address)
    }

    await client.save()

    //unit already have a client then they must be removed first
    /* Updating the unit with the client id and isActive. */
    apt.buildings.get(buildingId)?.units.set(unitId, {
        ...unit,
        client: client._id,
        isActive: isActive ? isActive : false,
    })

    await apt.save()
    return apt
})

AptSchema.method('removeClient', async function(
    this: AptDocT,
    buildingId: string,
    unitId: string
){
    const apt = this

    const unit = apt.buildings.get(buildingId)?.units
        .get(unitId)

    if(!unit) throw err(400, 'unit does not exist')

    if(!unit.client) throw err(400, 'client already does not exists')
    if(unit?.activeOrder) throw err(400, 'order is currently in progress')

    apt.buildings.get(buildingId)?.units
        .set(unitId, {
            ...unit,
            client: undefined,
            isActive: false
        })
    
    await apt.save()
    return apt
})

AptSchema.method('activateUnit', activateUnit)

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
    if(!unit.client) throw err(400, 'client already does not exists')
    if(unit.activeOrder) throw err(400, 'order is currently in progress')

    apt.buildings.get(buildingId)?.units.set(unitId, {
        ...unit,
        isActive: false,
        activeOrder: undefined
    })

    await apt.save()
    return apt
})

AptSchema.method('addOrderToUnit', async function(
    this: AptDocT,
    buildingId: string,
    unitId: string,
    orderId: Types.ObjectId
){
    const apt = this

    const unit = apt.buildings.get(buildingId)?.units
        .get(unitId)
    
    if(apt.buildings.get(buildingId)) err(400, 'could not find building')
    if(!unit) throw err(400, 'could not find unit')
    if(!unit.client) throw err(400, 'client already does not exists')
    if(!unit.isActive) throw err(400, 'unit not active')

    apt.buildings.get(buildingId)?.units.set(unitId, {
        address: unit.address,
        client: unit.client,
        isActive: true,
        activeOrder: orderId
    })

    await apt.save()

    return apt
})

AptSchema.method<AptDocT>('removeOrderToUnit', async function(
    this: AptDocT,
    buildingId: string,
    unitId: string
){
    const apt = this

    const unit = apt.buildings.get(buildingId)?.units
        .get(unitId)
    
    if(!apt.buildings.get(buildingId)) throw err(400, 'could not find building')
    if(!unit) throw err(400, 'could not find unit')

    apt.buildings.get(buildingId)?.units.set(unitId, {
        ...unit,
        isActive: true,
        activeOrder: undefined
    })

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

const Apt = model<AptI, AptModelT>('Apartment', AptSchema)

export default Apt