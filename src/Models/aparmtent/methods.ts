import { err } from "../../constants/general"
import { stripe } from "../../constants/moneyHandling"
import Master from "../master"
import User, { UserDocT, UserI } from "../user.model"
import { AptDocT } from "./apartment.model"
import v from 'validator'

/**
 * get building
 * @param {string} buildingId - string - building identifier
 * @return {AptBuildingI} - building
*/
export function getBuilding (this: AptDocT, 
    buildingId: string
) {
    const apt = this as AptDocT

    const building = apt.buildings.get(buildingId)

    if(!building) throw new Error('building not found')

    return building
}

/**
 * Activate client to an apartment unit
 * 
 * **Client must be in unit
 * 
 * @param {string} buildingId - string - building identifier
 * @param {String} unitId - strings - unit identifier
 * @return {Promise<AptDocT>} - updated Apt document
*/
export async function activateUnit(this: AptDocT,
    buildingId: string, 
    unitId: string
) {
    const apt = this
    
    const unit = apt.buildings.get(buildingId)?.units
        .get(unitId)
    
    if(apt.buildings.get(buildingId)) err(400, `could not find building ${buildingId}`)
    if(!unit) throw err(400, `could not find unit ${unitId}`)
    if(unit.isActive) throw err(400, `unit ${unitId} is already active`)

    unit.isActive = true

    apt.buildings.get(buildingId)?.units.set(unitId, unit)

    await apt.save()
    return apt
}

//use this to generate a unique id for each apartment

/**
 * Generate a unique id for each apartment
 * @param {number} num - number - apartment number
 * @return {string} - unique id
 * @example
 * generateId(1) // returns A01
 * generateId(26) // returns B01
 * generateId(27) // returns B02
 * generateId(52) // returns C02
*/
export async function generateId(
    this: AptDocT,
): Promise<string> {
    const apt = this
    if(apt.aptId) throw err(200, 'apartment already has an id')

    const master = await Master.findOne()
    if (!master) throw new Error("master document not found")
    const index = master.apartment_id_index

    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let letterIndex = Math.floor((index - 1) / 26); // determine which letter to use
    let numberSuffix = ((index - 1) % 26) + 1; // determine which number to use as suffix
    let id = ""
    if (numberSuffix < 10) {
        // pad with leading zero if necessary
        id = letters.charAt(letterIndex) + "0" + numberSuffix.toString();
    } else {
        id = letters.charAt(letterIndex) + numberSuffix.toString();
    }

    apt.aptId = id
    await master.incrementApartmentIdIndex()

    return id
}

export async function updateMaster(
    this: AptDocT,
    masterId: string
) {
    const apt = this

    const master = await Master.findById(masterId)
    if(!master) throw err(400, 'master does not exist')

    apt.master = master._id

    await apt.save()

    return apt
}

export async function addSubscription(
    this: AptDocT,
    unitId: string,
    subscriptionId: string,
    /**
     * this alse can be a user email
     */
    clientId: string,
    bagQuantity: number
) {
    const apt = this
    const unitData = apt.getUnitId(unitId)
    if(!unitData) throw err(400, 'unit does not exist')

    const [buildingId, unitNum, unit] = unitData

    
    
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    if(!subscription || !subscription.status) throw err(400, 'subscription does not exist')
    
    let client: any

    if(v.isEmail(clientId)) {
        client = await User.findOne({ email: clientId })
    } else {
        client = await User.findById(clientId.toString())
    }
    
    if(!client || client === null) throw err(400, 'client does not exist')

    if(unit.subscriptions.filter(sub => sub.id === subscriptionId || sub.client.toString() === client.id).length > 0) {
        throw err(400, 'cannot add subscription to unit because it already exists or client already has subscription')
    }

    if(subscription.customer !== client.stripeId) {
        throw err(400, `${ client.firstName } ${ client.lastName } does not own subscription ${ subscriptionId }`)
    }

    let updateClient = false

    if(!client.attachedUnitIds.includes(unitId)) {
        client.attachedUnitIds.push(unitId)
        updateClient = true
    }

    if(!client.subscriptions.filter((sub: any) => sub.id === subscription.id)) {
        client.subscriptions.push({
            id: subscription.id,
            status: subscription.status,
            unitId: unitId,
            bagQuantity
        })
        updateClient = true
    }
    
    unit.subscriptions.push({
        id: subscription.id,
        client: client._id,
        status: subscription.status,
        bagQuantity
    })

    apt.buildings.get(buildingId)?.units.set(unitNum, unit)

    await apt.save()
    client.save()

    return apt.buildings.get(buildingId)?.units.get(unitNum)
}


