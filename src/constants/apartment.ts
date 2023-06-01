import Apt, { AptDocT } from "../Models/aparmtent/apartment.model"
import { extractUnitId } from "./general"

/**
 * Get Apartment By Id and will throw if cant receive it
 * @param {string} orderId - string
 * @returns {AptDocT} The Apartment object
*/
export const getAptById = async (aptId: string) => {
    const apt = await Apt.findById(aptId)
        .catch(() => {
            throw 'invalid order Id'
        })
    if(!apt) throw 'invalid order Id'

    return apt
}

export const getAptByAptId = async (aptId: string) => {
    const apt = await Apt.findOne({ aptId })

    return apt
}

export const getAPtByUnitId = async (unitId: string) => {
    const apt = await Apt.findOne({ 
        aptId: extractUnitId(unitId)[0] 
    })

    return apt
}