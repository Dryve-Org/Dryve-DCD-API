import { Types } from "mongoose";
import validator from "validator";
import Cleaner from "../Models/cleaner.model";
import CleanerProfile, { CleanerProfileI } from "../Models/cleanerProfile.model";
import { ManagerI } from "../Models/manager.models"
import Address from "../Models/address.model"
import User from "../Models/user.model";
import { intersectIds } from "./general";
import Service from "../Models/services.model";
import Order from "../Models/Order.model";
import _ from "lodash";

/**
 * It checks if the services exist in the database
 * @param {Types.ObjectId[] | string[]} services - Types.ObjectId[] | string[]
 * @returns A boolean value
*/
export const servicesExist = async (services: Types.ObjectId[] | string[]): Promise<boolean> => {
    try {
        const isServices = await Service.exists({
            '_id': { $in: services.map(serves => serves.toString()) }
        })
        return isServices ? true : false
    } catch (e) {
        return false
    }
}

/**
 * It checks if the cleaners exist in the database
 * @param {Types.ObjectId[] | string[]} cleanerIds - Types.ObjectId[] | string[]
 * @returns A boolean value
*/
export const cleanersExist = async (cleanerIds: Types.ObjectId[] | string[]): Promise<boolean> => {
    try {
        const validCleaners = await Cleaner.exists({
            '_id': { $in: cleanerIds.map(cln => cln.toString()) }
        })
        return validCleaners ? true : false
    } catch (e) {
        return false
    }
}

/**
 * It checks if a cleaner exists in the database
 * @param {Types.ObjectId | string} cleanerIds - Types.ObjectId | string
 * @returns A boolean value
*/
export const cleanerExist = async (cleanerIds: Types.ObjectId | string): Promise<boolean> => {
    try {
        const validCleaners = await Cleaner.exists({
            _id: cleanerIds.toString()
        })
        return validCleaners ? true : false
    } catch {
        return false
    }
}

/**
 * If the address exists, return true, otherwise return false.
 * @param {Types.ObjectId | string} addressId - Types.ObjectId | string
 * @returns A boolean value.
*/
export const addressExist = async (addressId: Types.ObjectId | string) => {
    try {
        const addy = await Address.exists({ _id: addressId.toString() })
        return addy ? true : false
    } catch {
        return false
    }
}

/**
 * It checks if a user exists in the database by either their email or their id
 * @param {string} userIdOrEmail - string
 * @returns A boolean
*/
export const userExist = async (userIdOrEmail: string): Promise<boolean> => {
    try {
        const isEmail = validator.isEmail(userIdOrEmail)
        const validUser = await User.exists({
            [isEmail ? 'email' : '_id']:userIdOrEmail
        })
        return validUser !== null
    } catch (e) {
        console.log('it got here')
        return false
    }
}

/**
 * This function checks if a cleaner profile exists by checking if the userId of the cleaner profile
 * exists in the database.
 * @param {Types.ObjectId | string} cleanerProId - Types.ObjectId | string
 * @returns A boolean value
*/
export const cleanerProExist = async (cleanerProId: Types.ObjectId | string): Promise<boolean> => {
    try {
        const validCleanerPro = await CleanerProfile.exists({ userId: cleanerProId })
        return validCleanerPro ? true : false
    } catch (e) {
        return false
    }
}

/**
 * This function checks if a manager is authorized to access a cleaner profile
 * @param {ManagerI} manager - ManagerI = {
 * @param {string} cleanerProId - string
 * @returns {
 *     auth: boolean, 
 *     cleanerPro: CleanerProfileI, 
 *     status: number, 
 *     message: string
 * }
*/
export const isManagerclnProAuth = async (
    manager: ManagerI, 
    cleanerProId: string, 
): Promise<{ auth: boolean, cleanerPro: CleanerProfileI, status: number, message: string}> => {
    let auth = true
    let status = 200
    let message = ""
    const cleanerPro = await CleanerProfile.findById(cleanerProId)
    if(cleanerPro === null) throw 'cleaner profile does not exist'
    
    /* Checking if the manager is authorized to access the cleaner profile. */
    if(!intersectIds(manager.attachedStores, cleanerPro.attachedCleaners)) {
        auth = false 
        status = 401
        message = "you're not authorized for this cleaner"
    }

    return { auth, cleanerPro, status,  message } 
}

/**
 * This function takes two arguments, both of which can be either a string or a MongoDB ObjectId, and
 * returns a boolean indicating whether or not the two arguments are equal.
 * @param {Types.ObjectId | string} idOne - Types.ObjectId | string
 * @param {Types.ObjectId | string} idTwo - Types.ObjectId | string
*/
export const isMatchingIds = (
    idOne: Types.ObjectId | string, 
    idTwo: Types.ObjectId | string
): boolean => idOne.toString() === idTwo.toString()

export const doesAllIdsMatch = (
    idsOne: Types.ObjectId[] | string[], 
    idsTwo: Types.ObjectId[] | string[]
) => {
    idsOne = idsOne.map(id => id.toString())
    idsTwo = idsTwo.map(id => id.toString())
    const intersect = _.intersection(idsOne, idsTwo)

    return idsOne.length === intersect.length
}


/**
 * It takes two arrays of strings or ObjectIds and returns true if there are no unmatching ids.
 * @param {Types.ObjectId[] | string[]} idsOne - Types.ObjectId[] | string[]
 * @param {Types.ObjectId[] | string[]} idsTwo - Types.ObjectId[] | string[]
 */
export const noUnMatchingIds = (
    idsOne: Types.ObjectId[] | string[], 
    idsTwo: Types.ObjectId[] | string[]
) => {
    idsOne = idsOne.map(id => id.toString())
    idsTwo = idsTwo.map(id => id.toString())
    const difference = _.difference(idsOne, idsTwo)

    return difference.length ? true : false
}
