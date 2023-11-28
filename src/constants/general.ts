import _ from "lodash";
import mongoose,{ Types } from "mongoose";
import Service from "../Models/services.model";
import Master from "../Models/master";
import { SAPDocT, SAPI } from "../Models/ServicesAndProducts";

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
export const stringToId = (
    ids: string | string[] | Types.ObjectId | Types.ObjectId[]
): Types.ObjectId[] => {
    const returnString = (id: string | Types.ObjectId) => typeof id === 'string' ? id : id.toString()

    if(!Array.isArray(ids)) return [ 
        new mongoose.Types.ObjectId(
            returnString(ids).length === 24 ? returnString(ids) : 24
        )
    ]
    return ids.map(id => new mongoose.Types.ObjectId(
        returnString(id)
    ))
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
    quantity: number
    service: SAPI['list'][1]
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
    masterId: string | Types.ObjectId
) => {
    //@ts-ignore
    const desiredServiceIds = desiredServices.map(service => service.service._id.toString())
    const master = await Master.findById(masterId)
    if(!master) throw 'unable to find master'

    //@ts-ignore
    let services: SAPI['list'] = await master.listServices()
    if(!services) throw 'unable to get services'

    //@ts-ignore
    services = services.filter(service => desiredServiceIds.includes(service._id.toString()))
    
    let total: number = 0

    const servicesWithPrice = desiredServices.map(dService => {
        const match = _.find(services, { name: dService.service.name })
        if(!match || typeof match == 'number') throw 'unable to handle services'

        //@ts-ignore
        const cost = match.price * dService.quantity
        total += cost
        return {
            quantity: dService.quantity,
            cost,
            service: match
        }
    })

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
    if(extract[0].length !== 3) return ['', '']

    return [
        extract[0] || '',
        extract[1] || ''
    ]
}

export const generatePassword = (
    howLong: number = 8,
) => {
    const length = howLong
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let retVal = ""
    for (let i = 0, n = charset.length; i < length; ++i) {
        retVal += charset.charAt(Math.floor(Math.random() * n))
    }
    return retVal
}