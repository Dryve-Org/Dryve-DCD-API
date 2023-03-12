import _ from "lodash";
import mongoose,{ Types } from "mongoose";
import Service from "../Models/services.model";

type IdI = Types.ObjectId | string

/**
 * It takes a number and a string and returns an object with two properties, status and message.
 * @param {number} status - The HTTP status code
 * @param {string} message - The message to be displayed to the user.
 */
export const err = (status: number, message: string) => ({
    status,
    message
})

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
    /**
     * Weight of the item in pounds
     * if perPound is true, this is required to calculate the price
     */
    weight: number,
    quantity: number,
    service: string //stored prices of each service
}


/**
 * It takes an array of desired services, and returns an object with a total 
 * of the desired services altogether and with the cost of the desired services
 * in the object with its corresponse quantity.
 * 
 * @param {desiredServicesI[]} desiredServices - desiredServicesI[]
 * @param {minPrice} number - minimum price of the order
 * @param {minProductId} serviceId - serviceId of the minimum price product
 * @returns {
 *     total: number,
 *     servicesWithPrice: desiredServicesI[]
 * }
 */
export const handleDesiredServices = async (
    desiredServices: desiredServicesI[],
    minPrice?: number,
    minProductId?: string,
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

    const servicesWithPrice = desiredServices.map(service => {
        const match = _.find(services, { _id: stringToId(service.service)[0] })
        if(!match) throw 'unable to handle services'

        if(match.perPound) {
            let cost: number = match.price * service.weight * service.quantity

            total += cost

            return {
                quantity: Math.round(service.weight),
                cost,
                service: match
            }
        }

        const cost = match.price * service.quantity
        total += cost

        return {
            quantity: service.quantity,
            cost,
            service: match
        }
    })

    if(minPrice && total < minPrice && minProductId) {
        const minProduct = await Service.findById(minProductId)
        if(!minProduct) throw 'unable to find min product'

        servicesWithPrice.push({
            quantity: 1,
            cost: minProduct.price,
            service: minProduct
        })
    }

    return {
        total,
        servicesWithPrice
    }
}

/**
 * It takes a string and returns a string with the unitId extracted from the string.
 * @param {string} unitId - string
 * @returns string
 * @example
 * extractUnitId('A01-001') // returns '['A01', '001']'
*/
export const extractUnitId = (
    unitId: string
): [string, string] => {
    const extract = unitId.split('-')

    return [
        extract[0] || '',
        extract[1] || ''
    ]
}