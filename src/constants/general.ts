import _ from "lodash";
import mongoose,{ Types } from "mongoose";
import Service from "../Models/services.model";

type IdI = Types.ObjectId | string

/**
 * It takes an array of IdI or a single IdI and returns an array of strings
 * @param {IdI | IdI[]} ids - IdI | IdI[]
 * @returns An array of strings.
*/
export const idToString = (ids: IdI | IdI[]): string[] => {
    if(!ids) return []
    if(!Array.isArray(ids)) return [ ids.toString() ]
    return ids.map(id => id.toString())
}

/**
 * It takes a string or an array of strings and returns an array of mongoose ObjectIds.
 * @param {string | string[]} ids - string | string[]
 * @returns An array of ObjectIds
*/
export const stringToId = (ids: string | string[]): Types.ObjectId[] => {
    if(!Array.isArray(ids)) return [ new mongoose.Types.ObjectId(ids) ]
    return ids.map(id => new mongoose.Types.ObjectId(id))
}

/**
 * It takes two lists of objects that have an id property and returns a list of the ids that are in
 * both lists
 * @param {IdI[]} listOne - [{id: '1'}, {id: '2'}, {id: '3'}]
 * @param {IdI[]} listTwo - [{id: '1'}, {id: '2'}, {id: '3'}]
 * @returns An array of strings.
*/
export const intersectIds = (listOne: IdI[], listTwo: IdI[]): string[] => {
    const strListTwo = idToString(listTwo)
    return idToString(listOne).filter(clnId => strListTwo.includes(clnId))
}

export interface desiredServicesI {
    quantity: number,
    service: string //stored prices of each service
}


/**
 * It takes an array of desired services, and returns an object with a total 
 * of the desired services altogether and with the cost of the desired services
 * in the object with its corresponse quantity.
 * 
 * @param {desiredServicesI[]} desiredServices - desiredServicesI[]
 * @returns {
 *     total: number,
 *     serviceWithPrice: desiredServicesI[]
 * }
 */
export const handleDesiredServices = async (
    desiredServices: desiredServicesI[]
) => {
    const desiredServiceIds = desiredServices.map(service => service.service.toString())
    const services = await Service.find({
        '_id': { $in: desiredServiceIds }
    })
    .catch(() => {
        throw 'unable to verfiy services'
    })

    if(!services) throw 'unable to verfiy services'
    
    let total: number = 0

    const serviceWithPrice = desiredServices.map(service => {
        const match = _.find(services, { _id: stringToId(service.service)[0] })
        if(!match) throw 'unable to handle services'
        const cost = match.price * service.quantity
        total += cost

        return {
            ...service,
            cost,
            service: match
        }
    })

    return {
        total,
        serviceWithPrice
    }
}